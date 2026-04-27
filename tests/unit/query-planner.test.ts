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
      dateWindow: {
        startDate: "2026-03-30",
        endDate: "2026-04-05",
      },
      timeframe: "last_week",
      scopeDimensions: ["portfolio"],
      comparisonWindow: {
        timeframe: "last_week",
        comparisonBasis: "prior_period",
        targetWindow: {
          startDate: "2026-03-30",
          endDate: "2026-04-05",
        },
        comparisonDateWindow: {
          startDate: "2026-03-23",
          endDate: "2026-03-29",
        },
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
      dateWindow: {
        startDate: "2026-03-30",
        endDate: "2026-04-05",
      },
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
        leftWindow: {
          startDate: "2026-04-06",
          endDate: "2026-04-12",
        },
        rightWindow: {
          startDate: "2026-03-30",
          endDate: "2026-04-05",
        },
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
        selectedWindow: {
          startDate: "2026-03-30",
          endDate: "2026-04-05",
        },
        leftLabel: "North West",
        rightLabel: "London & South East",
      },
    })
  })

  it("uses manifest-backed aliases for peer compare entity resolution", () => {
    const result = planDeterministicQuery(
      "Compare northwest vs Midlands cashflow health last week."
    )

    expect(result.plan).toMatchObject({
      intent: "compare",
      metricId: "cashflow_health_score",
      compareSpec: {
        mode: "peer",
        dimension: "region",
        leftLabel: "North West",
        rightLabel: "Midlands",
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
        selectedWindow: {
          startDate: "2026-04-06",
          endDate: "2026-04-12",
        },
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
    expect(result.fallbackReason).toContain("exact date")
  })

  it("creates a custom-range what-changed plan when the intent is the same but the dates change", () => {
    const result = planDeterministicQuery(
      "Why did SME cashflow health drop from Apr 2, 2026 to Apr 8, 2026?"
    )

    expect(result.plan).toMatchObject({
      intent: "what_changed",
      timeframe: "custom",
      dateWindow: {
        startDate: "2026-04-02",
        endDate: "2026-04-08",
        dayCount: 7,
      },
      comparisonWindow: {
        timeframe: "custom",
        comparisonDateWindow: {
          startDate: "2026-03-26",
          endDate: "2026-04-01",
          dayCount: 7,
        },
      },
    })
  })

  it("creates an explicit custom timeframe compare plan with equal-length windows", () => {
    const result = planDeterministicQuery(
      "Compare cashflow health from Apr 2, 2026 to Apr 8, 2026 vs from Mar 26, 2026 to Apr 1, 2026."
    )

    expect(result.plan).toMatchObject({
      intent: "compare",
      timeframe: "custom",
      compareSpec: {
        mode: "timeframe",
        leftWindow: {
          startDate: "2026-04-02",
          endDate: "2026-04-08",
          dayCount: 7,
        },
        rightWindow: {
          startDate: "2026-03-26",
          endDate: "2026-04-01",
          dayCount: 7,
        },
      },
    })
  })

  it("rejects explicit compare windows with unequal lengths", () => {
    const result = planDeterministicQuery(
      "Compare cashflow health from Apr 2, 2026 to Apr 8, 2026 vs from Mar 30, 2026 to Apr 1, 2026."
    )

    expect(result.plan).toBeUndefined()
    expect(result.fallbackReason).toContain("same length")
  })

  it("validates plan support against the built-in dataset definition", () => {
    const invalid = validateQueryPlan({
      datasetId: "sme_portfolio",
      rawQuestion: "Compare this week and last week",
      intent: "what_changed",
      metricId: "cashflow_health_score",
      dateWindow: {
        startDate: "2026-03-30",
        endDate: "2026-04-05",
        dayCount: 7,
        label: "Mar 30 - Apr 5, 2026",
        relativeTimeframe: "last_week",
      },
      timeframe: "last_week",
      scope: {},
      scopeDimensions: ["portfolio"],
      comparisonWindow: {
        timeframe: "last_week",
        comparisonBasis: "prior_period",
        targetWindow: {
          startDate: "2026-03-30",
          endDate: "2026-04-05",
          dayCount: 7,
          label: "Mar 30 - Apr 5, 2026",
          relativeTimeframe: "last_week",
        },
        comparisonDateWindow: {
          startDate: "2026-03-23",
          endDate: "2026-03-29",
          dayCount: 7,
          label: "Mar 23 - 29, 2026",
        },
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
      dateWindow: {
        startDate: "2026-03-30",
        endDate: "2026-04-05",
        dayCount: 7,
        label: "Mar 30 - Apr 5, 2026",
        relativeTimeframe: "last_week",
      },
      timeframe: "last_week",
      scope: {},
      scopeDimensions: ["portfolio"],
      comparisonWindow: {
        timeframe: "last_week",
        comparisonBasis: "prior_period",
        targetWindow: {
          startDate: "2026-03-30",
          endDate: "2026-04-05",
          dayCount: 7,
          label: "Mar 30 - Apr 5, 2026",
          relativeTimeframe: "last_week",
        },
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
      dateWindow: {
        startDate: "2026-04-06",
        endDate: "2026-04-12",
        dayCount: 7,
        label: "Apr 6 - 12, 2026",
        relativeTimeframe: "this_week",
      },
      timeframe: "this_week",
      scope: {},
      scopeDimensions: ["portfolio"],
      comparisonWindow: {
        timeframe: "this_week",
        comparisonBasis: "prior_period",
        targetWindow: {
          startDate: "2026-04-06",
          endDate: "2026-04-12",
          dayCount: 7,
          label: "Apr 6 - 12, 2026",
          relativeTimeframe: "this_week",
        },
        comparisonDateWindow: {
          startDate: "2026-03-30",
          endDate: "2026-04-05",
          dayCount: 7,
          label: "Mar 30 - Apr 5, 2026",
          relativeTimeframe: "last_week",
        },
      },
    })

    expect(invalid.plan).toBeUndefined()
    expect(invalid.fallbackReason).toContain("Compare questions need")
  })
})
