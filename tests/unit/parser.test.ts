import { parsePhase1Question } from "@/lib/querylens/server/parser"

describe("parsePhase1Question", () => {
  it("parses timeframe and optional sector scope from the question", () => {
    const result = parsePhase1Question(
      "Why did hospitality cashflow health drop last week?"
    )

    expect(result.parsed).toBeDefined()
    expect(result.parsed?.timeframe).toBe("last_week")
    expect(result.parsed?.dateWindow).toMatchObject({
      startDate: "2026-03-30",
      endDate: "2026-04-05",
    })
    expect(result.parsed?.scope.sector).toBe("hospitality")
  })

  it("parses explicit region scope overrides", () => {
    const result = parsePhase1Question("Why did cashflow health drop this week?", {
      region: "North West",
    })

    expect(result.parsed?.scope.region).toBe("north_west")
    expect(result.parsed?.timeframe).toBe("this_week")
  })

  it("parses explicit custom date ranges for the same supported intent", () => {
    const result = parsePhase1Question(
      "Why did cashflow health drop from Apr 2, 2026 to Apr 8, 2026?"
    )

    expect(result.parsed?.timeframe).toBe("custom")
    expect(result.parsed?.dateWindow).toMatchObject({
      startDate: "2026-04-02",
      endDate: "2026-04-08",
      dayCount: 7,
    })
  })

  it("returns a fallback reason for unsupported metrics", () => {
    const result = parsePhase1Question("Why did revenue drop last week?")

    expect(result.parsed).toBeUndefined()
    expect(result.fallbackReason).toContain("cashflow health")
  })
})
