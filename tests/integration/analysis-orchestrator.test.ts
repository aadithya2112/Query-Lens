import { analyzeQuery } from "@/lib/querylens/server/analysis-orchestrator"

describe("analysis orchestrator", () => {
  it("dispatches the flagship query through the what-changed executor", async () => {
    const payload = await analyzeQuery({
      question: "Why did SME cashflow health drop last week?",
    })

    expect(payload.fallback).not.toBe(true)
    expect(payload.metric).toBe("cashflow_health_score")
    expect(payload.drivers.length).toBeGreaterThanOrEqual(2)
    expect(payload.evidence.some((item) => item.sourceType === "postgres")).toBe(true)
    expect(payload.evidence.some((item) => item.sourceType === "mongodb")).toBe(true)
  })

  it("returns a guided fallback for unsupported questions", async () => {
    const payload = await analyzeQuery({
      question: "Why did revenue drop last month?",
    })

    expect(payload.fallback).toBe(true)
    expect(payload.summary).toContain("cashflow health")
  })

  it("dispatches breakdown questions through the new breakdown executor", async () => {
    const payload = await analyzeQuery({
      question: "What makes up at-risk accounts by region and sector last week?",
    })

    expect(payload.fallback).not.toBe(true)
    expect(payload.metric).toBe("at_risk_account_count")
    expect(payload.headline).toContain("at-risk")
    expect(payload.drivers.length).toBeGreaterThanOrEqual(1)
    expect(payload.evidence.some((item) => item.sourceType === "postgres")).toBe(true)
  })
})
