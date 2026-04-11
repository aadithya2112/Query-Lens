import type { Metadata } from "next"

import ExplorerWorkspace from "@/components/explorer/workspace"
import { getExplorerModel } from "@/lib/explorer/mock-data"

export const metadata: Metadata = {
  title: "QueryLens Explorer",
  description:
    "UI-only database explorer for browsing PostgreSQL tables and MongoDB collections with a mock SQL workbench.",
}

export default function ExplorerPage() {
  return <ExplorerWorkspace model={getExplorerModel()} />
}
