import type {
  ExecutionTrace,
  Phase1AnalysisResponse,
  TrustArtifactSource,
  TrustArtifacts,
  TrustComponentScore,
  TrustLevel,
  TrustModel,
  TrustScore,
  TrustTraceEntry,
} from "@/lib/querylens/types"
import type {
  BuiltInInterpretationSeed,
  BuiltInTrustContext,
} from "@/lib/querylens/server/built-in-pipeline/types"

const LOW_SCORE = 24
const MEDIUM_SCORE = 68
const MEDIUM_HIGH_SCORE = 82
const HIGH_SCORE = 92

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function toTrustLabel(score: number): TrustLevel {
  if (score >= 85) {
    return "high"
  }

  if (score >= 60) {
    return "medium"
  }

  return "low"
}

function createScore(score: number): TrustScore {
  const normalizedScore = clamp(Math.round(score), 0, 100)

  return {
    score: normalizedScore,
    label: toTrustLabel(normalizedScore),
  }
}

function createComponent(score: number, reason: string): TrustComponentScore {
  return {
    ...createScore(score),
    reason,
  }
}

function sentenceCase(value: string) {
  if (!value) {
    return value
  }

  return value.charAt(0).toUpperCase() + value.slice(1)
}

function uniqueList(values: string[]) {
  return [...new Set(values.filter(Boolean))]
}

function uniqueEvidenceSources(
  response: Pick<Phase1AnalysisResponse, "evidence">,
): TrustArtifactSource[] {
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

function mapSourceHealthToTrustSources(
  context: BuiltInTrustContext,
  response: Pick<Phase1AnalysisResponse, "activeScope">,
): TrustArtifactSource[] {
  if (!context.sourceHealth?.length) {
    return []
  }

  return context.sourceHealth.map((source) => ({
    sourceType: source.type,
    sourceName: source.name,
    scope: response.activeScope,
    timeRange: context.coverageLabel ?? "Current dataset coverage",
    note: source.detail,
  }))
}

function buildHowProduced(
  response: Pick<Phase1AnalysisResponse, "intent">,
): string[] {
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
    case "what_changed":
    default:
      return [
        "QueryLens validated the question against the current metric, timeframe, and scope before analysis.",
        "It compared grounded metric windows, ranked the biggest drivers, and attached corroborating context events where available.",
      ]
  }
}

function buildInterpretationComponent(
  interpretation: BuiltInInterpretationSeed,
): TrustComponentScore {
  switch (interpretation.mode) {
    case "guided_reroute":
      return createComponent(
        MEDIUM_SCORE,
        "The system mapped the request to the closest supported built-in analysis rather than answering the original wording directly.",
      )
    case "fallback":
      return createComponent(
        LOW_SCORE,
        "The request could not be matched to an approved built-in analysis path.",
      )
    case "direct":
    default:
      return createComponent(
        HIGH_SCORE,
        "The request matched a supported built-in analysis flow directly.",
      )
  }
}

function buildCoverageComponent(
  context: BuiltInTrustContext,
  response: Pick<Phase1AnalysisResponse, "evidence" | "fallback">,
): TrustComponentScore {
  if (response.fallback || context.coverageKind === "fallback") {
    return createComponent(
      LOW_SCORE,
      "The response is a guarded fallback rather than a completed grounded analysis.",
    )
  }

  if (context.coverageKind === "metadata_catalog") {
    return createComponent(
      MEDIUM_HIGH_SCORE,
      "Coverage is explicit and validated, but this trust score is based on metadata and source health rather than direct metric computation.",
    )
  }

  const failedCoverageCheck = context.validationResults?.some(
    (result) => result.check === "coverage" && result.status === "failed",
  )

  if (failedCoverageCheck || response.evidence.length === 0) {
    return createComponent(
      LOW_SCORE,
      "The required grounded windows or evidence were not fully resolved.",
    )
  }

  return createComponent(
    HIGH_SCORE,
    "All required analytic windows were approved and grounded evidence was produced for the response.",
  )
}

function buildSourceCorroborationComponent(
  context: BuiltInTrustContext,
  response: Pick<Phase1AnalysisResponse, "fallback">,
): TrustComponentScore {
  if (response.fallback || context.coverageKind === "fallback") {
    return createComponent(
      LOW_SCORE,
      "No corroborating evidence was attached because the answer fell back before grounded execution completed.",
    )
  }

  const observedSources = new Set(context.observedSources)
  const hasStructuredFacts = observedSources.has("postgres")
  const hasContextualEvidence = observedSources.has("mongodb")

  if (context.coverageKind === "metadata_catalog") {
    if (observedSources.size > 1) {
      return createComponent(
        MEDIUM_SCORE,
        "Discovery pulls from more than one source layer, but it remains a metadata-first answer instead of a fully corroborated analytic result.",
      )
    }

    return createComponent(
      MEDIUM_SCORE,
      "Discovery trust reflects explicit metadata and source health rather than cross-source analytical corroboration.",
    )
  }

  if (hasStructuredFacts && hasContextualEvidence) {
    return createComponent(
      HIGH_SCORE,
      "Structured facts were corroborated with contextual MongoDB evidence in the same supported answer.",
    )
  }

  if (observedSources.size >= 1) {
    return createComponent(
      MEDIUM_SCORE,
      "The answer is grounded in approved data, but only one source layer contributed supporting evidence.",
    )
  }

  return createComponent(
    LOW_SCORE,
    "No approved evidence sources were attached to corroborate the answer.",
  )
}

function buildExecutionComponent(
  context: BuiltInTrustContext,
  response: Pick<Phase1AnalysisResponse, "fallback">,
  executionTrace?: ExecutionTrace,
): TrustComponentScore {
  if (response.fallback || context.validationStatus === "rejected") {
    return createComponent(
      LOW_SCORE,
      "The deterministic execution path did not complete and QueryLens returned a guarded fallback.",
    )
  }

  const completedDispatch = executionTrace?.entries.some(
    (entry) => entry.stage === "dispatch" && entry.status === "completed",
  )

  if (context.validationStatus === "approved" && completedDispatch) {
    return createComponent(
      HIGH_SCORE,
      "The execution plan was approved and the deterministic built-in executor completed successfully.",
    )
  }

  if (context.validationStatus === "approved") {
    return createComponent(
      MEDIUM_HIGH_SCORE,
      "The execution plan was approved, but the final dispatch trace is not fully populated.",
    )
  }

  return createComponent(
    LOW_SCORE,
    "Execution confidence could not be established from an approved deterministic path.",
  )
}

function buildUncertaintyNotes(
  interpretation: BuiltInInterpretationSeed,
  context: BuiltInTrustContext,
): string[] {
  const notes = [...(context.uncertaintyNotes ?? [])]

  if (interpretation.mode === "guided_reroute") {
    notes.push(
      "QueryLens rerouted the question to the closest supported built-in analysis before execution.",
    )
  }

  if (context.coverageKind === "metadata_catalog") {
    notes.push(
      "Discovery trust is based on dataset metadata, source health, and retrieval context rather than direct metric computation.",
    )
  }

  return uniqueList(notes)
}

function buildLimitationNotes(
  response: Pick<Phase1AnalysisResponse, "fallback" | "summary">,
  context: BuiltInTrustContext,
  sourceCorroboration: TrustComponentScore,
): string[] {
  const notes = [...(context.limitationNotes ?? [])]

  if (response.fallback) {
    notes.push(response.summary)
  }

  context.validationResults
    ?.filter((result) => result.status === "failed")
    .forEach((result) => {
      notes.push(result.message)
    })

  if (
    context.coverageKind === "validated_analytics" &&
    sourceCorroboration.label !== "high"
  ) {
    notes.push(
      "This answer did not include cross-source contextual corroboration alongside the structured fact layer.",
    )
  }

  return uniqueList(notes)
}

function buildOverallScore(components: TrustModel["components"]) {
  return createScore(
    components.interpretation.score * 0.2 +
      components.dataCoverage.score * 0.3 +
      components.sourceCorroboration.score * 0.25 +
      components.execution.score * 0.25,
  )
}

function buildTrustTrace(components: TrustModel["components"]): TrustTraceEntry[] {
  return [
    {
      id: "trust.interpretation",
      component: "interpretation",
      score: components.interpretation.score,
      label: components.interpretation.label,
      message: components.interpretation.reason,
    },
    {
      id: "trust.data_coverage",
      component: "dataCoverage",
      score: components.dataCoverage.score,
      label: components.dataCoverage.label,
      message: components.dataCoverage.reason,
    },
    {
      id: "trust.source_corroboration",
      component: "sourceCorroboration",
      score: components.sourceCorroboration.score,
      label: components.sourceCorroboration.label,
      message: components.sourceCorroboration.reason,
    },
    {
      id: "trust.execution",
      component: "execution",
      score: components.execution.score,
      label: components.execution.label,
      message: components.execution.reason,
    },
  ]
}

export function buildTrustArtifactsFromModel(trust: TrustModel): TrustArtifacts {
  return {
    howProduced: trust.howProduced,
    sourcesUsed: trust.sources,
    directlyObserved: trust.observedFacts,
    inferred: trust.inferredFindings,
    assumptionsUsed: trust.assumptions,
  }
}

export function buildBuiltInTrustModel(args: {
  response: Pick<
    Phase1AnalysisResponse,
    | "activeScope"
    | "assumptions"
    | "drivers"
    | "evidence"
    | "fallback"
    | "headline"
    | "intent"
    | "summary"
  >
  interpretation: BuiltInInterpretationSeed
  executionTrace?: ExecutionTrace
  context: BuiltInTrustContext
}): TrustModel {
  const interpretation = buildInterpretationComponent(args.interpretation)
  const dataCoverage = buildCoverageComponent(args.context, args.response)
  const sourceCorroboration = buildSourceCorroborationComponent(
    args.context,
    args.response,
  )
  const execution = buildExecutionComponent(
    args.context,
    args.response,
    args.executionTrace,
  )
  const sources =
    args.context.coverageKind === "metadata_catalog"
      ? mapSourceHealthToTrustSources(args.context, args.response)
      : uniqueEvidenceSources(args.response)
  const observedFacts = args.response.evidence
    .slice(0, 3)
    .map((item) => sentenceCase(item.supportingFact))
  const inferredFindings = args.response.drivers
    .slice(0, 3)
    .map((driver) => sentenceCase(driver.description))

  if (observedFacts.length === 0 && args.response.summary) {
    observedFacts.push(sentenceCase(args.response.summary))
  }

  if (inferredFindings.length === 0 && args.response.headline) {
    inferredFindings.push(sentenceCase(args.response.headline))
  }

  const components = {
    interpretation,
    dataCoverage,
    sourceCorroboration,
    execution,
  }

  return {
    overall: buildOverallScore(components),
    components,
    trace: buildTrustTrace(components),
    howProduced: buildHowProduced(args.response),
    uncertaintyNotes: buildUncertaintyNotes(args.interpretation, args.context),
    limitationNotes: buildLimitationNotes(
      args.response,
      args.context,
      sourceCorroboration,
    ),
    sources,
    observedFacts,
    inferredFindings,
    assumptions: args.response.assumptions,
  }
}
