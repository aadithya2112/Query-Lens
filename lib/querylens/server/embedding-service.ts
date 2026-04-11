import { GoogleGenAI } from "@google/genai"

import { getQueryLensAiConfig, isDeterministicAiMode } from "@/lib/querylens/server/ai-config"

const DEFAULT_EMBEDDING_MODEL = "text-embedding-004"
export const EMBEDDING_DIMENSIONS = 64

let geminiEmbeddingClient: GoogleGenAI | undefined

type EmbeddingTask = "document" | "query"

function getEmbeddingModel() {
  return process.env.QUERYLENS_EMBEDDING_MODEL?.trim() || DEFAULT_EMBEDDING_MODEL
}

function getGeminiEmbeddingClient() {
  if (!geminiEmbeddingClient) {
    const { apiKey } = getQueryLensAiConfig()

    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is required to initialize Gemini embeddings.")
    }

    geminiEmbeddingClient = new GoogleGenAI({ apiKey })
  }

  return geminiEmbeddingClient
}

function normalizeVector(values: number[]) {
  const magnitude = Math.sqrt(values.reduce((sum, value) => sum + value * value, 0))

  if (!magnitude) {
    return values.map(() => 0)
  }

  return values.map((value) => value / magnitude)
}

function embedDeterministically(text: string) {
  const vector = Array.from({ length: EMBEDDING_DIMENSIONS }, () => 0)
  const normalized = text.toLowerCase().replace(/[^a-z0-9\s]+/g, " ").trim()
  const tokens = normalized.split(/\s+/).filter(Boolean)

  tokens.forEach((token, tokenIndex) => {
    let hash = 2166136261

    for (let index = 0; index < token.length; index += 1) {
      hash ^= token.charCodeAt(index)
      hash = Math.imul(hash, 16777619)
    }

    const bucket = Math.abs(hash) % EMBEDDING_DIMENSIONS
    const sign = hash % 2 === 0 ? 1 : -1
    vector[bucket] += sign * (1 + tokenIndex * 0.03)
  })

  return normalizeVector(vector)
}

function shouldUseGeminiEmbeddings() {
  const { apiKey } = getQueryLensAiConfig()
  return Boolean(apiKey) && !isDeterministicAiMode()
}

export async function embedTexts(args: {
  texts: string[]
  task: EmbeddingTask
}): Promise<number[][]> {
  if (!args.texts.length) {
    return []
  }

  if (!shouldUseGeminiEmbeddings()) {
    return args.texts.map(embedDeterministically)
  }

  try {
    const client = getGeminiEmbeddingClient()
    const response = await client.models.embedContent({
      model: getEmbeddingModel(),
      contents: args.texts,
      config: {
        outputDimensionality: EMBEDDING_DIMENSIONS,
        taskType:
          args.task === "query" ? "RETRIEVAL_QUERY" : "RETRIEVAL_DOCUMENT",
      },
    })

    const embeddings =
      response.embeddings?.map((entry) => entry.values ?? []) ?? []

    if (embeddings.length !== args.texts.length) {
      throw new Error("Gemini embeddings response did not match the number of texts.")
    }

    return embeddings.map((values) => normalizeVector(values))
  } catch {
    geminiEmbeddingClient = undefined
    return args.texts.map(embedDeterministically)
  }
}

export function formatVectorLiteral(values: number[]) {
  return `[${values.map((value) => Number(value.toFixed(6))).join(",")}]`
}

export function cosineSimilarity(left: number[], right: number[]) {
  return left.reduce((sum, value, index) => sum + value * (right[index] ?? 0), 0)
}

export function resetEmbeddingClientForTests() {
  geminiEmbeddingClient = undefined
}
