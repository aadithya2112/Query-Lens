import { addDays, addWeeks, endOfWeek, format, startOfWeek } from "date-fns"

import { getReferenceDate, toIsoDate } from "@/lib/querylens/reference-date"
import {
  calculateCashflowHealthScore,
  clamp,
  roundTo,
} from "@/lib/querylens/scoring"
import type {
  Account,
  ContextCollection,
  ContextEvent,
  DailyAccountMetric,
  Region,
  ScopeType,
  Sector,
  SeedDataset,
  WeeklyMetricRow,
} from "@/lib/querylens/types"

const DAILY_PATTERN = [0.93, 0.98, 1.01, 1.04, 1.08, 1.12, 0.9]
const DETERMINISTIC_SWING = [0.97, 1.01, 1.04, 0.99, 1.03, 0.96, 1.02]

const REGIONS: Region[] = [
  { id: "north_west", name: "North West" },
  { id: "london_south_east", name: "London & South East" },
  { id: "midlands", name: "Midlands" },
]

const SECTORS: Sector[] = [
  { id: "hospitality", name: "Hospitality" },
  { id: "retail", name: "Retail" },
  { id: "professional_services", name: "Professional Services" },
]

const REGION_FACTORS = {
  north_west: { inbound: 1.02, outbound: 0.99, balance: 1.01, utilization: 0.02 },
  london_south_east: {
    inbound: 1.1,
    outbound: 1.07,
    balance: 1.08,
    utilization: -0.01,
  },
  midlands: { inbound: 0.96, outbound: 0.95, balance: 0.97, utilization: 0.01 },
} as const

const SECTOR_FACTORS = {
  hospitality: { inbound: 0.92, outbound: 1.04, balance: 0.94, utilization: 0.08 },
  retail: { inbound: 1.01, outbound: 0.99, balance: 1.0, utilization: 0.03 },
  professional_services: {
    inbound: 1.08,
    outbound: 0.9,
    balance: 1.12,
    utilization: -0.04,
  },
} as const

function getScenarioModifier(
  weekIndex: number,
  regionId: string,
  sectorId: string
) {
  const gradualRecovery = 0.97 + weekIndex * 0.011

  const scenario = {
    inboundModifier: gradualRecovery,
    outboundModifier: 0.95 + weekIndex * 0.008,
    balanceModifier: 0.98 + weekIndex * 0.01,
    utilizationShift: -0.015 + weekIndex * 0.003,
    lowBalanceShift: Math.max(0, 0.085 - weekIndex * 0.004),
    overdueShift: Math.max(0, 0.045 - weekIndex * 0.0025),
  }

  if (weekIndex === 10) {
    if (regionId === "north_west" && sectorId === "hospitality") {
      scenario.inboundModifier *= 0.72
      scenario.outboundModifier *= 1.19
      scenario.balanceModifier *= 0.78
      scenario.utilizationShift += 0.2
      scenario.lowBalanceShift += 0.24
      scenario.overdueShift += 0.14
    } else if (sectorId === "hospitality") {
      scenario.inboundModifier *= 0.91
      scenario.outboundModifier *= 1.08
      scenario.balanceModifier *= 0.93
      scenario.utilizationShift += 0.07
      scenario.lowBalanceShift += 0.05
      scenario.overdueShift += 0.03
    } else if (regionId === "north_west") {
      scenario.inboundModifier *= 0.95
      scenario.outboundModifier *= 1.03
      scenario.balanceModifier *= 0.96
      scenario.utilizationShift += 0.04
      scenario.lowBalanceShift += 0.03
    }
  }

  if (weekIndex === 11) {
    if (regionId === "north_west" && sectorId === "hospitality") {
      scenario.inboundModifier *= 0.82
      scenario.outboundModifier *= 1.11
      scenario.balanceModifier *= 0.88
      scenario.utilizationShift += 0.1
      scenario.lowBalanceShift += 0.12
      scenario.overdueShift += 0.07
    } else if (sectorId === "hospitality") {
      scenario.inboundModifier *= 0.96
      scenario.outboundModifier *= 1.02
    }
  }

  return scenario
}

function buildAccounts(): Account[] {
  const segments: Account["segment"][] = ["starter", "growth", "established"]
  const accounts: Account[] = []

  REGIONS.forEach((region, regionIndex) => {
    SECTORS.forEach((sector, sectorIndex) => {
      for (let index = 0; index < 2; index += 1) {
        const variant = regionIndex * 6 + sectorIndex * 2 + index + 1
        const regionFactor = REGION_FACTORS[region.id as keyof typeof REGION_FACTORS]
        const sectorFactor = SECTOR_FACTORS[sector.id as keyof typeof SECTOR_FACTORS]
        const baseDailyInbound = roundTo(
          8_000 * regionFactor.inbound * sectorFactor.inbound * (1 + index * 0.08),
          2
        )
        const baseDailyOutbound = roundTo(
          6_900 * regionFactor.outbound * sectorFactor.outbound * (1 + index * 0.06),
          2
        )
        const baseBalance = roundTo(
          98_000 * regionFactor.balance * sectorFactor.balance * (1 + index * 0.04),
          2
        )

        accounts.push({
          id: `acc_${variant.toString().padStart(2, "0")}`,
          businessName: `${region.name} ${sector.name} ${index + 1}`,
          regionId: region.id,
          sectorId: sector.id,
          segment: segments[(regionIndex + sectorIndex + index) % segments.length],
          lowBalanceThreshold:
            sector.id === "hospitality" ? 34_000 : sector.id === "retail" ? 30_000 : 26_000,
          baseDailyInbound,
          baseDailyOutbound,
          baseBalance,
          baseUtilization: clamp(
            0.38 + regionFactor.utilization + sectorFactor.utilization + index * 0.03,
            0.15,
            0.82
          ),
        })
      }
    })
  })

  return accounts
}

function buildDailyMetrics(accounts: Account[]): DailyAccountMetric[] {
  const referenceDate = getReferenceDate()
  const currentWeekStart = startOfWeek(referenceDate, { weekStartsOn: 1 })
  const weekStarts = Array.from({ length: 12 }, (_, index) =>
    addWeeks(currentWeekStart, index - 11)
  )

  const metrics: DailyAccountMetric[] = []

  accounts.forEach((account, accountIndex) => {
    weekStarts.forEach((weekStart, weekIndex) => {
      const regionFactor = REGION_FACTORS[account.regionId as keyof typeof REGION_FACTORS]
      const sectorFactor = SECTOR_FACTORS[account.sectorId as keyof typeof SECTOR_FACTORS]
      const scenario = getScenarioModifier(weekIndex, account.regionId, account.sectorId)

      let runningBalance =
        account.baseBalance * scenario.balanceModifier * (1 + weekIndex * 0.002)

      for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
        const swing =
          DETERMINISTIC_SWING[(accountIndex + weekIndex + dayIndex) % DETERMINISTIC_SWING.length]
        const dayDate = addDays(weekStart, dayIndex)
        const inbound = roundTo(
          account.baseDailyInbound *
            regionFactor.inbound *
            sectorFactor.inbound *
            scenario.inboundModifier *
            DAILY_PATTERN[dayIndex] *
            swing,
          2
        )
        const outbound = roundTo(
          account.baseDailyOutbound *
            regionFactor.outbound *
            sectorFactor.outbound *
            scenario.outboundModifier *
            DAILY_PATTERN[(dayIndex + 2) % DAILY_PATTERN.length] *
            DETERMINISTIC_SWING[(accountIndex + weekIndex + dayIndex + 2) % DETERMINISTIC_SWING.length],
          2
        )
        const loanUtilization = roundTo(
          clamp(
            account.baseUtilization +
              scenario.utilizationShift +
              (dayIndex >= 4 ? 0.02 : 0) +
              (dayIndex === 6 ? 0.01 : 0),
            0.12,
            0.98
          ),
          3
        )

        runningBalance = roundTo(
          Math.max(7_000, runningBalance + inbound - outbound - loanUtilization * 320),
          2
        )

        const lowBalanceFlag = runningBalance < account.lowBalanceThreshold
        const overdueFlag =
          runningBalance < account.lowBalanceThreshold * 0.78 || loanUtilization > 0.83

        metrics.push({
          accountId: account.id,
          date: toIsoDate(dayDate),
          weekStart: toIsoDate(weekStart),
          regionId: account.regionId,
          sectorId: account.sectorId,
          inboundPayments: inbound,
          outboundPayments: outbound,
          endBalance: runningBalance,
          loanUtilization,
          lowBalanceFlag,
          overdueFlag,
        })
      }
    })
  })

  return metrics
}

function buildWeeklyMetrics(
  accounts: Account[],
  dailyMetrics: DailyAccountMetric[]
): WeeklyMetricRow[] {
  const accountById = new Map(accounts.map((account) => [account.id, account]))
  const regionNameById = new Map(REGIONS.map((region) => [region.id, region.name]))
  const sectorNameById = new Map(SECTORS.map((sector) => [sector.id, sector.name]))
  const weekStarts = Array.from(new Set(dailyMetrics.map((item) => item.weekStart))).sort()

  const rows: WeeklyMetricRow[] = []

  const makeRow = (
    weekStart: string,
    recordType: ScopeType,
    regionId: string | null,
    sectorId: string | null
  ) => {
    const scoped = dailyMetrics.filter((metric) => {
      if (metric.weekStart !== weekStart) return false
      if (regionId && metric.regionId !== regionId) return false
      if (sectorId && metric.sectorId !== sectorId) return false
      return true
    })

    if (scoped.length === 0) {
      return
    }

    const accountIds = Array.from(new Set(scoped.map((item) => item.accountId)))
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
    const scores = calculateCashflowHealthScore({
      inboundPayments,
      outboundPayments,
      openingBalance,
      closingBalance,
      lowBalanceShare,
      overdueShare,
    })

    rows.push({
      weekStart,
      weekEnd: toIsoDate(endOfWeek(new Date(`${weekStart}T00:00:00`), { weekStartsOn: 1 })),
      recordType,
      regionId,
      sectorId,
      regionName: regionId ? regionNameById.get(regionId) ?? null : null,
      sectorName: sectorId ? sectorNameById.get(sectorId) ?? null : null,
      accountCount: accountIds.length,
      inboundPayments,
      outboundPayments,
      openingBalance,
      closingBalance,
      lowBalanceShare,
      overdueShare,
      avgUtilization,
      inflowOutflowScore: scores.inflowOutflowScore,
      balanceTrendScore: scores.balanceTrendScore,
      lowBalanceScore: scores.lowBalanceScore,
      overdueScore: scores.overdueScore,
      cashflowHealthScore: scores.cashflowHealthScore,
    })
  }

  weekStarts.forEach((weekStart) => {
    makeRow(weekStart, "portfolio", null, null)
    REGIONS.forEach((region) => makeRow(weekStart, "region", region.id, null))
    SECTORS.forEach((sector) => makeRow(weekStart, "sector", null, sector.id))
    REGIONS.forEach((region) => {
      SECTORS.forEach((sector) => {
        makeRow(weekStart, "region_sector", region.id, sector.id)
      })
    })
  })

  return rows.sort((left, right) => {
    const startSort = left.weekStart.localeCompare(right.weekStart)
    if (startSort !== 0) return startSort
    return left.recordType.localeCompare(right.recordType)
  })
}

function buildContextEvents(
  weeklyMetrics: WeeklyMetricRow[]
): Record<ContextCollection, ContextEvent[]> {
  const lastWeekStart = weeklyMetrics
    .filter((row) => row.recordType === "portfolio")
    .map((row) => row.weekStart)
    .sort()
    .at(-2)!
  const currentWeekStart = weeklyMetrics
    .filter((row) => row.recordType === "portfolio")
    .map((row) => row.weekStart)
    .sort()
    .at(-1)!

  const buildEvent = (
    id: string,
    collection: ContextCollection,
    occurredAt: string,
    weekStart: string,
    severity: ContextEvent["severity"],
    summary: string,
    detail: string,
    regionId: string | null,
    sectorId: string | null
  ): ContextEvent => ({
    id,
    collection,
    occurredAt,
    weekStart,
    severity,
    summary,
    detail,
    regionId,
    sectorId,
    regionName: regionId ? REGIONS.find((region) => region.id === regionId)?.name ?? null : null,
    sectorName: sectorId ? SECTORS.find((sector) => sector.id === sectorId)?.name ?? null : null,
  })

  return {
    complaints: [
      buildEvent(
        "cmp_01",
        "complaints",
        `${lastWeekStart}T09:15:00Z`,
        lastWeekStart,
        "high",
        "Hospitality SMEs reported delayed settlement visibility.",
        "Four North West hospitality businesses raised complaints about slower-than-usual settlement confirmation after weekend trading.",
        "north_west",
        "hospitality"
      ),
      buildEvent(
        "cmp_02",
        "complaints",
        `${lastWeekStart}T15:40:00Z`,
        lastWeekStart,
        "medium",
        "Support tickets referenced short-term cash pressure.",
        "Retail relationship managers noted higher concern from hospitality clients leaning on overdrafts while waiting for settlement updates.",
        "north_west",
        "hospitality"
      ),
    ],
    service_incidents: [
      buildEvent(
        "svc_01",
        "service_incidents",
        `${lastWeekStart}T07:30:00Z`,
        lastWeekStart,
        "high",
        "Card-settlement delay affected North West merchants.",
        "A payment-settlement incident slowed overnight reconciliation for North West SME merchants for several hours on Monday.",
        "north_west",
        null
      ),
      buildEvent(
        "svc_02",
        "service_incidents",
        `${currentWeekStart}T08:45:00Z`,
        currentWeekStart,
        "low",
        "Settlement issue resolved and throughput normalized.",
        "Operations confirmed the payment-settlement queue returned to expected latency this week.",
        "north_west",
        null
      ),
    ],
    risk_alerts: [
      buildEvent(
        "risk_01",
        "risk_alerts",
        `${lastWeekStart}T11:20:00Z`,
        lastWeekStart,
        "high",
        "Overdraft utilization spiked in hospitality accounts.",
        "North West hospitality accounts recorded the sharpest weekly rise in utilization and low-balance days across the portfolio.",
        "north_west",
        "hospitality"
      ),
      buildEvent(
        "risk_02",
        "risk_alerts",
        `${lastWeekStart}T14:05:00Z`,
        lastWeekStart,
        "medium",
        "Missed-payment risk increased for stressed SMEs.",
        "The risk engine flagged a wider share of hospitality businesses with tightening payment coverage last week.",
        null,
        "hospitality"
      ),
    ],
    rm_notes: [
      buildEvent(
        "rm_01",
        "rm_notes",
        `${lastWeekStart}T16:25:00Z`,
        lastWeekStart,
        "medium",
        "Relationship managers heard cashflow concerns after weekend takings.",
        "Managers reported North West venue owners were waiting longer for card takings to land, pushing up short-term borrowing usage.",
        "north_west",
        "hospitality"
      ),
      buildEvent(
        "rm_02",
        "rm_notes",
        `${currentWeekStart}T13:10:00Z`,
        currentWeekStart,
        "low",
        "Hospitality clients expect a partial rebound this week.",
        "Early-week notes suggest payment timings are improving, although balances are still below their normal range.",
        "north_west",
        "hospitality"
      ),
    ],
  }
}

export function createSeedDataset(): SeedDataset {
  const accounts = buildAccounts()
  const dailyMetrics = buildDailyMetrics(accounts)
  const weeklyMetrics = buildWeeklyMetrics(accounts, dailyMetrics)

  return {
    regions: REGIONS,
    sectors: SECTORS,
    accounts,
    dailyMetrics,
    weeklyMetrics,
    contextEvents: buildContextEvents(weeklyMetrics),
  }
}

let cachedDataset: SeedDataset | undefined

export function getSeedDataset(): SeedDataset {
  if (!cachedDataset) {
    cachedDataset = createSeedDataset()
  }

  return cachedDataset
}

export function formatWeekLabel(weekStart: string): string {
  return format(new Date(`${weekStart}T00:00:00`), "MMM d")
}
