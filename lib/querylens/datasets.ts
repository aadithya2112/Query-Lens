import { getMetricManifest } from "@/lib/querylens/metric-manifest"
import type {
  DatasetDefinition,
  DatasetId,
  MetricDefinition,
  MetricManifest,
} from "@/lib/querylens/types"

const BUILT_IN_DATASET_ID: DatasetId = "sme_portfolio"

const BUILT_IN_DATASET: DatasetDefinition = {
  id: BUILT_IN_DATASET_ID,
  label: "SME portfolio",
  description:
    "Synthetic SME banking portfolio with weekly cashflow health facts and corroborating context signals.",
  dimensions: ["portfolio", "region", "sector"],
  metrics: getMetricManifest().metrics,
  supportedIntentIds: ["what_changed", "breakdown", "compare", "discovery"],
  supportedTimeframes: ["this_week", "last_week", "custom"],
}

export function getDefaultDatasetId(): DatasetId {
  return BUILT_IN_DATASET_ID
}

export function getBuiltInDatasetDefinition(): DatasetDefinition {
  return BUILT_IN_DATASET
}

export function getDatasetDefinition(datasetId: DatasetId = BUILT_IN_DATASET_ID) {
  if (datasetId === BUILT_IN_DATASET_ID) {
    return BUILT_IN_DATASET
  }

  return BUILT_IN_DATASET
}

export function getDatasetMetricManifest(
  datasetId: DatasetId = BUILT_IN_DATASET_ID
): MetricManifest {
  const dataset = getDatasetDefinition(datasetId)
  return {
    metrics: dataset.metrics,
  }
}

export function getPrimaryDatasetMetricDefinition(
  datasetId: DatasetId = BUILT_IN_DATASET_ID
): MetricDefinition {
  return getDatasetDefinition(datasetId).metrics[0]
}

export function getDatasetMetricDefinition(
  metricId: MetricDefinition["id"],
  datasetId: DatasetId = BUILT_IN_DATASET_ID
): MetricDefinition | undefined {
  return getDatasetDefinition(datasetId).metrics.find(
    (metric) => metric.id === metricId
  )
}
