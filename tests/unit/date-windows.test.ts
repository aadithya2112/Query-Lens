import {
  buildDateWindow,
  buildPriorEqualDateWindow,
  formatDateCoverage,
  getRelativeDateWindow,
  isDateWindowWithinCoverage,
  resolveQuestionDateWindows,
} from "@/lib/querylens/date-windows"

describe("date window utilities", () => {
  it("resolves the legacy relative windows from the fixed reference date", () => {
    const thisWeek = getRelativeDateWindow("this_week")
    const lastWeek = getRelativeDateWindow("last_week")

    expect(thisWeek).toMatchObject({
      startDate: "2026-04-06",
      endDate: "2026-04-12",
      dayCount: 7,
      relativeTimeframe: "this_week",
    })
    expect(lastWeek).toMatchObject({
      startDate: "2026-03-30",
      endDate: "2026-04-05",
      dayCount: 7,
      relativeTimeframe: "last_week",
    })
  })

  it("builds the immediately preceding equal-length comparison window", () => {
    const window = buildDateWindow({
      startDate: "2026-04-02",
      endDate: "2026-04-08",
    })

    expect(buildPriorEqualDateWindow(window)).toMatchObject({
      startDate: "2026-03-26",
      endDate: "2026-04-01",
      dayCount: 7,
      label: "Mar 26, 2026 - Apr 1, 2026",
    })
  })

  it("resolves explicit ranges from the question text", () => {
    const resolved = resolveQuestionDateWindows(
      "Why did cashflow health drop from Apr 2, 2026 to Apr 8, 2026?"
    )

    expect(resolved.primaryWindow).toMatchObject({
      startDate: "2026-04-02",
      endDate: "2026-04-08",
      dayCount: 7,
      label: "Apr 2 - 8, 2026",
    })
  })

  it("treats a single explicit date as a one-day window", () => {
    const resolved = resolveQuestionDateWindows(
      "Why did hospitality cashflow health drop on 2026-04-02?"
    )

    expect(resolved.primaryWindow).toMatchObject({
      startDate: "2026-04-02",
      endDate: "2026-04-02",
      dayCount: 1,
      label: "Apr 2, 2026",
    })
  })

  it("resolves explicit compare ranges when both windows are present", () => {
    const resolved = resolveQuestionDateWindows(
      "Compare cashflow health from Apr 2, 2026 to Apr 8, 2026 vs from Mar 26, 2026 to Apr 1, 2026."
    )

    expect(resolved.compareWindows).toMatchObject({
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
    })
  })

  it("supports week-of phrasing for one window or an explicit compare", () => {
    const primary = resolveQuestionDateWindows(
      "Break down at-risk accounts for the week of Apr 2, 2026"
    )
    const compare = resolveQuestionDateWindows(
      "Compare cashflow health for the week of Apr 2, 2026 vs the week of Mar 26, 2026"
    )

    expect(primary.primaryWindow).toMatchObject({
      startDate: "2026-03-30",
      endDate: "2026-04-05",
      dayCount: 7,
    })
    expect(compare.compareWindows).toMatchObject({
      leftWindow: {
        startDate: "2026-03-30",
        endDate: "2026-04-05",
      },
      rightWindow: {
        startDate: "2026-03-23",
        endDate: "2026-03-29",
      },
    })
  })

  it("validates dataset coverage using exact absolute dates", () => {
    const coverage = {
      startDate: "2026-01-18",
      endDate: "2026-04-12",
    }
    const insideWindow = buildDateWindow({
      startDate: "2026-04-02",
      endDate: "2026-04-08",
    })
    const outsideWindow = buildDateWindow({
      startDate: "2026-01-10",
      endDate: "2026-01-12",
    })

    expect(isDateWindowWithinCoverage(insideWindow, coverage)).toBe(true)
    expect(isDateWindowWithinCoverage(outsideWindow, coverage)).toBe(false)
    expect(formatDateCoverage(coverage)).toBe("Jan 18, 2026 - Apr 12, 2026")
  })
})
