import { formatWeekLabel, getSampleDataset } from "@/lib/querylens/seed-data"
import { getWeekWindow } from "@/lib/querylens/reference-date"
import { calculateConfidenceScore, roundTo } from "@/lib/querylens/scoring"
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

const LOW_BALANCE_DAYS_THRESHOLD = 2

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

function getScopeLabel(scope: ScopeFilter) {
  const dataset = getSampleDataset()
  const regionName = scope.region
    ? dataset.regions.find((region) => region.id === scope.region)?.name
    : undefined
  const sectorName = scope.sector
    ? dataset.sectors.find((sector) => sector.id === scope.sector)?.name
    : undefined

  if (regionName && sectorName) {
    return `${regionName} / ${sectorName}`
  }

  if (regionName) {
    return regionName
  }

  if (sectorName) {
    return sectorName
  }

  return "Portfolio"
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
  dimension: BreakdownDimension
) {
  const grouped = new Map<string, BreakdownBucket>()

  rows.forEach((row) => {
    const bucketId = getBucketId(row, dimension)
    const existing = grouped.get(bucketId)
    const isAtRisk =
      row.lowBalanceDays >= LOW_BALANCE_DAYS_THRESHOLD || row.hasOverdue

    if (existing) {
      existing.accountCount += 1
      existing.atRiskAccountCount += isAtRisk ? 1 : 0
      existing.lowBalanceAccountCount +=
        row.lowBalanceDays >= LOW_BALANCE_DAYS_THRESHOLD ? 1 : 0
      existing.overdueAccountCount += row.hasOverdue ? 1 : 0
      return
    }

    grouped.set(bucketId, {
      id: bucketId,
      label: getBucketLabel(row, dimension),
      accountCount: 1,
      atRiskAccountCount: isAtRisk ? 1 : 0,
      lowBalanceAccountCount:
        row.lowBalanceDays >= LOW_BALANCE_DAYS_THRESHOLD ? 1 : 0,
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
    description: `${bucket.lowBalanceAccountCount} accounts hit the low-balance threshold and ${bucket.overdueAccountCount} showed overdue exposure in the selected week.`,
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
      "The breakdown ranks where weekly account stress is concentrated so the user can see the biggest pressure pockets first.",
  }
}

function buildAssumptions(scope: ScopeFilter, dimension: BreakdownDimension) {
  const assumptions = [
    "An account is counted at risk when it has at least 2 low-balance days or any overdue flag during the selected week.",
    `The breakdown groups results by ${dimension.replace("_", " ")} within the selected weekly window.`,
  ]

  if (!scope.region && !scope.sector) {
    assumptions.push("No additional region or sector filter was applied.")
  }

  return assumptions
}

export async function executeBreakdownPlan(
  args: BreakdownExecutorArgs
): Promise<Phase1AnalysisResponse> {
  const timeframe = getWeekWindow(args.plan.timeframe)
  const activeScopeLabel = getScopeLabel(args.plan.scope)
  const dimension = args.plan.breakdownDimension ?? "region_sector"
  const stressRows = await args.dataAccess.listWeeklyAccountStress({
    targetStart: timeframe.targetStart,
    scope: args.plan.scope,
  })

  const { buckets, totalAtRisk } = buildBreakdownBuckets(stressRows, dimension)
  const totalAccounts = buckets.reduce(
    (total, bucket) => total + bucket.accountCount,
    0
  )
  const topBucket = buckets[0]

  const contextEvents = (
    await Promise.all(
      buckets.slice(0, 2).map((bucket) =>
        args.dataAccess.listContextEvents({
          targetStart: timeframe.targetStart,
          targetEnd: timeframe.targetEnd,
          scope: bucket.scope,
        })
      )
    )
  ).flat()

  const evidence: EvidenceItem[] = [
    {
      sourceType: "postgres",
      sourceName: "daily_account_metrics",
      timeRange: `Selected week (${formatWeekLabel(timeframe.targetStart)})`,
      scope: activeScopeLabel,
      supportingFact: `${totalAtRisk} of ${totalAccounts} accounts met the weekly at-risk threshold in the selected window.`,
      queryTemplateId: "weekly_at_risk_rollup_v1",
    },
  ]

  if (topBucket) {
    evidence.push({
      sourceType: "postgres",
      sourceName: "daily_account_metrics",
      timeRange: `Selected week (${formatWeekLabel(timeframe.targetStart)})`,
      scope: topBucket.label,
      supportingFact: `${topBucket.label} contributed ${topBucket.atRiskAccountCount} at-risk accounts, or ${topBucket.share.toFixed(1)}% of the total weekly stress.`,
      queryTemplateId: "at_risk_breakdown_bucket_v1",
    })
  }

  contextEvents.slice(0, 2).forEach((event) => {
    evidence.push({
      sourceType: "mongodb",
      sourceName: event.collection,
      timeRange: `Selected week (${formatWeekLabel(timeframe.targetStart)})`,
      scope:
        event.regionName && event.sectorName
          ? `${event.regionName} / ${event.sectorName}`
          : event.regionName ?? event.sectorName ?? activeScopeLabel,
      supportingFact: `${event.summary} ${event.detail}`,
      queryTemplateId: `context_${event.collection}_breakdown_v1`,
    })
  })

  const drivers = buildDrivers(buckets)
  const headline = topBucket
    ? `${topBucket.label} leads the at-risk account mix`
    : "No concentrated at-risk pocket was found in the selected week"
  const summary = topBucket
    ? `${totalAtRisk} of ${totalAccounts} accounts were flagged at risk in ${activeScopeLabel.toLowerCase()} for ${formatWeekLabel(
        timeframe.targetStart
      )}. ${topBucket.label} accounted for ${topBucket.atRiskAccountCount} of them, with the highest concentration of low-balance and overdue stress.`
    : `No accounts met the weekly at-risk threshold in ${activeScopeLabel.toLowerCase()} for ${formatWeekLabel(
        timeframe.targetStart
      )}.`

  return {
    headline,
    summary,
    metric: "at_risk_account_count",
    timeframe: `Selected week (${formatWeekLabel(timeframe.targetStart)})`,
    comparisonBasis:
      "Share of weekly at-risk accounts within the selected breakdown view",
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
    chartSpec: buildChartSpec(buckets, formatWeekLabel(timeframe.targetStart), dimension),
    evidence,
    assumptions: buildAssumptions(args.plan.scope, dimension),
    supportedFollowUps: [
      "Break down at-risk accounts by region this week",
      "Break down at-risk accounts by sector last week",
      "Why did SME cashflow health drop last week?",
    ],
    sourceMode: args.dataAccess.sourceMode,
  }
}
