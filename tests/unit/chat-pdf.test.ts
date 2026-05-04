import { describe, expect, it } from "vitest"
import { PDFDocument } from "pdf-lib"

import { buildChatTranscriptPdf } from "@/lib/querylens/server/chat-pdf"

describe("chat transcript pdf builder", () => {
  it("creates a valid PDF document for chat messages", async () => {
    const bytes = await buildChatTranscriptPdf({
      title: "QueryLens Chat Export",
      datasetId: "sme_portfolio",
      generatedAt: new Date("2026-05-04T06:00:00.000Z"),
      messages: [
        {
          role: "user",
          text: "What is this month's portfolio trend?",
          createdAt: Date.now(),
        },
        {
          role: "assistant",
          text: "The trend is improving with lower delinquency in the SME segment.",
          createdAt: Date.now() + 1_000,
        },
      ],
    })

    expect(bytes.length).toBeGreaterThan(700)

    const parsed = await PDFDocument.load(bytes)
    expect(parsed.getPageCount()).toBeGreaterThanOrEqual(1)
  })

  it("embeds chart visuals for assistant messages", async () => {
    const bytes = await buildChatTranscriptPdf({
      title: "QueryLens Chat Export",
      generatedAt: new Date("2026-05-04T06:00:00.000Z"),
      messages: [
        {
          role: "assistant",
          text: "Here is the updated weekly balance trend.",
          chartTitle: "Weekly balance trend",
          chartSpec: {
            type: "line",
            title: "Weekly balance trend",
            explanation: "Portfolio closing balance moved up over four weeks.",
            xKey: "week",
            yKey: "value",
            data: [
              { week: "W1", value: 120 },
              { week: "W2", value: 138 },
              { week: "W3", value: 145 },
              { week: "W4", value: 162 },
            ],
          },
        },
      ],
    })

    expect(bytes.length).toBeGreaterThan(1_500)
    const parsed = await PDFDocument.load(bytes)
    expect(parsed.getPageCount()).toBeGreaterThanOrEqual(1)
  })
})
