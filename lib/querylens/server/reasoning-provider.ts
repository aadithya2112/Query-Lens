import { z } from "zod"

import { getQueryLensAiConfig } from "@/lib/querylens/server/ai-config"
import { generateGeminiResponse } from "@/lib/querylens/server/gemini-client"
import type { DatasetImportErrorCode } from "@/lib/querylens/types"

export interface StructuredGenerationRequest {
  prompt: string
  responseJsonSchema: unknown
  schemaName: string
}

export interface StructuredGenerationResult<T = unknown> {
  provider: "gemini" | "openrouter"
  text: string
  data?: T
}

export type ReasoningProviderErrorCode =
  | "rate_limited"
  | "auth_failed"
  | "upstream_error"

export class ReasoningProviderError extends Error {
  provider: "openrouter"
  status: number
  code: ReasoningProviderErrorCode
  retryable: boolean
  responseBody?: string

  constructor(args: {
    message: string
    status: number
    code: ReasoningProviderErrorCode
    retryable: boolean
    responseBody?: string
  }) {
    super(args.message)
    this.name = "ReasoningProviderError"
    this.provider = "openrouter"
    this.status = args.status
    this.code = args.code
    this.retryable = args.retryable
    this.responseBody = args.responseBody
  }
}

interface OpenRouterResponse {
  choices?: Array<{
    message?: {
      content?: string | null
    }
  }>
}

function classifyOpenRouterStatus(status: number): {
  code: ReasoningProviderErrorCode
  retryable: boolean
} {
  if (status === 429) {
    return {
      code: "rate_limited",
      retryable: true,
    }
  }

  if (status === 401 || status === 403) {
    return {
      code: "auth_failed",
      retryable: false,
    }
  }

  return {
    code: "upstream_error",
    retryable: status >= 500,
  }
}

export function isReasoningProviderError(
  error: unknown
): error is ReasoningProviderError {
  return error instanceof ReasoningProviderError
}

export function mapReasoningProviderErrorToImportCode(
  error: ReasoningProviderError
): DatasetImportErrorCode {
  if (error.status === 429) {
    return "openrouter_rate_limited"
  }

  if (error.status === 401 || error.status === 403) {
    return "openrouter_auth_failed"
  }

  return "openrouter_upstream_error"
}

function extractJsonFromText<T>(text: string) {
  if (!text.trim()) {
    return undefined
  }

  try {
    return JSON.parse(text) as T
  } catch {
    return undefined
  }
}

async function generateWithOpenRouter<T>(
  request: StructuredGenerationRequest
): Promise<StructuredGenerationResult<T>> {
  const config = getQueryLensAiConfig()

  if (!config.openrouterApiKey) {
    throw new Error("OPENROUTER_API_KEY is required to initialize OpenRouter.")
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.openrouterApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.openrouterModel,
      messages: [
        {
          role: "user",
          content: request.prompt,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: request.schemaName,
          strict: true,
          schema: request.responseJsonSchema,
        },
      },
      plugins: [{ id: "response-healing" }],
    }),
  })

  if (!response.ok) {
    const responseBody = await response.text()
    const classification = classifyOpenRouterStatus(response.status)

    throw new ReasoningProviderError({
      message: `OpenRouter request failed with ${response.status}.`,
      status: response.status,
      code: classification.code,
      retryable: classification.retryable,
      responseBody,
    })
  }

  const payload = (await response.json()) as OpenRouterResponse
  const text = payload.choices?.[0]?.message?.content?.trim() ?? ""

  return {
    provider: "openrouter",
    text,
    data: extractJsonFromText<T>(text),
  }
}

async function generateWithGemini<T>(
  request: StructuredGenerationRequest
): Promise<StructuredGenerationResult<T>> {
  const result = await generateGeminiResponse({
    prompt: request.prompt,
    responseJsonSchema: request.responseJsonSchema,
  })

  const firstFunctionCall = result.functionCalls?.[0]
  const fallbackFunctionArgs =
    firstFunctionCall?.args &&
    typeof firstFunctionCall.args === "object"
      ? ({
          ...(firstFunctionCall.name?.startsWith("submit_")
            ? { decision: "submit" }
            : firstFunctionCall.name?.startsWith("reject_")
              ? { decision: "reject" }
              : {}),
          ...firstFunctionCall.args,
        } as T)
      : undefined

  return {
    provider: "gemini",
    text: result.text,
    data: (result.json as T | undefined) ?? fallbackFunctionArgs,
  }
}

export async function generateStructuredData<T>(
  request: StructuredGenerationRequest,
  schema?: z.ZodType<T>
): Promise<StructuredGenerationResult<T>> {
  const config = getQueryLensAiConfig()

  const rawResult =
    config.reasoningProvider === "openrouter"
      ? await generateWithOpenRouter<T>(request)
      : await generateWithGemini<T>(request)

  if (!schema) {
    return rawResult
  }

  const parsed = rawResult.data ? schema.safeParse(rawResult.data) : undefined
  return {
    ...rawResult,
    data: parsed?.success ? parsed.data : undefined,
  }
}
