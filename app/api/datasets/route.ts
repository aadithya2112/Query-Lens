import { auth } from "@clerk/nextjs/server"

import { listRegisteredDatasets } from "@/lib/querylens/server/dataset-registry"

export async function GET() {
  const { userId } = await auth()

  if (!userId) {
    return Response.json(
      {
        error: "Not authenticated.",
      },
      { status: 401 }
    )
  }

  return Response.json({
    datasets: await listRegisteredDatasets(),
  })
}
