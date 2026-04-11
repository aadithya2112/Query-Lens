declare module "pg" {
  export interface QueryResult<Row = Record<string, unknown>> {
    rows: Row[]
  }

  export class Pool {
    constructor(config?: { connectionString?: string })
    query<Row = Record<string, unknown>>(
      text: string,
      values?: readonly unknown[]
    ): Promise<QueryResult<Row>>
    end(): Promise<void>
  }
}
