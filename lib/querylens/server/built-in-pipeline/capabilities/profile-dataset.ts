import { getDatasetDefinition } from "@/lib/querylens/datasets"
import { buildDiscoveryCatalogSections } from "@/lib/querylens/server/retrieval"
import type {
  CatalogSection,
  RetrievalContext,
  StructuredQueryPlan,
  WeeklyMetricRow,
} from "@/lib/querylens/types"
import {
  assertBuiltInCapability,
  type BuiltInCapabilityContext,
} from "@/lib/querylens/server/built-in-pipeline/capabilities/types"

export function buildCoverageLabel(weeklyRows: WeeklyMetricRow[]) {
  const portfolioRows = weeklyRows
    .filter((row) => row.recordType === "portfolio")
    .sort((left, right) => left.weekStart.localeCompare(right.weekStart))

  const first = portfolioRows[0]
  const last = portfolioRows.at(-1)

  if (!first || !last) {
    return "Coverage information is not currently available."
  }

  return `${first.weekStart} to ${last.weekEnd}`
}

export function prioritizeCatalogSections(args: {
  sections: CatalogSection[]
  plan: StructuredQueryPlan
  retrievalContext: RetrievalContext
}) {
  const matchedIds = new Set(
    args.retrievalContext.datasetMatches.map((match) => match.id),
  )
  const focusOrder = [
    args.plan.discoveryFocus === "overview" ? "dataset-overview" : null,
    args.plan.discoveryFocus === "metrics" ? "dataset-metrics" : null,
    args.plan.discoveryFocus === "sources" ? "dataset-sources" : null,
    args.plan.discoveryFocus === "dimensions" ? "dataset-dimensions" : null,
    args.plan.discoveryFocus === "time_coverage" ? "dataset-time-coverage" : null,
    args.plan.discoveryFocus === "questions" ? "dataset-supported-questions" : null,
  ].filter(Boolean)

  return [...args.sections].sort((left, right) => {
    const leftFocusIndex = focusOrder.indexOf(left.id)
    const rightFocusIndex = focusOrder.indexOf(right.id)

    if (leftFocusIndex !== -1 || rightFocusIndex !== -1) {
      if (leftFocusIndex === -1) return 1
      if (rightFocusIndex === -1) return -1
      return leftFocusIndex - rightFocusIndex
    }

    const leftMatched = matchedIds.has(left.id) ? 0 : 1
    const rightMatched = matchedIds.has(right.id) ? 0 : 1

    if (leftMatched !== rightMatched) {
      return leftMatched - rightMatched
    }

    return left.title.localeCompare(right.title)
  })
}

export async function profileDatasetCapability(args: {
  context: BuiltInCapabilityContext
  plan: StructuredQueryPlan
}) {
  assertBuiltInCapability(args.context, "profile_dataset")

  const dataset = getDatasetDefinition(args.plan.datasetId)
  const sourceHealth = await args.context.dataAccess.getSourceHealth()
  const coverageLabel = buildCoverageLabel(args.context.weeklyRows)
  const catalogSections = prioritizeCatalogSections({
    sections: buildDiscoveryCatalogSections(),
    plan: args.plan,
    retrievalContext: args.context.retrievalContext,
  }).slice(0, 4)

  return {
    dataset,
    sourceHealth,
    coverageLabel,
    catalogSections,
  }
}
