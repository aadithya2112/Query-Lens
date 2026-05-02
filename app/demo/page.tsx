import Workspace from "@/components/querylens/workspace"
import { getBootstrapPayload } from "@/lib/querylens/server/bootstrap"

export const dynamic = "force-dynamic"

export default async function DemoPage({
  searchParams,
}: {
  searchParams: Promise<{ datasetId?: string }>
}) {
  const params = await searchParams
  const bootstrap = await getBootstrapPayload(params.datasetId)

  return <Workspace {...bootstrap} />
}
