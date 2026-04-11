import { getWeekWindow } from "@/lib/querylens/reference-date"

describe("getWeekWindow", () => {
  it("resolves the last completed week relative to the fixed reference date", () => {
    const result = getWeekWindow("last_week")

    expect(result.targetStart).toBe("2026-03-30")
    expect(result.comparisonStart).toBe("2026-03-23")
    expect(result.timeframeLabel).toContain("Last week")
  })

  it("resolves the current week when requested", () => {
    const result = getWeekWindow("this_week")

    expect(result.targetStart).toBe("2026-04-06")
    expect(result.comparisonStart).toBe("2026-03-30")
    expect(result.timeframeLabel).toContain("This week")
  })
})
