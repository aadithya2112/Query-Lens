export interface WeeklyScoreInput {
  inboundPayments: number
  outboundPayments: number
  openingBalance: number
  closingBalance: number
  lowBalanceShare: number
  overdueShare: number
}

export interface WeeklyScoreComponents {
  inflowOutflowScore: number
  balanceTrendScore: number
  lowBalanceScore: number
  overdueScore: number
  cashflowHealthScore: number
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function roundTo(value: number, digits = 1): number {
  const multiplier = 10 ** digits
  return Math.round(value * multiplier) / multiplier
}

function normalizeRange(value: number, min: number, max: number): number {
  return clamp(((value - min) / (max - min)) * 100, 0, 100)
}

export function calculateCashflowHealthScore(
  input: WeeklyScoreInput
): WeeklyScoreComponents {
  const inflowRatio = input.inboundPayments / Math.max(input.outboundPayments, 1)
  const balanceTrend =
    (input.closingBalance - input.openingBalance) / Math.max(input.openingBalance, 1)

  const inflowOutflowScore = roundTo(normalizeRange(inflowRatio, 0.8, 1.18))
  const balanceTrendScore = roundTo(normalizeRange(balanceTrend, -0.1, 0.08))
  const lowBalanceScore = roundTo(clamp((1 - input.lowBalanceShare) * 100, 0, 100))
  const overdueScore = roundTo(clamp((1 - input.overdueShare) * 100, 0, 100))

  const cashflowHealthScore = roundTo(
    inflowOutflowScore * 0.4 +
      balanceTrendScore * 0.25 +
      lowBalanceScore * 0.2 +
      overdueScore * 0.15
  )

  return {
    inflowOutflowScore,
    balanceTrendScore,
    lowBalanceScore,
    overdueScore,
    cashflowHealthScore,
  }
}

export function calculateWeightedDriverImpact(
  previousScore: number,
  currentScore: number,
  weight: number
): number {
  return roundTo((currentScore - previousScore) * weight)
}

export function calculateConfidenceScore(params: {
  evidenceCount: number
  driverCount: number
  hasCrossSourceEvidence: boolean
  fallback?: boolean
}): number {
  if (params.fallback) {
    return 24
  }

  let score = 72
  score += Math.min(params.evidenceCount, 4) * 3
  score += Math.min(params.driverCount, 3) * 2
  if (params.hasCrossSourceEvidence) {
    score += 8
  }

  return clamp(Math.round(score), 0, 96)
}
