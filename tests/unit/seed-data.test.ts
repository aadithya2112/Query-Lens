import { getSampleDataset } from "@/lib/querylens/seed-data"

describe("sample dataset", () => {
  it("creates a portfolio-level drop for the flagship last-week window", () => {
    const portfolioRows = getSampleDataset().weeklyMetrics.filter(
      (row) => row.recordType === "portfolio"
    )
    const previousWeek = portfolioRows.find((row) => row.weekStart === "2026-03-23")
    const targetWeek = portfolioRows.find((row) => row.weekStart === "2026-03-30")

    expect(previousWeek).toBeDefined()
    expect(targetWeek).toBeDefined()
    expect(targetWeek!.cashflowHealthScore).toBeLessThan(previousWeek!.cashflowHealthScore)
    expect(targetWeek!.lowBalanceShare).toBeGreaterThan(previousWeek!.lowBalanceShare)
    expect(targetWeek!.overdueShare).toBeGreaterThan(previousWeek!.overdueShare)
  })

  it("makes North West hospitality the sharpest last-week drag", () => {
    const regionSectorRows = getSampleDataset().weeklyMetrics.filter(
      (row) =>
        row.recordType === "region_sector" &&
        row.regionId === "north_west" &&
        row.sectorId === "hospitality"
    )
    const previousWeek = regionSectorRows.find((row) => row.weekStart === "2026-03-23")
    const targetWeek = regionSectorRows.find((row) => row.weekStart === "2026-03-30")

    expect(previousWeek).toBeDefined()
    expect(targetWeek).toBeDefined()
    expect(targetWeek!.cashflowHealthScore).toBeLessThan(previousWeek!.cashflowHealthScore)
    expect(targetWeek!.cashflowHealthScore).toBeLessThan(25)
    expect(targetWeek!.overdueShare).toBeGreaterThan(0.5)
  })

  it("keeps London & South East professional services as a clear healthy control", () => {
    const regionSectorRows = getSampleDataset().weeklyMetrics.filter(
      (row) =>
        row.recordType === "region_sector" &&
        row.weekStart === "2026-03-30",
    )

    const londonProfessionalServices = regionSectorRows.find(
      (row) =>
        row.regionId === "london_south_east" &&
        row.sectorId === "professional_services",
    )
    const northWestHospitality = regionSectorRows.find(
      (row) =>
        row.regionId === "north_west" && row.sectorId === "hospitality",
    )
    const midlandsRetail = regionSectorRows.find(
      (row) => row.regionId === "midlands" && row.sectorId === "retail",
    )

    expect(londonProfessionalServices).toBeDefined()
    expect(northWestHospitality).toBeDefined()
    expect(midlandsRetail).toBeDefined()
    expect(londonProfessionalServices!.cashflowHealthScore).toBe(100)
    expect(londonProfessionalServices!.cashflowHealthScore).toBeGreaterThan(
      northWestHospitality!.cashflowHealthScore,
    )
    expect(londonProfessionalServices!.cashflowHealthScore).toBeGreaterThan(
      midlandsRetail!.cashflowHealthScore,
    )
  })

  it("shows a partial recovery in North West hospitality this week", () => {
    const regionSectorRows = getSampleDataset().weeklyMetrics.filter(
      (row) =>
        row.recordType === "region_sector" &&
        row.regionId === "north_west" &&
        row.sectorId === "hospitality",
    )
    const lastWeek = regionSectorRows.find((row) => row.weekStart === "2026-03-30")
    const currentWeek = regionSectorRows.find((row) => row.weekStart === "2026-04-06")

    expect(lastWeek).toBeDefined()
    expect(currentWeek).toBeDefined()
    expect(currentWeek!.cashflowHealthScore).toBeGreaterThan(
      lastWeek!.cashflowHealthScore,
    )
  })
})
