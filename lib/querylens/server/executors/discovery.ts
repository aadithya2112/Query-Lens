import { calculateConfidenceScore } from "@/lib/querylens/scoring"
import {
  profileDatasetCapability,
  type BuiltInCapabilityContext,
} from "@/lib/querylens/server/built-in-pipeline/capabilities"
import type { DiscoveryExecutionPayload } from "@/lib/querylens/server/built-in-pipeline/types"
import type {
  DriverItem,
  RetrievalContext,
  SourceHealth,
  StructuredQueryPlan,
  WeeklyMetricRow,
} from "@/lib/querylens/types"

interface DiscoveryExecutorArgs {
  context: BuiltInCapabilityContext
  plan: StructuredQueryPlan
  weeklyRows: WeeklyMetricRow[]
  dataAccess: {
    sourceMode: "database" | "fixture"
  }
  retrievalContext: RetrievalContext
}

function buildChartSpec(sourceHealth: SourceHealth[], sectionCount: number) {
  return {
    type: "bar" as const,
    title: "Dataset overview",
    xKey: "label" as const,
    yKey: "value" as const,
    data: [
      ...sourceHealth.map((source) => ({
        label: source.name,
        value: source.recordCount ?? 0,
      })),
      {
        label: "Catalog sections",
        value: sectionCount,
      },
    ],
    explanation:
      "The discovery view summarizes the active dataset, connected sources, and the metadata QueryLens can retrieve before planning analytical questions.",
  }
}

function buildDiscoveryDrivers(args: {
  sourceHealth: SourceHealth[]
  metricCount: number
  coverageLabel: string
}): DriverItem[] {
  return [
    {
      id: "dataset-metrics",
      title: `${args.metricCount} metrics are available right now`,
      impactLabel: `${args.metricCount} metrics`,
      direction: "positive",
      description:
        "The current sample dataset supports cashflow health analysis, at-risk account breakdowns, and metadata discovery.",
    },
    {
      id: "dataset-sources",
      title: `${args.sourceHealth.length} source layers are active`,
      impactLabel: `${args.sourceHealth.length} sources`,
      direction: "positive",
      description:
        "QueryLens can ground answers with structured facts, contextual signals, and the semantic metric manifest.",
    },
    {
      id: "dataset-coverage",
      title: "Weekly coverage is bounded and explicit",
      impactLabel: args.coverageLabel,
      direction: "positive",
      description:
        "Time coverage is explicitly known, which keeps discovery answers and follow-up analytics within safe dataset boundaries.",
    },
  ]
}

export async function executeDiscoveryPlan(
  args: DiscoveryExecutorArgs
): Promise<DiscoveryExecutionPayload> {
  const { dataset, sourceHealth, coverageLabel, catalogSections } =
    await profileDatasetCapability({
      context: args.context,
      plan: args.plan,
    })

  const evidence = [
    ...sourceHealth.map((source) => ({
      sourceType:
        source.type === "manifest" ? "postgres" : (source.type as "postgres" | "mongodb"),
      sourceName: source.name,
      timeRange: coverageLabel,
      scope: dataset.label,
      supportingFact: `${source.detail}`,
      queryTemplateId: `discovery_${source.id}_v1`,
    })),
    ...args.retrievalContext.datasetMatches.slice(0, 3).map((match) => ({
      sourceType: "postgres" as const,
      sourceName: "Dataset catalog",
      timeRange: "Metadata retrieval",
      scope: match.title,
      supportingFact: match.content,
      queryTemplateId: `catalog_${match.id}_v1`,
    })),
  ]

  return {
    kind: "success",
    intent: "discovery",
    plan: args.plan,
    metric: "dataset_catalog",
    timeframe: `Coverage: ${coverageLabel}`,
    comparisonBasis: "Catalog, source, and metadata overview",
    confidence: calculateConfidenceScore({
      evidenceCount: evidence.length,
      driverCount: catalogSections.length,
      hasCrossSourceEvidence: sourceHealth.some((source) => source.type === "mongodb"),
      fallback: false,
    }),
    activeScope: dataset.label,
    drivers: buildDiscoveryDrivers({
      sourceHealth,
      metricCount: dataset.metrics.length,
      coverageLabel,
    }),
    chartSpec: buildChartSpec(sourceHealth, catalogSections.length),
    evidence,
    assumptions: [
      "Discovery answers are built from retrieved metadata, source health, and the current sample dataset boundaries.",
      "Analytical answers still require a supported metric, timeframe, and intent after planning.",
    ],
    discoverySummary: {
      datasetLabel: dataset.label,
      sourceLabels: sourceHealth.map((source) => source.name),
      metricCount: dataset.metrics.length,
      timeCoverage: coverageLabel,
      dimensionLabels: dataset.dimensions,
    },
    catalogSections,
    sourceMode: args.dataAccess.sourceMode,
    presentation: {
      datasetLabel: dataset.label,
      metricCount: dataset.metrics.length,
      supportedIntentCount: dataset.supportedIntentIds.length,
      sourceHealth,
      coverageLabel,
    },
  }
}
