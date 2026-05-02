export type QueryLensAiMode = "auto" | "deterministic" | "gemini"
export type QueryLensExecutionContext = "bootstrap" | "interactive"
export type QueryLensReasoningProvider = "deterministic" | "gemini" | "openrouter"

export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash"
export const DEFAULT_OPENROUTER_MODEL = "deepseek/deepseek-v4-pro"

function resolveAiMode(value: string | undefined): QueryLensAiMode {
  if (value === "deterministic" || value === "gemini") {
    return value
  }

  return "auto"
}

export function getQueryLensAiConfig() {
  const apiKey = process.env.GEMINI_API_KEY?.trim()
  const openrouterApiKey = process.env.OPENROUTER_API_KEY?.trim()
  const requestedProvider =
    process.env.QUERYLENS_MODEL_PROVIDER?.trim() as
      | QueryLensReasoningProvider
      | undefined

  let reasoningProvider: QueryLensReasoningProvider
  if (requestedProvider === "deterministic" || requestedProvider === "gemini" || requestedProvider === "openrouter") {
    reasoningProvider = requestedProvider
  } else if (openrouterApiKey) {
    reasoningProvider = "openrouter"
  } else if (apiKey) {
    reasoningProvider = "gemini"
  } else {
    reasoningProvider = "deterministic"
  }

  return {
    mode: resolveAiMode(process.env.QUERYLENS_AI_MODE),
    apiKey: apiKey ? apiKey : undefined,
    openrouterApiKey: openrouterApiKey ? openrouterApiKey : undefined,
    model: process.env.QUERYLENS_GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL,
    openrouterModel:
      process.env.QUERYLENS_OPENROUTER_MODEL?.trim() ||
      DEFAULT_OPENROUTER_MODEL,
    reasoningProvider,
  }
}

export function isDeterministicAiMode() {
  return getQueryLensAiConfig().mode === "deterministic"
}

export function canUseGemini(executionContext: QueryLensExecutionContext) {
  const config = getQueryLensAiConfig()

  if (executionContext === "bootstrap") {
    return false
  }

  if (config.mode === "deterministic") {
    return false
  }

  return Boolean(config.apiKey)
}

export function requiresGeminiPlanning(executionContext: QueryLensExecutionContext) {
  if (executionContext === "bootstrap") {
    return false
  }

  return !isDeterministicAiMode()
}

export function canUseReasoningProvider(executionContext: QueryLensExecutionContext) {
  if (executionContext === "bootstrap") {
    return false
  }

  const config = getQueryLensAiConfig()
  if (config.reasoningProvider === "deterministic") {
    return false
  }

  if (config.reasoningProvider === "gemini") {
    return Boolean(config.apiKey)
  }

  return Boolean(config.openrouterApiKey)
}
