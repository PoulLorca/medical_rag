import { convertToModelMessages, createUIMessageStream, createUIMessageStreamResponse, generateText, smoothStream, stepCountIs, streamText } from 'ai'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { z } from 'zod'
import { db, schema } from 'hub:db'
import { and, eq } from 'drizzle-orm'
import type { UIMessage } from 'ai'
import { generateEmbeddings } from '~~/server/utils/embeddings'
import { useNeon } from '~~/server/utils/neon'

defineRouteMeta({
  openAPI: {
    description: 'Chat with AI.',
    tags: ['ai']
  }
})

function buildSystemPrompt(ragContext: string, username?: string): string {
  const userGreeting = username ? `The user's name is ${username}.` : ''

  const baseRules = `
  **FORMATTING RULES (CRITICAL):**
  - ABSOLUTELY NO MARKDOWN HEADINGS: Never use #, ##, ###, ####, #####, or ######
  - NO underline-style headings with === or ---
  - Use **bold text** for emphasis and section labels instead
  - Start all responses with content, never with a heading

  **RESPONSE QUALITY:**
  - Be concise yet comprehensive
  - Use examples when helpful
  - Break down complex topics into digestible parts
  - Maintain a friendly, professional tone`

    if (ragContext) {
      return `You are a technical assistant specialized in medical equipment documentation. ${userGreeting}

  You have access to the following technical documentation fragments retrieved from equipment manuals:

  ${ragContext}

  **RAG RULES:**
  - Answer ONLY based on the documentation context provided above
  - If the information is NOT in the context, say so clearly — do not make up information
  - Reference the fragment number when relevant (e.g. "According to Fragment 2...")
  - Use appropriate technical language but keep explanations understandable
  - If the user asks something unrelated to medical equipment, you can answer normally but note that your specialty is medical equipment documentation
  ${baseRules}`
    }

    return `You are a knowledgeable and helpful AI assistant. ${userGreeting} Your goal is to provide clear, accurate, and well-structured responses.

  When the user asks about medical equipment and no documentation context is available, let them know that no technical manuals have been uploaded yet and suggest they contact the administrator.
  ${baseRules}`
}

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  const config = useRuntimeConfig(event)

  if (!config.openrouterApiKey) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Missing OPENROUTER_API_KEY'
    })
  }

  const openrouter = createOpenRouter({
    apiKey: config.openrouterApiKey
  })

  const { id } = await getValidatedRouterParams(event, z.object({
    id: z.string()
  }).parse)

  const { model, messages } = await readValidatedBody(event, z.object({
    model: z.string(),
    messages: z.array(z.custom<UIMessage>())
  }).parse)

  const chat = await db.query.chats.findFirst({
    where: () => and(
      eq(schema.chats.id, id as string),
      eq(schema.chats.userId, session.user?.id || session.id)
    ),
    with: {
      messages: true
    }
  })
  if (!chat) {
    throw createError({ statusCode: 404, statusMessage: 'Chat not found' })
  }

  if (!chat.title) {
    const { text: title } = await generateText({
      model: openrouter('openai/gpt-4o-mini'),
      system: `You are a title generator for a chat:
          - Generate a short title based on the first user's message
          - The title should be less than 30 characters long
          - The title should be a summary of the user's message
          - Do not use quotes (' or ") or colons (:) or any other punctuation
          - Do not use markdown, just plain text`,
      prompt: JSON.stringify(messages[0])
    })

    await db.update(schema.chats).set({ title }).where(eq(schema.chats.id, id as string))
  }

  const lastMessage = messages[messages.length - 1]
  if (lastMessage?.role === 'user' && messages.length > 1) {
    await db.insert(schema.messages).values({
      chatId: id as string,
      role: 'user',
      parts: lastMessage.parts
    })
  }

  // --- RAG: Search relevant document chunks ---
  let ragContext = ''

  if (lastMessage?.role === 'user') {
    try {
      // Extract text from the last user message
      const questionText = lastMessage.parts
        ?.filter((p: any) => p.type === 'text')
        .map((p: any) => p.text)
        .join(' ') || ''

      if (questionText.length > 5) {
        const questionEmbedding = await generateEmbeddings(questionText)
        const sql = useNeon()

        const relevantChunks = await sql`
          SELECT * FROM search_chunks(
            ${JSON.stringify(questionEmbedding)}::vector,
            5,
            NULL,
            0.7
          )
        `

        if (relevantChunks.length > 0) {
          ragContext = relevantChunks
            .map((chunk: any, idx: number) =>
              `[Fragment ${idx + 1} | Similarity: ${(chunk.similarity * 100).toFixed(0)}%]:\n${chunk.content}`
            )
            .join('\n\n---\n\n')
        }
      }
    }
    catch (error) {
      console.error('RAG search failed, continuing without context:', error)
      // Don't block the chat if RAG fails — just respond without context
    }
  }

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      const result = streamText({
        model: openrouter(model),
        system: buildSystemPrompt(ragContext, session.user?.username),
        messages: await convertToModelMessages(messages),
        stopWhen: stepCountIs(5),
        experimental_transform: smoothStream({ chunking: 'word' }),
        tools: {
          weather: weatherTool,
          chart: chartTool
        }
      })

      if (!chat.title) {
        writer.write({
          type: 'data-chat-title',
          data: { message: 'Generating title...' },
          transient: true
        })
      }

      writer.merge(result.toUIMessageStream({
        sendReasoning: true
      }))
    },
    onFinish: async ({ messages }) => {
      await db.insert(schema.messages).values(messages.map(message => ({
        chatId: chat.id,
        role: message.role as 'user' | 'assistant',
        parts: message.parts
      })))
    }
  })

  return createUIMessageStreamResponse({
    stream
  })
})
