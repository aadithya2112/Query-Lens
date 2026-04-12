import { calculateCashflowHealthScore, roundTo } from "@/lib/querylens/scoring"
import { getSampleDataset } from "@/lib/querylens/seed-data"
import type {
  DailyAccountMetric,
  ScopeType,
  WeeklyAccountStressRow,
  WeeklyMetricRow,
} from "@/lib/querylens/types"

function buildScopedMetricRow(args: {
  dailyMetrics: DailyAccountMetric[]
  startDate: string
  endDate: string
  recordType: ScopeType
  regionId: string | null
  sectorId: string | null
}) {
  const scoped = args.dailyMetrics.filter((metric) => {
    if (args.regionId && metric.regionId !== args.regionId) return false
    if (args.sectorId && metric.sectorId !== args.sectorId) return false
    return true
  })

  if (scoped.length === 0) {
    return undefined
  }

  const dataset = getSampleDataset()
  const regionNameById = new Map(dataset.regions.map((region) => [region.id, region.name]))
  const sectorNameById = new Map(dataset.sectors.map((sector) => [sector.id, sector.name]))
  const accountIds = Array.from(new Set(scoped.map((metric) => metric.accountId)))
  const openingBalance = roundTo(
    accountIds.reduce((total, accountId) => {
      const accountMetrics = scoped
        .filter((metric) => metric.accountId === accountId)
        .sort((left, right) => left.date.localeCompare(right.date))
      return total + (accountMetrics[0]?.endBalance ?? 0)
    }, 0),
    2
  )
  const closingBalance = roundTo(
    accountIds.reduce((total, accountId) => {
      const accountMetrics = scoped
        .filter((metric) => metric.accountId === accountId)
        .sort((left, right) => left.date.localeCompare(right.date))
      return total + (accountMetrics.at(-1)?.endBalance ?? 0)
    }, 0),
    2
  )
  const inboundPayments = roundTo(
    scoped.reduce((total, metric) => total + metric.inboundPayments, 0),
    2
  )
  const outboundPayments = roundTo(
    scoped.reduce((total, metric) => total + metric.outboundPayments, 0),
    2
  )
  const lowBalanceShare = roundTo(
    scoped.filter((metric) => metric.lowBalanceFlag).length / scoped.length,
    4
  )
  const overdueShare = roundTo(
    scoped.filter((metric) => metric.overdueFlag).length / scoped.length,
    4
  )
  const avgUtilization = roundTo(
    scoped.reduce((total, metric) => total + metric.loanUtilization, 0) / scoped.length,
    4
  )
  const score = calculateCashflowHealthScore({
    inboundPayments,
    outboundPayments,
    openingBalance,
    closingBalance,
    lowBalanceShare,
    overdueShare,
  })

  return {
    weekStart: args.startDate,
    weekEnd: args.endDate,
    recordType: args.recordType,
    regionId: args.regionId,
    sectorId: args.sectorId,
    regionName: args.regionId ? regionNameById.get(args.regionId) ?? null : null,
    sectorName: args.sectorId ? sectorNameById.get(args.sectorId) ?? null : null,
    accountCount: accountIds.length,
    inboundPayments,
    outboundPayments,
    openingBalance,
    closingBalance,
    lowBalanceShare,
    overdueShare,
    avgUtilization,
    inflowOutflowScore: score.inflowOutflowScore,
    balanceTrendScore: score.balanceTrendScore,
    lowBalanceScore: score.lowBalanceScore,
    overdueScore: score.overdueScore,
    cashflowHealthScore: score.cashflowHealthScore,
  } satisfies WeeklyMetricRow
}

export function aggregateMetricWindowRows(args: {
  dailyMetrics: DailyAccountMetric[]
  startDate: string
  endDate: string
}) {
  const dataset = getSampleDataset()
  const rows: WeeklyMetricRow[] = []
  const pushRow = (recordType: ScopeType, regionId: string | null, sectorId: string | null) => {
    const row = buildScopedMetricRow({
      dailyMetrics: args.dailyMetrics,
      startDate: args.startDate,
      endDate: args.endDate,
      recordType,
      regionId,
      sectorId,
    })

    if (row) {
      rows.push(row)
    }
  }

  pushRow("portfolio", null, null)
  dataset.regions.forEach((region) => pushRow("region", region.id, null))
  dataset.sectors.forEach((sector) => pushRow("sector", null, sector.id))
  dataset.regions.forEach((region) => {
    dataset.sectors.forEach((sector) => {
      pushRow("region_sector", region.id, sector.id)
    })
  })

  return rows
}

export function getDailyCoverageWindow(dailyMetrics: DailyAccountMetric[]) {
  const dates = dailyMetrics.map((metric) => metric.date).sort()

  return {
    startDate: dates[0],
    endDate: dates.at(-1) ?? dates[0],
  }
}

export function getScaledLowBalanceDayThreshold(dayCount: number) {
  return Math.max(1, Math.ceil((dayCount * 2) / 7))
}

export function aggregateAccountStressRows(
  dailyMetrics: DailyAccountMetric[],
  startDate: string
) {
  const dataset = getSampleDataset()
  const grouped = new Map<string, WeeklyAccountStressRow>()

  dailyMetrics.forEach((metric) => {
    const region = dataset.regions.find((candidate) => candidate.id === metric.regionId)
    const sector = dataset.sectors.find((candidate) => candidate.id === metric.sectorId)

    if (!region || !sector) {
      return
    }

    const existing = grouped.get(metric.accountId)

    if (existing) {
      existing.lowBalanceDays += metric.lowBalanceFlag ? 1 : 0
      existing.hasOverdue = existing.hasOverdue || metric.overdueFlag
      return
    }

    grouped.set(metric.accountId, {
      weekStart: startDate,
      accountId: metric.accountId,
      regionId: region.id,
      sectorId: sector.id,
      regionName: region.name,
      sectorName: sector.name,
      lowBalanceDays: metric.lowBalanceFlag ? 1 : 0,
      hasOverdue: metric.overdueFlag,
    })
  })

  return Array.from(grouped.values()).sort((left, right) =>
    left.accountId.localeCompare(right.accountId)
  )
}
