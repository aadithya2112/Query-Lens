export type QueryLensAiMode = "auto" | "deterministic" | "gemini"
export type QueryLensExecutionContext = "bootstrap" | "interactive"

export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash"

function resolveAiMode(value: string | undefined): QueryLensAiMode {
  if (value === "deterministic" || value === "gemini") {
    return value
  }

  return "auto"
}

export function getQueryLensAiConfig() {
  const apiKey = process.env.GEMINI_API_KEY?.trim()

  return {
    mode: resolveAiMode(process.env.QUERYLENS_AI_MODE),
    apiKey: apiKey ? apiKey : undefined,
    model: process.env.QUERYLENS_GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL,
  }
}

export function shouldUseGemini(executionContext: QueryLensExecutionContext) {
  const config = getQueryLensAiConfig()

  if (executionContext === "bootstrap") {
    return false
  }

  if (config.mode === "deterministic") {
    return false
  }

  return Boolean(config.apiKey)
}
