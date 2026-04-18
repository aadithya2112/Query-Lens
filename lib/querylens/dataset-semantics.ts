import { getSampleDataset } from "@/lib/querylens/seed-data"
import type { DatasetId, ScopeFilter } from "@/lib/querylens/types"

export interface DatasetSemantics {
  datasetId: DatasetId
  portfolioLabel: string
  supportedRegionLabels: string[]
  supportedSectorLabels: string[]
  story: {
    stressPocket: string
    healthyControl: string
    softeningPocket: string
    recoveryPocket: string
  }
}

const DEFAULT_DATASET_ID: DatasetId = "sme_portfolio"

export function getDatasetSemantics(
  datasetId: DatasetId = DEFAULT_DATASET_ID,
): DatasetSemantics {
  const dataset = getSampleDataset()

  return {
    datasetId,
    portfolioLabel: "Portfolio",
    supportedRegionLabels: dataset.regions.map((region) => region.name),
    supportedSectorLabels: dataset.sectors.map((sector) => sector.name),
    story: {
      stressPocket: "North West hospitality",
      healthyControl: "London & South East professional services",
      softeningPocket: "Midlands retail",
      recoveryPocket: "North West hospitality this week",
    },
  }
}

export function getSupportedEntityLabels() {
  const semantics = getDatasetSemantics()

  return {
    regions: semantics.supportedRegionLabels,
    sectors: semantics.supportedSectorLabels,
  }
}

export function getScopeLabel(scope: ScopeFilter) {
  const dataset = getSampleDataset()
  const regionName = scope.region
    ? dataset.regions.find((region) => region.id === scope.region)?.name
    : undefined
  const sectorName = scope.sector
    ? dataset.sectors.find((sector) => sector.id === scope.sector)?.name
    : undefined

  if (regionName && sectorName) {
    return `${regionName} / ${sectorName}`
  }

  if (regionName) {
    return regionName
  }

  if (sectorName) {
    return sectorName
  }

  return getDatasetSemantics().portfolioLabel
}

