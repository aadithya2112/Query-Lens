import {
  createPartFromFunctionResponse,
  FunctionCallingConfigMode,
  type FunctionDeclaration,
  type Part,
} from "@google/genai"

import { getQueryLensAiConfig } from "@/lib/querylens/server/ai-config"
import { createGeminiChatSession } from "@/lib/querylens/server/gemini-client"

export interface AgentToolDefinition {
  name: string
  description: string
  parametersJsonSchema: Record<string, unknown>
}

export interface AgentFunctionCall {
  id: string
  name: string
  args: Record<string, unknown>
}

export interface AgentFunctionResponse {
  callId: string
  name: string
  payload: Record<string, unknown>
}

export interface AgentModelTurn {
  text: string
  functionCalls: AgentFunctionCall[]
}

export interface AgentModelSession {
  sendPrompt(prompt: string): Promise<AgentModelTurn>
  sendFunctionResponses(responses: AgentFunctionResponse[]): Promise<AgentModelTurn>
}

function normalizeFunctionCalls(
  functionCalls: Array<{
    id?: string
    name?: string
    args?: Record<string, unknown>
  }> | undefined,
): AgentFunctionCall[] {
  return (functionCalls ?? [])
    .filter(
      (call): call is { id?: string; name: string; args?: Record<string, unknown> } =>
        Boolean(call?.name),
    )
    .map((call, index) => ({
      id: call.id ?? `tool-call-${index + 1}`,
      name: call.name,
      args: call.args ?? {},
    }))
}

function buildGeminiTools(tools: AgentToolDefinition[]): FunctionDeclaration[] {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parametersJsonSchema: tool.parametersJsonSchema,
  }))
}

function createGeminiAgentModelSession(tools: AgentToolDefinition[]): AgentModelSession {
  const geminiTools = buildGeminiTools(tools)
  const chat = createGeminiChatSession({
    temperature: 0,
    tools: [{ functionDeclarations: geminiTools }],
    toolConfig: {
      functionCallingConfig: {
        mode: FunctionCallingConfigMode.ANY,
        allowedFunctionNames: geminiTools
          .map((tool) => tool.name)
          .filter((name): name is string => Boolean(name)),
      },
    },
  })

  return {
    async sendPrompt(prompt) {
      const response = await chat.sendMessage({
        message: prompt,
      })

      return {
        text: response.text,
        functionCalls: normalizeFunctionCalls(response.functionCalls),
      }
    },
    async sendFunctionResponses(responses) {
      const parts: Part[] = responses.map((response) =>
        createPartFromFunctionResponse(response.callId, response.name, response.payload),
      )
      const result = await chat.sendMessage({
        message: parts,
      })

      return {
        text: result.text,
        functionCalls: normalizeFunctionCalls(result.functionCalls),
      }
    },
  }
}

interface OpenRouterToolCall {
  id?: string
  function?: {
    name?: string
    arguments?: string
  }
}

interface OpenRouterCompletionResponse {
  choices?: Array<{
    message?: {
      role?: string
      content?: string | null
      tool_calls?: OpenRouterToolCall[]
    }
  }>
}

type OpenRouterChatMessage =
  | {
      role: "user"
      content: string
    }
  | {
      role: "assistant"
      content: string | null
      tool_calls?: Array<{
        id?: string
        type: "function"
        function: {
          name: string
          arguments: string
        }
      }>
    }
  | {
      role: "tool"
      tool_call_id: string
      content: string
    }

function buildOpenRouterTools(tools: AgentToolDefinition[]) {
  return tools.map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parametersJsonSchema,
    },
  }))
}

function parseOpenRouterToolCalls(
  toolCalls: OpenRouterToolCall[] | undefined,
): AgentFunctionCall[] {
  return (toolCalls ?? [])
    .filter(
      (
        call,
      ): call is {
        id?: string
        function: { name: string; arguments?: string }
      } => Boolean(call.function?.name),
    )
    .map((call, index) => {
      let parsedArgs: Record<string, unknown> = {}

      if (call.function.arguments?.trim()) {
        try {
          const candidate = JSON.parse(call.function.arguments)
          if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
            parsedArgs = candidate as Record<string, unknown>
          }
        } catch {
          parsedArgs = {}
        }
      }

      return {
        id: call.id ?? `tool-call-${index + 1}`,
        name: call.function.name,
        args: parsedArgs,
      }
    })
}

function createOpenRouterAgentModelSession(tools: AgentToolDefinition[]): AgentModelSession {
  const config = getQueryLensAiConfig()

  if (!config.openrouterApiKey) {
    throw new Error("OPENROUTER_API_KEY is required to initialize OpenRouter.")
  }

  const messages: OpenRouterChatMessage[] = []
  const toolDefinitions = buildOpenRouterTools(tools)
  let pendingAssistantMessage: Extract<OpenRouterChatMessage, { role: "assistant" }> | undefined

  async function requestTurn(): Promise<AgentModelTurn> {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.openrouterApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.openrouterModel,
        messages,
        tools: toolDefinitions,
        tool_choice: "auto",
        temperature: 0,
      }),
    })

    if (!response.ok) {
      throw new Error(`OpenRouter tool-calling request failed with ${response.status}.`)
    }

    const payload = (await response.json()) as OpenRouterCompletionResponse
    const assistantMessage = payload.choices?.[0]?.message
    const functionCalls = parseOpenRouterToolCalls(assistantMessage?.tool_calls)

    pendingAssistantMessage = assistantMessage
      ? {
          role: "assistant",
          content: assistantMessage.content ?? null,
          tool_calls: assistantMessage.tool_calls?.map((toolCall) => ({
            id: toolCall.id,
            type: "function" as const,
            function: {
              name: toolCall.function?.name ?? "",
              arguments: toolCall.function?.arguments ?? "{}",
            },
          })),
        }
      : undefined

    return {
      text: assistantMessage?.content?.trim() ?? "",
      functionCalls,
    }
  }

  return {
    async sendPrompt(prompt) {
      messages.push({
        role: "user",
        content: prompt,
      })

      return requestTurn()
    },
    async sendFunctionResponses(responses) {
      if (pendingAssistantMessage) {
        messages.push(pendingAssistantMessage)
        pendingAssistantMessage = undefined
      }

      for (const response of responses) {
        messages.push({
          role: "tool",
          tool_call_id: response.callId,
          content: JSON.stringify(response.payload),
        })
      }

      return requestTurn()
    },
  }
}

export function createAgentModelSession(
  tools: AgentToolDefinition[],
): AgentModelSession {
  const config = getQueryLensAiConfig()

  if (config.reasoningProvider === "openrouter") {
    return createOpenRouterAgentModelSession(tools)
  }

  return createGeminiAgentModelSession(tools)
}
