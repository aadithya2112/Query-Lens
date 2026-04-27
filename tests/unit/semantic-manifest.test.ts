import { describe, expect, it } from "vitest"

import { getDatasetDefinition, getDatasetMetricManifest } from "@/lib/querylens/datasets"
import { getScopeLabel, getSupportedEntityLabels } from "@/lib/querylens/dataset-semantics"
import {
  getSemanticManifest,
  getSemanticSourceMappings,
} from "@/lib/querylens/semantic-manifest"

describe("semantic manifest", () => {
  it("projects dataset and metric metadata through existing dataset helpers", () => {
    const manifest = getSemanticManifest()
    const dataset = getDatasetDefinition()
    const metricManifest = getDatasetMetricManifest()

    expect(dataset).toMatchObject({
      id: "sme_portfolio",
      label: manifest.dataset.label,
      description: manifest.dataset.description,
      supportedIntentIds: manifest.dataset.supportedIntentIds,
      supportedTimeframes: ["this_week", "last_week", "custom"],
      dimensions: ["portfolio", "region", "sector"],
    })

    expect(metricManifest.metrics).toHaveLength(2)
    expect(metricManifest.metrics[0].synonyms).toContain("cashflow health")
    expect(metricManifest.metrics[1].supportedDimensions).toEqual([
      "region",
      "sector",
      "region_sector",
    ])
  })

  it("resolves entity labels and scope labels from the manifest-backed catalogs", () => {
    expect(getSupportedEntityLabels()).toEqual({
      regions: ["North West", "London & South East", "Midlands", "Scotland"],
      sectors: ["Hospitality", "Retail", "Professional Services", "Manufacturing"],
    })

    expect(getScopeLabel({})).toBe("Portfolio")
    expect(getScopeLabel({ region: "north_west" })).toBe("North West")
    expect(getScopeLabel({ sector: "professional_services" })).toBe(
      "Professional Services",
    )
    expect(
      getScopeLabel({
        region: "north_west",
        sector: "hospitality",
      }),
    ).toBe("North West / Hospitality")
  })

  it("exposes source mappings and supported discovery questions from the manifest", () => {
    expect(getSemanticSourceMappings()).toMatchObject([
      {
        id: "postgres",
        label: "Postgres facts",
      },
      {
        id: "mongodb",
        label: "Mongo context",
      },
      {
        id: "manifest",
        label: "Semantic manifest",
      },
    ])

    expect(getSemanticManifest().supportedQuestions).toContain(
      "What data is currently stored?",
    )
  })
})
