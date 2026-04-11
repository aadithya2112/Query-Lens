import {
  GoogleGenAI,
  type FunctionCall,
  type ToolConfig,
  type ToolListUnion,
} from "@google/genai"

import { getQueryLensAiConfig } from "@/lib/querylens/server/ai-config"

export interface GeminiFunctionCall {
  name?: string
  args?: Record<string, unknown>
}

export interface GeminiGenerationRequest {
  prompt: string
  responseJsonSchema?: unknown
  tools?: ToolListUnion
  toolConfig?: ToolConfig
}

export interface GeminiGenerationResult {
  text: string
  json?: unknown
  functionCalls?: GeminiFunctionCall[]
}

let geminiClient: GoogleGenAI | undefined

function getGoogleGenAIClient() {
  if (!geminiClient) {
    const { apiKey } = getQueryLensAiConfig()

    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is required to initialize Gemini.")
    }

    geminiClient = new GoogleGenAI({ apiKey })
  }

  return geminiClient
}

function normalizeFunctionCalls(functionCalls: FunctionCall[] | undefined) {
  return functionCalls?.map((call) => ({
    name: call.name,
    args:
      call.args && typeof call.args === "object"
        ? (call.args as Record<string, unknown>)
        : undefined,
  }))
}

export async function generateGeminiResponse(
  request: GeminiGenerationRequest
): Promise<GeminiGenerationResult> {
  const { model } = getQueryLensAiConfig()
  const client = getGoogleGenAIClient()
  const response = await client.models.generateContent({
    model,
    contents: request.prompt,
    config: {
      responseMimeType: request.responseJsonSchema ? "application/json" : undefined,
      responseJsonSchema: request.responseJsonSchema,
      tools: request.tools,
      toolConfig: request.toolConfig,
      temperature: 0,
    },
  })

  const text = response.text?.trim() ?? ""

  return {
    text,
    json: text ? JSON.parse(text) : undefined,
    functionCalls: normalizeFunctionCalls(response.functionCalls),
  }
}

export function resetGeminiClientForTests() {
  geminiClient = undefined
}
