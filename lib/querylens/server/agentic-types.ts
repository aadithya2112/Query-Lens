export interface AgenticSchemaObject {
  name: string
  description: string
  rowCount: number
  columns: readonly string[]
}

export interface AgenticConnectedCsvSource {
  id: string
  datasetId: string
  label: string
  description: string
  tableName: string
  rowCount: number
  columns: readonly string[]
  primaryTimeField?: string
  metrics: Array<{
    id: string
    label: string
    supportedIntents: string[]
  }>
  dimensions: Array<{
    id: string
    label: string
  }>
}

export interface AgenticSchemaSnapshot {
  postgres: AgenticSchemaObject[]
  mongodb: AgenticSchemaObject[]
  csv: AgenticConnectedCsvSource[]
}

export interface AgenticSourceCatalogEntry {
  id: string
  sourceType: "postgres" | "mongodb" | "csv"
  label: string
  description: string
  recordCount: number
  objectCount: number
  queryable: boolean
}

export interface AgenticSourceCatalog {
  entries: AgenticSourceCatalogEntry[]
  schema: AgenticSchemaSnapshot
}

export interface AgenticQueryRowsResult {
  columns: string[]
  rows: Array<Record<string, string | number | boolean | null>>
  totalRows: number
  truncated: boolean
}

export interface AgenticQueryExecutionResult {
  rowset: AgenticQueryRowsResult
  summary: string
}
