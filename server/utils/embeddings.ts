import { createVoyage } from 'voyage-ai-provider'
import { embed } from "ai";

interface RetryOptions {
  maxAttempts?: number
  initialDelayMs?: number
  maxDelayMs?: number
}

function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function isRateLimitError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /too many requests|rate limit|429/i.test(message)
}

async function withRateLimitRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 6,
    initialDelayMs = 1500,
    maxDelayMs = 20000
  } = options

  let delayMs = initialDelayMs
  let lastError: unknown

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation()
    }
    catch (error) {
      lastError = error

      if (!isRateLimitError(error) || attempt === maxAttempts) {
        throw error
      }

      const jitterMs = Math.floor(Math.random() * 350)
      await wait(Math.min(delayMs, maxDelayMs) + jitterMs)
      delayMs = Math.min(delayMs * 2, maxDelayMs)
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Failed to generate embedding after retries')
}

function getVoyageProvider() {
  const config = useRuntimeConfig();
  return createVoyage({
    apiKey: config.voyageApiKey
  })
}

// For indexing documents (upload time)
export async function generateEmbeddings(text: string): Promise<number[]> {
  const voyage = getVoyageProvider();
  
  const { embedding } = await embed({
    model: voyage.textEmbeddingModel('voyage-4'),    
    value: text
  })

  return embedding
}

export async function generateEmbeddingsWithRetry(text: string): Promise<number[]> {
  return withRateLimitRetry(() => generateEmbeddings(text))
}

// For search queries (search time)
export async function generateQueryEmbeddings(text: string): Promise<number[]> {
  return withRateLimitRetry(async () => {
    const voyage = getVoyageProvider();

    const { embedding } = await embed({
      model: voyage.textEmbeddingModel('voyage-4'),
      value: text
    })

    return embedding
  }, {
    maxAttempts: 4,
    initialDelayMs: 1000,
    maxDelayMs: 8000
  })
}