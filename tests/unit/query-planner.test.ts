import {
  planDeterministicQuery,
  validateQueryPlan,
} from "@/lib/querylens/server/query-planner"

describe("query planner", () => {
  it("creates a structured plan for the flagship question", () => {
    const result = planDeterministicQuery(
      "Why did SME cashflow health drop last week?"
    )

    expect(result.plan).toBeDefined()
    expect(result.plan).toMatchObject({
      datasetId: "sme_portfolio",
      intent: "what_changed",
      metricId: "cashflow_health_score",
      timeframe: "last_week",
      scopeDimensions: ["portfolio"],
      comparisonWindow: {
        timeframe: "last_week",
        comparisonBasis: "prior_period",
      },
    })
  })

  it("creates a scoped plan when region and sector are present", () => {
    const result = planDeterministicQuery(
      "Why did hospitality cashflow health drop last week in the North West?"
    )

    expect(result.plan?.scope).toEqual({
      region: "north_west",
      sector: "hospitality",
    })
    expect(result.plan?.scopeDimensions).toEqual(["region", "sector"])
  })

  it("returns guided fallback for unsupported timeframes", () => {
    const result = planDeterministicQuery("Why did cashflow health drop last month?")

    expect(result.plan).toBeUndefined()
    expect(result.fallbackReason).toContain("this week")
  })

  it("validates plan support against the built-in dataset definition", () => {
    const invalid = validateQueryPlan({
      datasetId: "sme_portfolio",
      rawQuestion: "Compare this week and last week",
      intent: "what_changed",
      metricId: "cashflow_health_score",
      timeframe: "last_week",
      scope: {},
      scopeDimensions: ["portfolio"],
      comparisonWindow: {
        timeframe: "last_week",
        comparisonBasis: "prior_period",
      },
    })

    expect(invalid.plan).toBeDefined()
  })
})
