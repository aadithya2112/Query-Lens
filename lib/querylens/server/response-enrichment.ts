import type {
  InterpretationMetadata,
  InterpretationMode,
  Phase1AnalysisResponse,
  TrustArtifactSource,
  TrustArtifacts,
} from "@/lib/querylens/types"

function sentenceCase(value: string) {
  if (!value) {
    return value
  }

  return value.charAt(0).toUpperCase() + value.slice(1)
}

function toSentenceFragment(value: string) {
  if (!value) {
    return value
  }

  return value.charAt(0).toLowerCase() + value.slice(1)
}

function uniqueSources(response: Phase1AnalysisResponse): TrustArtifactSource[] {
  const seen = new Set<string>()

  return response.evidence.flatMap((item) => {
    const key = `${item.sourceType}:${item.sourceName}:${item.scope}:${item.timeRange}`

    if (seen.has(key)) {
      return []
    }

    seen.add(key)

    return [
      {
        sourceType: item.sourceType,
        sourceName: item.sourceName,
        scope: item.scope,
        timeRange: item.timeRange,
        note: item.supportingFact,
      },
    ]
  })
}

function buildHowProduced(response: Phase1AnalysisResponse) {
  switch (response.intent) {
    case "discovery":
      return [
        "QueryLens retrieved dataset metadata and source-health context before answering.",
        "The response stayed within the shipped dataset catalog, source coverage, and supported analytical paths.",
      ]
    case "breakdown":
      return [
        "QueryLens validated the request against the current dataset, timeframe, and supported breakdown dimensions.",
        "It rolled up account-level stress into ranked buckets and then attached corroborating context events where available.",
      ]
    case "compare":
      return [
        "QueryLens validated the compare request and assembled the two sides from grounded weekly metric rows.",
        "It highlighted the biggest component gaps and attached contextual corroboration when it existed.",
      ]
    case "agentic_query":
      return [
        "QueryLens used the guarded live-query path to stay inside approved read-only sources.",
        "The answer was built from executed query results and then summarized into a user-facing response.",
      ]
    case "what_changed":
    default:
      return [
        "QueryLens validated the question against the current metric, timeframe, and scope before analysis.",
        "It compared grounded metric windows, ranked the biggest drivers, and attached corroborating context events where available.",
      ]
  }
}

export function buildInterpretation(args: {
  mode: InterpretationMode
  originalQuestion: string
  resolvedQuestion?: string
  explanation: string
}): InterpretationMetadata {
  return {
    mode: args.mode,
    originalQuestion: args.originalQuestion,
    resolvedQuestion: args.resolvedQuestion,
    explanation: args.explanation,
  }
}

export function buildTrustArtifacts(
  response: Phase1AnalysisResponse,
): TrustArtifacts {
  const directlyObserved = response.evidence
    .slice(0, 3)
    .map((item) => sentenceCase(item.supportingFact))

  const inferred = response.drivers
    .slice(0, 3)
    .map((driver) => sentenceCase(driver.description))

  if (directlyObserved.length === 0 && response.summary) {
    directlyObserved.push(sentenceCase(response.summary))
  }

  if (inferred.length === 0 && response.headline) {
    inferred.push(sentenceCase(response.headline))
  }

  return {
    howProduced: buildHowProduced(response),
    sourcesUsed: uniqueSources(response),
    directlyObserved,
    inferred,
    assumptionsUsed: response.assumptions,
  }
}

export function buildLeadershipSummaryResponse(args: {
  question: string
  sourceAnalysis: Phase1AnalysisResponse
}): Phase1AnalysisResponse {
  const { sourceAnalysis } = args
  const firstDriver = sourceAnalysis.drivers[0]
  const supportingSources = uniqueSources(sourceAnalysis)
    .slice(0, 2)
    .map((source) => source.sourceName)
  const supportingSourceLabel =
    supportingSources.length > 0
      ? `This is grounded in ${supportingSources.join(" and ")}.`
      : "This stays grounded in the current validated QueryLens evidence."

  const summaryParts = [
    `${sourceAnalysis.activeScope} is the main area to watch for ${toSentenceFragment(sourceAnalysis.timeframe)}.`,
    firstDriver
      ? sentenceCase(firstDriver.description)
      : sentenceCase(sourceAnalysis.summary),
    supportingSourceLabel,
  ]

  const summary = summaryParts.join(" ")
  const derivedResponse: Phase1AnalysisResponse = {
    ...sourceAnalysis,
    headline: `Leadership summary: ${sourceAnalysis.activeScope}`,
    summary,
    comparisonBasis: `Leadership-ready summary derived from the current grounded ${sourceAnalysis.intent.replace(
      "_",
      " ",
    )} analysis`,
    drivers: sourceAnalysis.drivers.slice(0, 2),
    evidence: sourceAnalysis.evidence.slice(0, 3),
    interpretation: buildInterpretation({
      mode: "direct",
      originalQuestion: args.question,
      explanation:
        "QueryLens reused the current grounded analysis and rewrote it into a short leadership-ready summary instead of replanning the analysis.",
    }),
    presentationMode: "leadership_summary",
    followUpActions: (sourceAnalysis.followUpActions ?? []).filter(
      (action) => action.actionType !== "leadership_summary",
    ),
  }

  return {
    ...derivedResponse,
    trustArtifacts: buildTrustArtifacts(derivedResponse),
  }
}

