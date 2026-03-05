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
    return `You are MedDoc Assistant, a technical assistant specialized in pharmaceutical documentation. ${userGreeting}

You have access to the following documentation fragments retrieved from official drug datasheets:

${ragContext}

**CRITICAL RAG RULES — YOU MUST FOLLOW THESE:**
- Answer ONLY and EXCLUSIVELY based on the documentation context provided above
- If the answer is NOT in the provided fragments, you MUST say: "I don't have documentation loaded for this topic. The administrator needs to upload the relevant datasheet so I can help you with this question."
- NEVER use your own training knowledge to answer medical or pharmaceutical questions
- NEVER make up, infer, or guess information that is not explicitly in the fragments

**CITATION RULES — THIS IS THE MOST IMPORTANT PART:**
- You MUST cite the source document name and fragment number for EVERY claim you make
- Use this format: (Source: "Document Name", Fragment X)
- If information comes from multiple documents, cite each one separately
- At the end of your response, include a **Sources:** section listing all documents referenced
- Example: "Paracetamol should not exceed 4g daily in adults (Source: "Paracetamol Kern Pharma 1g", Fragment 2)."

- Use appropriate technical language but keep explanations understandable
- Always end with a reminder that this is informational only and does not replace professional medical advice
${baseRules}`
  }

  return `You are MedDoc Assistant, a technical assistant specialized in pharmaceutical documentation. ${userGreeting}

**CRITICAL: You have NO documentation loaded for the user's question.**

You MUST respond with something like:
"I don't have documentation loaded that covers this topic. I can only answer questions based on official drug datasheets that have been uploaded to my knowledge base. Please ask the administrator to upload the relevant documentation, or try asking about one of the medications I already have loaded."

You MUST NOT answer medical or pharmaceutical questions from your own training knowledge. This is a RAG system — you only answer from uploaded documents.

If the user asks a non-medical question (like a greeting, how you work, or what you can do), you can respond naturally and explain that you are a medical documentation assistant that answers based on uploaded drug datasheets.
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
      const questionText = lastMessage.parts
        ?.filter((p: any) => p.type === 'text')
        .map((p: any) => p.text)
        .join(' ') || ''

      if (questionText.length > 5) {
        const questionEmbedding = await generateEmbeddings(questionText)
        const sql = useNeon()

        const relevantChunks = await sql`
          SELECT 
            dc.id,
            dc.document_id,
            dc.content,
            dc.page_number,
            dc.chunk_index,
            1 - (dc.embedding <=> ${JSON.stringify(questionEmbedding)}::vector) AS similarity,
            d.name AS document_name,
            d.equipment_type
          FROM document_chunks dc
          JOIN documents d ON d.id = dc.document_id
          WHERE 1 - (dc.embedding <=> ${JSON.stringify(questionEmbedding)}::vector) >= 0.7
          ORDER BY dc.embedding <=> ${JSON.stringify(questionEmbedding)}::vector
          LIMIT 5
        `

        if (relevantChunks.length > 0) {
          ragContext = relevantChunks
            .map((chunk: any, idx: number) =>
              `[Fragment ${idx + 1} | Source: "${chunk.document_name}" | Section/Chunk: ${chunk.chunk_index} | Page: ${chunk.page_number} | Similarity: ${(chunk.similarity * 100).toFixed(0)}%]:\n${chunk.content}`
            )
            .join('\n\n---\n\n')
        }
      }
    }
    catch (error) {
      console.error('RAG search failed, continuing without context:', error)
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