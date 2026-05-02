import { listRegisteredDatasets } from "@/lib/querylens/server/dataset-registry"

export async function GET() {
  return Response.json({
    datasets: await listRegisteredDatasets(),
  })
}
