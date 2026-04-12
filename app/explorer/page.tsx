import type { Metadata } from "next"

import SourceContextView from "@/components/querylens/source-context-view"
import { getSourceContextPayload } from "@/lib/querylens/server/source-context"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "QueryLens Source Context",
  description:
    "Source context for QueryLens, including connected source summaries, schema objects, and quick PostgreSQL and MongoDB record previews.",
}

export default async function ExplorerPage() {
  const payload = await getSourceContextPayload()

  return <SourceContextView payload={payload} />
}
