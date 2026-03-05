import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { embed } from "ai";

export async function generateEmbeddings(text: string): Promise<number[]> {
  const config = useRuntimeConfig();
  const openRouter = createOpenRouter({ apiKey: config.openrouterApiKey });
  const { embedding } = await embed({
    model: openRouter.textEmbeddingModel('openai/text-embedding-3-small'),
    value: text
  })

  return embedding
}