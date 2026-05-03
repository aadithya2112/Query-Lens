import { describe, expect, it } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

import EvidencePanel from "@/components/querylens/evidence-panel"
import type { Phase1AnalysisResponse } from "@/lib/querylens/types"

describe("EvidencePanel", () => {
  it("renders source audit and execution trace details for agentic answers", () => {
    const analysis: Phase1AnalysisResponse = {
      intent: "agentic_query",
      headline: "Agentic answer",
      summary: "Grounded by bounded source reads.",
      metric: "custom_query_result",
      timeframe: "Custom question",
      comparisonBasis: "Multi-source bounded synthesis",
      confidence: 84,
      activeScope: "Portfolio",
      drivers: [],
      evidence: [
        {
          sourceType: "postgres",
          sourceName: "Built-in Postgres facts",
          timeRange: "Last week",
          scope: "Portfolio",
          supportingFact: "Weekly score rose from 74.1 to 76.4.",
          queryTemplateId: "agentic-evidence-1",
        },
      ],
      assumptions: [],
      supportedFollowUps: [],
      sourceMode: "database",
      sourceAudit: {
        available: [
          {
            sourceId: "built_in_postgres",
            sourceType: "postgres",
            label: "Built-in Postgres facts",
            note: "Approved built-in table catalog.",
          },
          {
            sourceId: "csv_active_sales",
            sourceType: "csv",
            label: "Active Sales CSV",
            note: "Uploaded CSV rows.",
          },
        ],
        inspected: [
          {
            sourceId: "built_in_postgres",
            sourceType: "postgres",
            label: "Built-in Postgres facts",
            note: "Schema was inspected.",
          },
        ],
        used: [
          {
            sourceId: "built_in_postgres",
            sourceType: "postgres",
            label: "Built-in Postgres facts",
            note: "Rows were used in synthesis.",
          },
        ],
      },
      executionTrace: {
        planId: "agentic:test",
        entries: [
          {
            id: "planning",
            stage: "planning",
            status: "approved",
            message: "Entered bounded multi-source agent.",
          },
          {
            id: "source_read",
            stage: "source_read",
            status: "completed",
            message: "Executed approved read-only query.",
            metadata: {
              sourceId: "built_in_postgres",
              rows: 2,
            },
          },
        ],
      },
    }

    const html = renderToStaticMarkup(<EvidencePanel analysis={analysis} />)

    expect(html).toContain("Source audit")
    expect(html).toContain("Available sources")
    expect(html).toContain("Inspected sources")
    expect(html).toContain("Used in answer")
    expect(html).toContain("Execution trace (agentic:test)")
    expect(html).toContain("Entered bounded multi-source agent.")
    expect(html).toContain("source_read")
  })
})
