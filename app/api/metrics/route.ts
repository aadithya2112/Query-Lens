import { getMetricManifest } from "@/lib/querylens/metric-manifest"

export async function GET() {
  return Response.json(getMetricManifest())
}
