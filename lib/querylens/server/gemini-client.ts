import {
  GoogleGenAI,
  type FunctionCall,
  type GenerateContentConfig,
  type PartListUnion,
  type ToolConfig,
  type ToolListUnion,
} from "@google/genai"

import { getQueryLensAiConfig } from "@/lib/querylens/server/ai-config"

export interface GeminiFunctionCall {
  id?: string
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

export interface GeminiChatSession {
  sendMessage(args: {
    message: PartListUnion
    config?: GenerateContentConfig
  }): Promise<GeminiGenerationResult>
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
    id: call.id,
    name: call.name,
    args:
      call.args && typeof call.args === "object"
        ? (call.args as Record<string, unknown>)
        : undefined,
  }))
}

function normalizeGeminiResult(response: { text?: string | null; functionCalls?: FunctionCall[] }) {
  const text = response.text?.trim() ?? ""
  let json: unknown

  if (text) {
    try {
      json = JSON.parse(text)
    } catch {
      json = undefined
    }
  }

  return {
    text,
    json,
    functionCalls: normalizeFunctionCalls(response.functionCalls),
  }
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

  return normalizeGeminiResult(response)
}

export function createGeminiChatSession(
  config?: GenerateContentConfig
): GeminiChatSession {
  const { model } = getQueryLensAiConfig()
  const client = getGoogleGenAIClient()
  const chat = client.chats.create({
    model,
    config,
  })

  return {
    sendMessage: async (args) =>
      normalizeGeminiResult(
        await chat.sendMessage({
          message: args.message,
          config: args.config,
        })
      ),
  }
}

export function resetGeminiClientForTests() {
  geminiClient = undefined
}
