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

  it("creates a breakdown plan for at-risk accounts by region and sector", () => {
    const result = planDeterministicQuery(
      "What makes up at-risk accounts by region and sector last week?"
    )

    expect(result.plan).toMatchObject({
      intent: "breakdown",
      metricId: "at_risk_account_count",
      timeframe: "last_week",
      breakdownDimension: "region_sector",
      scopeDimensions: ["portfolio"],
    })
  })

  it("defaults scoped breakdowns to the remaining dimension", () => {
    const result = planDeterministicQuery(
      "Break down at-risk accounts in the North West last week."
    )

    expect(result.plan).toMatchObject({
      intent: "breakdown",
      breakdownDimension: "sector",
    })
    expect(result.plan?.scope).toEqual({
      region: "north_west",
    })
  })

  it("creates a timeframe compare plan for cashflow health", () => {
    const result = planDeterministicQuery(
      "Compare cashflow health this week vs last week."
    )

    expect(result.plan).toMatchObject({
      intent: "compare",
      metricId: "cashflow_health_score",
      timeframe: "this_week",
      compareSpec: {
        mode: "timeframe",
        leftTimeframe: "this_week",
        rightTimeframe: "last_week",
        leftLabel: "This week",
        rightLabel: "Last week",
      },
    })
  })

  it("creates a region peer compare plan", () => {
    const result = planDeterministicQuery(
      "Compare North West vs London & South East cashflow health last week."
    )

    expect(result.plan).toMatchObject({
      intent: "compare",
      metricId: "cashflow_health_score",
      timeframe: "last_week",
      compareSpec: {
        mode: "peer",
        dimension: "region",
        selectedTimeframe: "last_week",
        leftLabel: "North West",
        rightLabel: "London & South East",
      },
    })
  })

  it("creates a sector peer compare plan", () => {
    const result = planDeterministicQuery(
      "Compare hospitality vs retail cashflow health this week."
    )

    expect(result.plan).toMatchObject({
      intent: "compare",
      metricId: "cashflow_health_score",
      timeframe: "this_week",
      compareSpec: {
        mode: "peer",
        dimension: "sector",
        selectedTimeframe: "this_week",
        leftLabel: "Hospitality",
        rightLabel: "Retail",
      },
    })
  })

  it("creates a discovery plan for vague metadata questions", () => {
    const result = planDeterministicQuery("What data is currently stored?")

    expect(result.plan).toMatchObject({
      intent: "discovery",
      metricId: "dataset_catalog",
      discoveryFocus: "overview",
      scopeDimensions: ["portfolio"],
    })
  })

  it("rejects mixed-dimension peer compare", () => {
    const result = planDeterministicQuery(
      "Compare North West vs retail cashflow health last week."
    )

    expect(result.plan).toBeUndefined()
    expect(result.fallbackReason).toContain("region vs region or sector vs sector")
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

  it("rejects metrics on unsupported intent flows", () => {
    const invalid = validateQueryPlan({
      datasetId: "sme_portfolio",
      rawQuestion: "Break down cashflow health by region",
      intent: "breakdown",
      metricId: "cashflow_health_score",
      timeframe: "last_week",
      scope: {},
      scopeDimensions: ["portfolio"],
      comparisonWindow: {
        timeframe: "last_week",
        comparisonBasis: "prior_period",
      },
      breakdownDimension: "region",
    })

    expect(invalid.plan).toBeUndefined()
    expect(invalid.fallbackReason).toContain("does not support")
  })

  it("rejects compare plans without compare metadata", () => {
    const invalid = validateQueryPlan({
      datasetId: "sme_portfolio",
      rawQuestion: "Compare cashflow health this week vs last week",
      intent: "compare",
      metricId: "cashflow_health_score",
      timeframe: "this_week",
      scope: {},
      scopeDimensions: ["portfolio"],
      comparisonWindow: {
        timeframe: "this_week",
        comparisonBasis: "prior_period",
      },
    })

    expect(invalid.plan).toBeUndefined()
    expect(invalid.fallbackReason).toContain("Compare questions need")
  })
})
