import { formatSqlQuery, resolveMockQueryPreviewId } from "@/lib/explorer/workbench"
import { getExplorerModel } from "@/lib/explorer/mock-data"

describe("explorer workbench helpers", () => {
  it("matches a canned preview for known SQL patterns", () => {
    const model = getExplorerModel()

    const previewId = resolveMockQueryPreviewId(
      "select status, count(*) as order_count, sum(order_total) as gross_value from public.orders group by status",
      model.queryMocks,
      model.defaultPreviewId,
    )

    expect(previewId).toBe("query.order_status_rollup")
  })

  it("falls back to the selected preview for unknown SQL", () => {
    const model = getExplorerModel()

    const previewId = resolveMockQueryPreviewId(
      "select * from crm.accounts",
      model.queryMocks,
      "mongo.crm.accounts",
    )

    expect(previewId).toBe("mongo.crm.accounts")
  })

  it("formats SQL keywords onto clearer lines", () => {
    const formatted = formatSqlQuery(
      "select invoice_id, amount_due from finance.invoices where days_overdue > 0 order by amount_due desc limit 10",
    )

    expect(formatted).toContain("SELECT invoice_id, amount_due")
    expect(formatted).toContain("\nFROM finance.invoices")
    expect(formatted).toContain("\nWHERE days_overdue > 0")
    expect(formatted).toContain("\nORDER BY amount_due DESC")
    expect(formatted).toContain("\nLIMIT 10")
  })
})
