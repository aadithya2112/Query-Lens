import { describe, expect, it, vi } from "vitest"

const { listOnboardedDatasetRecordsMock } = vi.hoisted(() => ({
  listOnboardedDatasetRecordsMock: vi.fn(),
}))

vi.mock("@/lib/querylens/server/dataset-registry", () => ({
  listOnboardedDatasetRecords: listOnboardedDatasetRecordsMock,
}))

import { buildAgenticSourceCatalog } from "@/lib/querylens/server/agentic-source-catalog"
import type { DatasetProfileSnapshot, OnboardedDatasetRecord } from "@/lib/querylens/types"

function createRecord(args: {
  id: string
  label: string
  status: "active" | "draft"
}): OnboardedDatasetRecord {
  return {
    id: args.id,
    label: args.label,
    description: `${args.label} description`,
    status: args.status,
    sourceKind: "csv",
    sourceMode: "database",
    tableName: `${args.id}_table`,
    rowCount: 42,
    primaryTimeField: "date",
    grain: "daily",
    manifestVersion: 1,
    createdAt: "2026-05-03T00:00:00.000Z",
    updatedAt: "2026-05-03T00:00:00.000Z",
    semanticDraft: {
      datasetId: args.id,
      datasetLabel: args.label,
      description: `${args.label} semantic draft`,
      sourceMode: "database",
      timeCoverage: "2026-01-01 to 2026-04-01",
      dimensions: [
        {
          id: "region",
          label: "Region",
        },
      ],
      metrics: [
        {
          id: "revenue",
          label: "Revenue",
          supportedIntents: ["aggregate", "trend", "discovery"],
        },
      ],
      sources: [],
      notes: [],
    },
    profileSnapshot: undefined,
    columns: [
      {
        name: "date",
        normalizedName: "date",
        label: "Date",
        type: "date",
        nullRatio: 0,
        distinctCount: 31,
        sampleValues: ["2026-04-01"],
        isIdentifier: false,
        isDimension: true,
        isMeasure: false,
        isTimeField: true,
      },
    ],
    previewRows: {
      columns: ["date", "revenue"],
      rows: [{ date: "2026-04-01", revenue: 120 }],
      totalRows: 1,
      truncated: false,
    },
  }
}

const profileSnapshot: DatasetProfileSnapshot = {
  datasetId: "sme_portfolio",
  sourceMode: "database",
  datasetLabel: "SME portfolio",
  dateCoverage: {
    startDate: "2026-01-01",
    endDate: "2026-04-01",
  },
  sourceHealth: [
    {
      id: "postgres",
      name: "Built-in Postgres facts",
      type: "postgres",
      status: "connected",
      detail: "Built-in tables",
      recordCount: 1200,
    },
    {
      id: "mongodb",
      name: "Built-in Mongo context",
      type: "mongodb",
      status: "connected",
      detail: "Context collections",
      recordCount: 220,
    },
  ],
  schemaSnapshot: {
    postgres: [
      {
        name: "weekly_portfolio_metrics",
        description: "Weekly portfolio aggregates",
        rowCount: 12,
        columns: ["week_start", "cashflow_health_score"],
      },
    ],
    mongodb: [
      {
        name: "risk_alerts",
        description: "Contextual alerts",
        rowCount: 24,
        columns: ["week_start", "severity"],
      },
    ],
    csv: [],
  },
  sourceCounts: [
    {
      sourceId: "postgres",
      sourceLabel: "Built-in Postgres facts",
      recordCount: 1200,
    },
    {
      sourceId: "mongodb",
      sourceLabel: "Built-in Mongo context",
      recordCount: 220,
    },
  ],
}

describe("buildAgenticSourceCatalog", () => {
  it("includes built-in sources and only active uploaded CSV datasets", async () => {
    listOnboardedDatasetRecordsMock.mockResolvedValue([
      createRecord({
        id: "csv_active_sales",
        label: "Active Sales",
        status: "active",
      }),
      createRecord({
        id: "csv_draft_revenue",
        label: "Draft Revenue",
        status: "draft",
      }),
    ])

    const catalog = await buildAgenticSourceCatalog({
      profileSnapshot,
    })

    expect(catalog.entries.map((entry) => entry.id)).toEqual([
      "built_in_postgres",
      "built_in_mongodb",
      "csv_active_sales",
    ])
    expect(catalog.schema.csv).toHaveLength(1)
    expect(catalog.schema.csv[0]).toMatchObject({
      datasetId: "csv_active_sales",
      label: "Active Sales",
      tableName: "csv_active_sales_table",
      primaryTimeField: "date",
      metrics: [{ id: "revenue", label: "Revenue" }],
      dimensions: [{ id: "region", label: "Region" }],
    })
  })
})
