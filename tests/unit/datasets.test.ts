import {
  getBuiltInDatasetDefinition,
  getDatasetMetricManifest,
  getDefaultDatasetId,
  getPrimaryDatasetMetricDefinition,
} from "@/lib/querylens/datasets"

describe("dataset definitions", () => {
  it("returns the built-in SME portfolio dataset", () => {
    const dataset = getBuiltInDatasetDefinition()

    expect(getDefaultDatasetId()).toBe("sme_portfolio")
    expect(dataset.id).toBe("sme_portfolio")
    expect(dataset.supportedIntentIds).toContain("what_changed")
    expect(dataset.supportedIntentIds).toContain("breakdown")
    expect(dataset.supportedTimeframes).toEqual(["this_week", "last_week"])
    expect(dataset.dimensions).toEqual(["portfolio", "region", "sector"])
  })

  it("resolves the metric manifest through the dataset abstraction", () => {
    const manifest = getDatasetMetricManifest()
    const metric = getPrimaryDatasetMetricDefinition()

    expect(manifest.metrics).toHaveLength(2)
    expect(metric.id).toBe("cashflow_health_score")
    expect(metric.supportedIntents).toEqual(["what_changed"])
    expect(metric.supportedDimensions).toEqual(["portfolio", "region", "sector"])
    expect(
      manifest.metrics.find((candidate) => candidate.id === "at_risk_account_count")
        ?.supportedIntents
    ).toEqual(["breakdown"])
  })
})
