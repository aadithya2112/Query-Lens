import {
  getScopeLabel as getManifestScopeLabel,
  getSemanticManifest,
  getSupportedEntityLabels as getManifestSupportedEntityLabels,
} from "@/lib/querylens/semantic-manifest"
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
  const manifest = getSemanticManifest(datasetId)
  const supportedEntities = getManifestSupportedEntityLabels(datasetId)

  return {
    datasetId,
    portfolioLabel: manifest.dataset.portfolioLabel,
    supportedRegionLabels: supportedEntities.regions,
    supportedSectorLabels: supportedEntities.sectors,
    story: {
      stressPocket: manifest.storyAnchors.stressPocket,
      healthyControl: manifest.storyAnchors.healthyControl,
      softeningPocket: manifest.storyAnchors.softeningPocket,
      recoveryPocket: manifest.storyAnchors.recoveryPocket,
    },
  }
}

export function getSupportedEntityLabels() {
  return getManifestSupportedEntityLabels()
}

export function getScopeLabel(scope: ScopeFilter) {
  return getManifestScopeLabel(scope)
}
