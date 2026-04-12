export interface AgenticSchemaObject {
  name: string
  description: string
  rowCount: number
  columns: readonly string[]
}

export interface AgenticSchemaSnapshot {
  postgres: AgenticSchemaObject[]
  mongodb: AgenticSchemaObject[]
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
