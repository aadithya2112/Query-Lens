import { getSampleDataset } from "@/lib/querylens/seed-data"
import {
  aggregateMetricWindowRows,
  getScaledLowBalanceDayThreshold,
} from "@/lib/querylens/server/range-aggregation"

describe("range aggregation", () => {
  it("reproduces the stored weekly portfolio snapshot when the range matches one full week", () => {
    const dataset = getSampleDataset()
    const dailyMetrics = dataset.dailyMetrics.filter(
      (metric) => metric.date >= "2026-03-30" && metric.date <= "2026-04-05"
    )
    const aggregatedPortfolio = aggregateMetricWindowRows({
      dailyMetrics,
      startDate: "2026-03-30",
      endDate: "2026-04-05",
    }).find((row) => row.recordType === "portfolio")
    const storedPortfolio = dataset.weeklyMetrics.find(
      (row) => row.recordType === "portfolio" && row.weekStart === "2026-03-30"
    )

    expect(aggregatedPortfolio).toMatchObject({
      cashflowHealthScore: storedPortfolio?.cashflowHealthScore,
      inflowOutflowScore: storedPortfolio?.inflowOutflowScore,
      balanceTrendScore: storedPortfolio?.balanceTrendScore,
      lowBalanceScore: storedPortfolio?.lowBalanceScore,
      overdueScore: storedPortfolio?.overdueScore,
      accountCount: storedPortfolio?.accountCount,
    })
  })

  it("scales the low-balance threshold to the selected range length", () => {
    expect(getScaledLowBalanceDayThreshold(1)).toBe(1)
    expect(getScaledLowBalanceDayThreshold(3)).toBe(1)
    expect(getScaledLowBalanceDayThreshold(7)).toBe(2)
    expect(getScaledLowBalanceDayThreshold(14)).toBe(4)
  })
})
