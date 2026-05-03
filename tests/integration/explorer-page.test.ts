import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/querylens/server/dataset-runtime", async () => {
  const { createMockQueryLensDatasetRuntime } = await import(
    "../helpers/querylens-runtime"
  )

  return {
    getQueryLensDatasetRuntime: async () => createMockQueryLensDatasetRuntime(),
  }
})

const csvSalesDataset = {
  id: "csv_sales",
  label: "CSV Sales",
  description: "Uploaded sales dataset.",
  status: "draft" as const,
  sourceKind: "csv" as const,
  sourceMode: "database" as const,
  tableName: "querylens_dataset_rows_csv_sales",
  rowCount: 12,
  primaryTimeField: "date",
  grain: "row_per_date",
  manifestVersion: 1,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  semanticDraft: {
    datasetId: "csv_sales",
    datasetLabel: "CSV Sales",
    description: "Uploaded sales dataset.",
    sourceMode: "database" as const,
    timeCoverage: "2026-04-01 to 2026-04-10",
    dimensions: [],
    metrics: [],
    sources: [],
    notes: [],
  },
  profileSnapshot: {
    datasetId: "csv_sales",
    datasetLabel: "CSV Sales",
    datasetDescription: "Uploaded sales dataset.",
    sourceMode: "database" as const,
    dateCoverage: {
      startDate: "2026-04-01",
      endDate: "2026-04-10",
    },
    sourceHealth: [
      {
        id: "postgres",
        name: "Onboarded CSV facts",
        type: "postgres" as const,
        status: "connected" as const,
        detail: "12 imported rows",
        recordCount: 12,
      },
    ],
    schemaSnapshot: {
      postgres: [],
      mongodb: [],
    },
    sourceCounts: [],
  },
  columns: [
    {
      name: "date",
      normalizedName: "date",
      label: "Date",
      type: "date" as const,
      nullRatio: 0,
      distinctCount: 10,
      sampleValues: ["2026-04-01"],
      isIdentifier: false,
      isDimension: false,
      isMeasure: false,
      isTimeField: true,
    },
  ],
  previewRows: {
    columns: ["date", "revenue"],
    rows: [{ date: "2026-04-01", revenue: 12450.5 }],
    totalRows: 1,
    truncated: false,
  },
}

vi.mock("@/lib/querylens/server/dataset-registry", () => ({
  getOnboardedDatasetRecord: async (datasetId: string) =>
    datasetId === "csv_sales" ? csvSalesDataset : undefined,
  listOnboardedDatasetRecords: async () => [csvSalesDataset],
}))

import ExplorerPage from "@/app/explorer/page"

describe("/explorer page", () => {
  it("renders the source context experience", async () => {
    const element = await ExplorerPage()
    const html = renderToStaticMarkup(element)

    expect(html).toContain("Source context")
    expect(html).toContain("Connected sources")
    expect(html).toContain("PostgreSQL preview")
    expect(html).toContain("MongoDB preview")
    expect(html).toContain("Uploaded CSV datasets")
    expect(html).toContain("CSV Sales sample records")
    expect(html).toContain("Open dataset context")
  })

  it("renders uploaded dataset source context when a dataset id is selected", async () => {
    const element = await ExplorerPage({
      searchParams: Promise.resolve({ datasetId: "csv_sales" }),
    })
    const html = renderToStaticMarkup(element)

    expect(html).toContain("CSV Sales")
    expect(html).toContain("Uploaded CSV mode")
    expect(html).toContain("12 imported rows")
    expect(html).toContain("querylens_dataset_rows_csv_sales")
    expect(html).toContain("CSV sample records")
    expect(html).not.toContain("MongoDB Objects")
    expect(html).not.toContain("MongoDB preview")
  })

  it("renders a missing state instead of the built-in source context for an unknown uploaded dataset", async () => {
    const element = await ExplorerPage({
      searchParams: Promise.resolve({ datasetId: "csv_missing" }),
    })
    const html = renderToStaticMarkup(element)

    expect(html).toContain("Dataset not found")
    expect(html).toContain("csv_missing")
    expect(html).not.toContain("Live database mode")
    expect(html).not.toContain("SME portfolio")
  })
})
