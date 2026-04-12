import Workspace from "@/components/querylens/workspace"
import { getBootstrapPayload } from "@/lib/querylens/server/bootstrap"

export const dynamic = "force-dynamic"

export default async function DemoPage() {
  const bootstrap = await getBootstrapPayload()

  return <Workspace {...bootstrap} />
}
