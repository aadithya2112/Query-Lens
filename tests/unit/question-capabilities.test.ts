import { describe, expect, it } from "vitest"

import { classifyBroadQuestion } from "@/lib/querylens/server/question-capabilities"

describe("broad question capability classifier", () => {
  it("recognizes uploaded CSV preview requests", () => {
    expect(classifyBroadQuestion("Show me the data in csv")).toBe("csv_preview")
    expect(classifyBroadQuestion("Preview uploaded rows")).toBe("csv_preview")
  })

  it("recognizes source and table catalog requests", () => {
    expect(
      classifyBroadQuestion(
        "Help me understand the data that's currently in the context, break it down by each table and source and what kind of data is stored.",
      ),
    ).toBe("source_catalog")
    expect(classifyBroadQuestion("What sources do you have?")).toBe("source_catalog")
  })

  it("recognizes visual overview and key insight requests", () => {
    expect(
      classifyBroadQuestion("Visualize the data and show me the most important information"),
    ).toBe("visual_overview")
    expect(classifyBroadQuestion("Show important trends")).toBe("visual_overview")
  })

  it("recognizes fully open-ended questions as clarification requests", () => {
    expect(classifyBroadQuestion("Any question")).toBe("clarification")
  })
})
