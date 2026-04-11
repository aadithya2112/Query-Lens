import { calculateCashflowHealthScore } from "@/lib/querylens/scoring"

describe("calculateCashflowHealthScore", () => {
  it("returns a stable 0-100 score with component breakdowns", () => {
    const result = calculateCashflowHealthScore({
      inboundPayments: 120_000,
      outboundPayments: 100_000,
      openingBalance: 220_000,
      closingBalance: 229_000,
      lowBalanceShare: 0.08,
      overdueShare: 0.03,
    })

    expect(result.inflowOutflowScore).toBeGreaterThan(90)
    expect(result.balanceTrendScore).toBeGreaterThan(75)
    expect(result.lowBalanceScore).toBe(92)
    expect(result.overdueScore).toBe(97)
    expect(result.cashflowHealthScore).toBeGreaterThan(85)
  })
})
