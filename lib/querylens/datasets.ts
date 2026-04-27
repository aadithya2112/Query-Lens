import {
  getPrimarySemanticMetricDefinition,
  getSemanticManifest,
  getSemanticMetricDefinition,
  getSemanticMetricManifest,
} from "@/lib/querylens/semantic-manifest"
import type {
  DatasetDefinition,
  DatasetId,
  MetricDefinition,
  MetricManifest,
  ScopeDimension,
} from "@/lib/querylens/types"

const BUILT_IN_DATASET_ID: DatasetId = "sme_portfolio"

export function getDefaultDatasetId(): DatasetId {
  return BUILT_IN_DATASET_ID
}

export function getBuiltInDatasetDefinition(): DatasetDefinition {
  const manifest = getSemanticManifest()

  return {
    id: manifest.dataset.id,
    label: manifest.dataset.label,
    description: manifest.dataset.description,
    dimensions: manifest.dimensions
      .filter(
        (dimension): dimension is typeof dimension & { id: ScopeDimension } =>
          dimension.id !== "region_sector",
      )
      .map((dimension) => dimension.id),
    metrics: manifest.metrics,
    supportedIntentIds: manifest.dataset.supportedIntentIds,
    supportedTimeframes: manifest.dataset.supportedTimeframes,
  }
}

export function getDatasetDefinition(datasetId: DatasetId = BUILT_IN_DATASET_ID) {
  if (datasetId !== BUILT_IN_DATASET_ID) {
    return getBuiltInDatasetDefinition()
  }

  return getBuiltInDatasetDefinition()
}

export function getDatasetMetricManifest(
  datasetId: DatasetId = BUILT_IN_DATASET_ID
): MetricManifest {
  return getSemanticMetricManifest(datasetId)
}

export function getPrimaryDatasetMetricDefinition(
  datasetId: DatasetId = BUILT_IN_DATASET_ID
): MetricDefinition {
  return getPrimarySemanticMetricDefinition(datasetId)
}

export function getDatasetMetricDefinition(
  metricId: MetricDefinition["id"],
  datasetId: DatasetId = BUILT_IN_DATASET_ID
): MetricDefinition | undefined {
  return getSemanticMetricDefinition(metricId, datasetId)
}
