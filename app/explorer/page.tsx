import type { Metadata } from "next"

import SourceContextView from "@/components/querylens/source-context-view"
import { getSourceContextPayload } from "@/lib/querylens/server/source-context"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "QueryLens Source Context",
  description:
    "Source context for QueryLens, including connected source summaries, schema objects, and quick PostgreSQL and MongoDB record previews.",
}

export default async function ExplorerPage({
  searchParams = Promise.resolve({}),
}: {
  searchParams?: Promise<{ datasetId?: string }>
} = {}) {
  const params = await searchParams
  const payload = await getSourceContextPayload(params.datasetId)

  return <SourceContextView payload={payload} />
}
