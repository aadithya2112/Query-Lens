import { canUseGemini } from "@/lib/querylens/server/ai-config"
import type { QueryLensExecutionContext } from "@/lib/querylens/server/ai-config"
import { getRelativeDateWindow } from "@/lib/querylens/date-windows"
import { getQueryEngineProvider } from "@/lib/querylens/server/query-engine-provider"
import { planDeterministicQuery } from "@/lib/querylens/server/query-planner"
import type { BuiltInPlanningResult } from "@/lib/querylens/server/built-in-pipeline/types"
import type {
  QueryRequestBody,
  RetrievalContext,
  WeeklyMetricRow,
} from "@/lib/querylens/types"

function buildGuidedReroute(args: {
  question: string
  weeklyRows: WeeklyMetricRow[]
}) {
  const normalizedQuestion = args.question.toLowerCase()
  const timeframe =
    normalizedQuestion.includes("this week") ? "this_week" : "last_week"
  const targetWindow = getRelativeDateWindow(timeframe)

  if (
    /(worst|weakest|biggest drag).*(region)|region.*(worst|weakest|biggest drag)/.test(
      normalizedQuestion,
    )
  ) {
    const weakestRegion = args.weeklyRows
      .filter(
        (row) =>
          row.recordType === "region" && row.weekStart === targetWindow.startDate,
      )
      .sort((left, right) => left.cashflowHealthScore - right.cashflowHealthScore)[0]

    if (weakestRegion?.regionName) {
      return {
        resolvedQuestion: `Why did ${weakestRegion.regionName} cashflow health drop ${timeframe === "this_week" ? "this week" : "last week"}?`,
        explanation:
          "QueryLens interpreted your request as a what-changed investigation for the weakest validated region in the requested weekly window.",
      }
    }
  }

  if (
    /(worst|weakest|biggest drag).*(sector)|sector.*(worst|weakest|biggest drag)/.test(
      normalizedQuestion,
    )
  ) {
    const weakestSector = args.weeklyRows
      .filter(
        (row) =>
          row.recordType === "sector" && row.weekStart === targetWindow.startDate,
      )
      .sort((left, right) => left.cashflowHealthScore - right.cashflowHealthScore)[0]

    if (weakestSector?.sectorName) {
      return {
        resolvedQuestion: `Why did ${weakestSector.sectorName} cashflow health drop ${timeframe === "this_week" ? "this week" : "last week"}?`,
        explanation:
          "QueryLens interpreted your request as a what-changed investigation for the weakest validated sector in the requested weekly window.",
      }
    }
  }

  return undefined
}

export async function planBuiltInAnalysis(args: {
  input: QueryRequestBody
  executionContext: QueryLensExecutionContext
  retrievalContext: RetrievalContext
  weeklyRows: WeeklyMetricRow[]
}): Promise<BuiltInPlanningResult> {
  const provider = getQueryEngineProvider({
    executionContext: args.executionContext,
  })
  const parseResult = await provider.planQuery(
    args.input.question,
    args.input.scope,
    args.retrievalContext,
  )
  const allowAgenticFallback =
    args.executionContext === "interactive" &&
    canUseGemini(args.executionContext) &&
    parseResult.failureKind !== "model_unavailable"

  let interpretation = {
    mode: "direct" as const,
    explanation:
      "QueryLens matched your request directly to a supported analytics flow.",
    resolvedQuestion: undefined as string | undefined,
  }

  const deterministicParseResult =
    !parseResult.parsed && allowAgenticFallback
      ? planDeterministicQuery(args.input.question, args.input.scope)
      : undefined

  let resolvedParseResult = deterministicParseResult?.parsed
    ? deterministicParseResult
    : parseResult

  if (!resolvedParseResult.parsed) {
    const guidedReroute = buildGuidedReroute({
      question: args.input.question,
      weeklyRows: args.weeklyRows,
    })

    if (guidedReroute) {
      const reroutedParseResult = planDeterministicQuery(
        guidedReroute.resolvedQuestion,
        args.input.scope,
      )

      if (reroutedParseResult.plan) {
        resolvedParseResult = {
          plan: reroutedParseResult.plan,
          parsed: reroutedParseResult.plan,
        }
        interpretation = {
          mode: "guided_reroute",
          explanation: guidedReroute.explanation,
          resolvedQuestion: guidedReroute.resolvedQuestion,
        }
      }
    }
  }

  if (!resolvedParseResult.parsed) {
    return {
      kind: "failure",
      fallbackReason:
        resolvedParseResult.fallbackReason ??
        "The question could not be matched to the phase-1 vertical slice safely.",
      failureKind: resolvedParseResult.failureKind,
      interpretation: {
        mode: "fallback",
        explanation:
          "QueryLens could not safely translate that request into one of the currently supported built-in analytics flows.",
      },
      allowAgenticFallback,
    }
  }

  return {
    kind: "success",
    plan: resolvedParseResult.parsed,
    interpretation,
  }
}
