import {
  calculateWeightedDriverImpact,
  roundTo,
} from "@/lib/querylens/scoring"
import type { WeeklyMetricRow } from "@/lib/querylens/types"
import {
  assertBuiltInCapability,
  type BuiltInCapabilityContext,
} from "@/lib/querylens/server/built-in-pipeline/capabilities/types"

export interface CashflowComponentDelta {
  id: "coverage" | "balance" | "stress"
  previousScore: number
  currentScore: number
  weight: number
  weightedDelta: number
  direction: "negative" | "positive"
  previousRatio?: number
  currentRatio?: number
  previousClosingBalance?: number
  currentClosingBalance?: number
  previousLowBalanceShare?: number
  currentLowBalanceShare?: number
  previousOverdueShare?: number
  currentOverdueShare?: number
}

export interface CashflowComponentGap {
  id: "coverage_gap" | "balance_gap" | "stress_gap"
  weightedGap: number
  leftValue: number
  rightValue: number
  leftRatio?: number
  rightRatio?: number
  leftClosingBalance?: number
  rightClosingBalance?: number
  leftLowBalanceShare?: number
  rightLowBalanceShare?: number
  leftOverdueShare?: number
  rightOverdueShare?: number
}

export function explainChangeCapability(args: {
  context: BuiltInCapabilityContext
  current: WeeklyMetricRow
  previous: WeeklyMetricRow
}): CashflowComponentDelta[] {
  assertBuiltInCapability(args.context, "explain_change")

  return [
    {
      id: "coverage",
      previousScore: args.previous.inflowOutflowScore,
      currentScore: args.current.inflowOutflowScore,
      weight: 0.4,
      weightedDelta: calculateWeightedDriverImpact(
        args.previous.inflowOutflowScore,
        args.current.inflowOutflowScore,
        0.4,
      ),
      direction:
        args.current.inflowOutflowScore - args.previous.inflowOutflowScore < 0
          ? "negative"
          : "positive",
      previousRatio: args.previous.inboundPayments / args.previous.outboundPayments,
      currentRatio: args.current.inboundPayments / args.current.outboundPayments,
    },
    {
      id: "balance",
      previousScore: args.previous.balanceTrendScore,
      currentScore: args.current.balanceTrendScore,
      weight: 0.25,
      weightedDelta: calculateWeightedDriverImpact(
        args.previous.balanceTrendScore,
        args.current.balanceTrendScore,
        0.25,
      ),
      direction:
        args.current.balanceTrendScore - args.previous.balanceTrendScore < 0
          ? "negative"
          : "positive",
      previousClosingBalance: args.previous.closingBalance,
      currentClosingBalance: args.current.closingBalance,
    },
    {
      id: "stress",
      previousScore: args.previous.lowBalanceScore + args.previous.overdueScore,
      currentScore: args.current.lowBalanceScore + args.current.overdueScore,
      weight: 0.35,
      weightedDelta: roundTo(
        calculateWeightedDriverImpact(
          args.previous.lowBalanceScore,
          args.current.lowBalanceScore,
          0.2,
        ) +
          calculateWeightedDriverImpact(
            args.previous.overdueScore,
            args.current.overdueScore,
            0.15,
          ),
      ),
      direction:
        args.current.lowBalanceScore + args.current.overdueScore <
        args.previous.lowBalanceScore + args.previous.overdueScore
          ? "negative"
          : "positive",
      previousLowBalanceShare: args.previous.lowBalanceShare,
      currentLowBalanceShare: args.current.lowBalanceShare,
      previousOverdueShare: args.previous.overdueShare,
      currentOverdueShare: args.current.overdueShare,
    },
  ]
}

export function explainCompareGapCapability(args: {
  context: BuiltInCapabilityContext
  left: WeeklyMetricRow
  right: WeeklyMetricRow
}): CashflowComponentGap[] {
  assertBuiltInCapability(args.context, "explain_change")

  return [
    {
      id: "coverage_gap",
      weightedGap: roundTo(
        Math.abs(args.left.inflowOutflowScore - args.right.inflowOutflowScore) *
          0.4,
        1,
      ),
      leftValue: args.left.inflowOutflowScore,
      rightValue: args.right.inflowOutflowScore,
      leftRatio: args.left.inboundPayments / args.left.outboundPayments,
      rightRatio: args.right.inboundPayments / args.right.outboundPayments,
    },
    {
      id: "balance_gap",
      weightedGap: roundTo(
        Math.abs(args.left.balanceTrendScore - args.right.balanceTrendScore) *
          0.25,
        1,
      ),
      leftValue: args.left.balanceTrendScore,
      rightValue: args.right.balanceTrendScore,
      leftClosingBalance: args.left.closingBalance,
      rightClosingBalance: args.right.closingBalance,
    },
    {
      id: "stress_gap",
      weightedGap: roundTo(
        Math.abs(args.left.lowBalanceScore - args.right.lowBalanceScore) * 0.2 +
          Math.abs(args.left.overdueScore - args.right.overdueScore) * 0.15,
        1,
      ),
      leftValue: args.left.lowBalanceScore + args.left.overdueScore,
      rightValue: args.right.lowBalanceScore + args.right.overdueScore,
      leftLowBalanceShare: args.left.lowBalanceShare,
      rightLowBalanceShare: args.right.lowBalanceShare,
      leftOverdueShare: args.left.overdueShare,
      rightOverdueShare: args.right.overdueShare,
    },
  ]
}
