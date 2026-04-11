import { parsePhase1Question } from "@/lib/querylens/server/parser"

describe("parsePhase1Question", () => {
  it("parses timeframe and optional sector scope from the question", () => {
    const result = parsePhase1Question(
      "Why did hospitality cashflow health drop last week?"
    )

    expect(result.parsed).toBeDefined()
    expect(result.parsed?.timeframe).toBe("last_week")
    expect(result.parsed?.scope.sector).toBe("hospitality")
  })

  it("parses explicit region scope overrides", () => {
    const result = parsePhase1Question("Why did cashflow health drop this week?", {
      region: "North West",
    })

    expect(result.parsed?.scope.region).toBe("north_west")
    expect(result.parsed?.timeframe).toBe("this_week")
  })

  it("returns a fallback reason for unsupported metrics", () => {
    const result = parsePhase1Question("Why did revenue drop last week?")

    expect(result.parsed).toBeUndefined()
    expect(result.fallbackReason).toContain("cashflow health")
  })
})
