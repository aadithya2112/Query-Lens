export type ExplorerSourceType = "postgresql" | "mongodb"

export type ExplorerNodeKind =
  | "server"
  | "schema"
  | "table"
  | "cluster"
  | "database"
  | "collection"

export interface ExplorerColumn {
  name: string
  type: string
  nullable?: boolean
  description?: string
  sample: string
}

export interface ExplorerPreview {
  id: string
  sourceType: ExplorerSourceType
  sourceLabel: string
  kind: "table" | "collection" | "query"
  label: string
  path: string[]
  name: string
  rowLabel: "rows" | "documents"
  rowCount: number
  columns: ExplorerColumn[]
  rows: Array<Record<string, string | number | boolean | null>>
  summary: string
  queryHint?: string
}

export interface ExplorerNode {
  id: string
  kind: ExplorerNodeKind
  label: string
  meta?: string
  previewId?: string
  defaultExpanded?: boolean
  children?: ExplorerNode[]
}

export interface ExplorerSource {
  id: string
  type: ExplorerSourceType
  label: string
  description: string
  status: "live" | "mock"
  nodes: ExplorerNode[]
}

export interface QueryMockMatch {
  id: string
  label: string
  description: string
  previewId: string
  sampleQuery: string
  matchers: string[]
}

export interface ExplorerModel {
  sources: ExplorerSource[]
  previews: ExplorerPreview[]
  queryMocks: QueryMockMatch[]
  defaultPreviewId: string
  initialQuery: string
}

export interface SqlEditorState {
  query: string
  lastRunPreviewId: string | null
}
