import { formatContextualDateWindowLabel } from "@/lib/querylens/date-windows"
import { getScopeLabel } from "@/lib/querylens/dataset-semantics"
import {
  buildBreakdownFollowUpActions,
  buildBreakdownFollowUps,
} from "@/lib/querylens/follow-ups"
import { getSampleDataset } from "@/lib/querylens/seed-data"
import { calculateConfidenceScore, roundTo } from "@/lib/querylens/scoring"
import {
  aggregateAccountStressRows,
  getScaledLowBalanceDayThreshold,
} from "@/lib/querylens/server/range-aggregation"
import type { QueryLensDataAccess } from "@/lib/querylens/server/repositories"
import type {
  BreakdownDimension,
  DriverItem,
  EvidenceItem,
  Phase1AnalysisResponse,
  ScopeFilter,
  StructuredQueryPlan,
  WeeklyAccountStressRow,
} from "@/lib/querylens/types"

interface BreakdownExecutorArgs {
  dataAccess: QueryLensDataAccess
  plan: StructuredQueryPlan
  composeNarrative: unknown
}

interface BreakdownBucket {
  id: string
  label: string
  accountCount: number
  atRiskAccountCount: number
  lowBalanceAccountCount: number
  overdueAccountCount: number
  share: number
  scope: ScopeFilter
}

function getBucketId(row: WeeklyAccountStressRow, dimension: BreakdownDimension) {
  if (dimension === "region") {
    return row.regionId
  }

  if (dimension === "sector") {
    return row.sectorId
  }

  return `${row.regionId}:${row.sectorId}`
}

function getBucketLabel(row: WeeklyAccountStressRow, dimension: BreakdownDimension) {
  if (dimension === "region") {
    return row.regionName
  }

  if (dimension === "sector") {
    return row.sectorName
  }

  return `${row.regionName} / ${row.sectorName}`
}

function getBucketScope(row: WeeklyAccountStressRow, dimension: BreakdownDimension): ScopeFilter {
  if (dimension === "region") {
    return { region: row.regionId }
  }

  if (dimension === "sector") {
    return { sector: row.sectorId }
  }

  return {
    region: row.regionId,
    sector: row.sectorId,
  }
}

function buildBreakdownBuckets(
  rows: WeeklyAccountStressRow[],
  dimension: BreakdownDimension,
  lowBalanceDaysThreshold: number
) {
  const grouped = new Map<string, BreakdownBucket>()

  rows.forEach((row) => {
    const bucketId = getBucketId(row, dimension)
    const existing = grouped.get(bucketId)
    const isAtRisk = row.lowBalanceDays >= lowBalanceDaysThreshold || row.hasOverdue

    if (existing) {
      existing.accountCount += 1
      existing.atRiskAccountCount += isAtRisk ? 1 : 0
      existing.lowBalanceAccountCount +=
        row.lowBalanceDays >= lowBalanceDaysThreshold ? 1 : 0
      existing.overdueAccountCount += row.hasOverdue ? 1 : 0
      return
    }

    grouped.set(bucketId, {
      id: bucketId,
      label: getBucketLabel(row, dimension),
      accountCount: 1,
      atRiskAccountCount: isAtRisk ? 1 : 0,
      lowBalanceAccountCount:
        row.lowBalanceDays >= lowBalanceDaysThreshold ? 1 : 0,
      overdueAccountCount: row.hasOverdue ? 1 : 0,
      share: 0,
      scope: getBucketScope(row, dimension),
    })
  })

  const buckets = Array.from(grouped.values())
  const totalAtRisk = buckets.reduce(
    (total, bucket) => total + bucket.atRiskAccountCount,
    0
  )

  return {
    totalAtRisk,
    buckets: buckets
      .map((bucket) => ({
        ...bucket,
        share:
          totalAtRisk > 0
            ? roundTo((bucket.atRiskAccountCount / totalAtRisk) * 100, 1)
            : 0,
      }))
      .sort((left, right) => {
        if (right.atRiskAccountCount !== left.atRiskAccountCount) {
          return right.atRiskAccountCount - left.atRiskAccountCount
        }
        return right.overdueAccountCount - left.overdueAccountCount
      }),
  }
}

function buildDrivers(buckets: BreakdownBucket[]): DriverItem[] {
  return buckets.slice(0, 3).map((bucket, index) => ({
    id: `breakdown-${bucket.id}`,
    title:
      index === 0
        ? `${bucket.label} is the largest at-risk concentration`
        : `${bucket.label} remains a meaningful stress pocket`,
    impactLabel: `${bucket.atRiskAccountCount} accts · ${bucket.share.toFixed(1)}%`,
    direction: "negative" as const,
    description: `${bucket.lowBalanceAccountCount} accounts hit the low-balance threshold and ${bucket.overdueAccountCount} showed overdue exposure in the selected range.`,
  }))
}

function buildChartSpec(
  buckets: BreakdownBucket[],
  timeframeLabel: string,
  dimension: BreakdownDimension
) {
  return {
    type: "bar" as const,
    title: `At-risk accounts by ${dimension.replace("_", " ")} for ${timeframeLabel.toLowerCase()}`,
    xKey: "label" as const,
    yKey: "value" as const,
    data: buckets.map((bucket) => ({
      label: bucket.label,
      value: bucket.atRiskAccountCount,
      share: bucket.share,
    })),
    explanation:
      "The breakdown ranks where account stress is concentrated so the user can see the biggest pressure pockets first.",
  }
}

function buildAssumptions(
  scope: ScopeFilter,
  dimension: BreakdownDimension,
  lowBalanceDaysThreshold: number,
  dayCount: number
) {
  const assumptions = [
    `An account is counted at risk when it has at least ${lowBalanceDaysThreshold} low-balance day${lowBalanceDaysThreshold === 1 ? "" : "s"} or any overdue flag within the selected ${dayCount}-day window.`,
    `The breakdown groups results by ${dimension.replace("_", " ")} within the selected date window.`,
  ]

  if (!scope.region && !scope.sector) {
    assumptions.push("No additional region or sector filter was applied.")
  }

  return assumptions
}

export async function executeBreakdownPlan(
  args: BreakdownExecutorArgs
): Promise<Phase1AnalysisResponse> {
  const targetWindow = args.plan.comparisonWindow.targetWindow
  const activeScopeLabel = getScopeLabel(args.plan.scope)
  const dimension = args.plan.breakdownDimension ?? "region_sector"
  const dailyMetrics = await args.dataAccess.listDailyMetrics({
    startDate: targetWindow.startDate,
    endDate: targetWindow.endDate,
    scope: args.plan.scope,
  })
  const stressRows = aggregateAccountStressRows(dailyMetrics, targetWindow.startDate)
  const lowBalanceDaysThreshold = getScaledLowBalanceDayThreshold(targetWindow.dayCount)

  const { buckets, totalAtRisk } = buildBreakdownBuckets(
    stressRows,
    dimension,
    lowBalanceDaysThreshold
  )
  const totalAccounts = buckets.reduce(
    (total, bucket) => total + bucket.accountCount,
    0
  )
  const topBucket = buckets[0]

  const contextEvents = (
    await Promise.all(
      buckets.slice(0, 2).map((bucket) =>
        args.dataAccess.listContextEvents({
          targetStart: targetWindow.startDate,
          targetEnd: targetWindow.endDate,
          scope: bucket.scope,
        })
      )
    )
  ).flat()
  const timeframeLabel = formatContextualDateWindowLabel(targetWindow)

  const evidence: EvidenceItem[] = [
    {
      sourceType: "postgres",
      sourceName: "daily_account_metrics",
      timeRange: timeframeLabel,
      scope: activeScopeLabel,
      supportingFact: `${totalAtRisk} of ${totalAccounts} accounts met the at-risk threshold in the selected ${targetWindow.dayCount}-day window.`,
      queryTemplateId: "weekly_at_risk_rollup_v1",
    },
  ]

  if (topBucket) {
    evidence.push({
      sourceType: "postgres",
      sourceName: "daily_account_metrics",
      timeRange: timeframeLabel,
      scope: topBucket.label,
      supportingFact: `${topBucket.label} contributed ${topBucket.atRiskAccountCount} at-risk accounts, or ${topBucket.share.toFixed(1)}% of the total stress in the selected range.`,
      queryTemplateId: "at_risk_breakdown_bucket_v1",
    })
  }

  contextEvents.slice(0, 2).forEach((event) => {
    evidence.push({
      sourceType: "mongodb",
      sourceName: event.collection,
      timeRange: timeframeLabel,
      scope:
        event.regionName && event.sectorName
          ? `${event.regionName} / ${event.sectorName}`
          : event.regionName ?? event.sectorName ?? activeScopeLabel,
      supportingFact: `${event.summary} ${event.detail}`,
      queryTemplateId: `context_${event.collection}_breakdown_v1`,
    })
  })

  const drivers = buildDrivers(buckets)
  const dataset = getSampleDataset()
  const healthyPeerLabel =
    dimension === "region" || dimension === "sector"
      ? [...buckets]
          .reverse()
          .find(
            (bucket) =>
              bucket.label !== topBucket?.label && bucket.atRiskAccountCount >= 0,
          )?.label
      : undefined
  const topBucketRegionLabel = topBucket?.scope.region
    ? dataset.regions.find((region) => region.id === topBucket.scope.region)?.name
    : undefined
  const topBucketSectorLabel = topBucket?.scope.sector
    ? dataset.sectors.find((sector) => sector.id === topBucket.scope.sector)?.name
    : undefined
  const headline = topBucket
    ? `${topBucket.label} leads the at-risk account mix`
    : "No concentrated at-risk pocket was found in the selected range"
  const summary = topBucket
    ? `${totalAtRisk} of ${totalAccounts} accounts were flagged at risk in ${activeScopeLabel.toLowerCase()} for ${targetWindow.label}. ${topBucket.label} accounted for ${topBucket.atRiskAccountCount} of them, with the highest concentration of low-balance and overdue stress.`
    : `No accounts met the at-risk threshold in ${activeScopeLabel.toLowerCase()} for ${targetWindow.label}.`

  return {
    intent: "breakdown",
    headline,
    summary,
    metric: "at_risk_account_count",
    timeframe: timeframeLabel,
    comparisonBasis:
      "Share of at-risk accounts within the selected date window and breakdown view",
    confidence: calculateConfidenceScore({
      evidenceCount: evidence.length,
      driverCount: drivers.length,
      hasCrossSourceEvidence: evidence.some(
        (item) => item.sourceType === "mongodb"
      ),
      fallback: false,
    }),
    activeScope: activeScopeLabel,
    drivers,
    chartSpec: buildChartSpec(buckets, targetWindow.label, dimension),
    evidence,
    assumptions: buildAssumptions(
      args.plan.scope,
      dimension,
      lowBalanceDaysThreshold,
      targetWindow.dayCount
    ),
    supportedFollowUps: buildBreakdownFollowUps({
      targetWindow,
    }),
    followUpActions: buildBreakdownFollowUpActions({
      targetWindow,
      dimension,
      topBucketLabel: topBucket?.label,
      healthyPeerLabel,
      topBucketRegionLabel,
      topBucketSectorLabel,
    }),
    sourceMode: args.dataAccess.sourceMode,
  }
}
