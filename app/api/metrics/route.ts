import { getDatasetMetricManifest } from "@/lib/querylens/datasets"

export async function GET() {
  return Response.json(getDatasetMetricManifest())
}
