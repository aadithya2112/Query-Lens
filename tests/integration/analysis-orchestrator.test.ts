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

  it("dispatches timeframe compare questions through the compare executor", async () => {
    const payload = await analyzeQuery({
      question: "Compare cashflow health this week vs last week",
    })

    expect(payload.fallback).not.toBe(true)
    expect(payload.metric).toBe("cashflow_health_score")
    expect(payload.comparisonSummary?.mode).toBe("timeframe")
    expect(payload.evidence.some((item) => item.sourceType === "postgres")).toBe(true)
  })

  it("dispatches vague metadata questions through the discovery executor", async () => {
    const payload = await analyzeQuery({
      question: "What data is currently stored?",
      chatId: "discovery-test",
    })

    expect(payload.fallback).not.toBe(true)
    expect(payload.intent).toBe("discovery")
    expect(payload.metric).toBe("dataset_catalog")
    expect(payload.discoverySummary?.datasetLabel).toBe("SME portfolio")
    expect(payload.catalogSections?.length).toBeGreaterThan(0)
    expect(payload.evidence.length).toBeGreaterThan(0)
  })

  it("persists conversational context when chatId is present", async () => {
    await analyzeQuery({
      question: "What data is currently stored?",
      chatId: "memory-test",
    })

    const followUp = await analyzeQuery({
      question: "What metrics are available?",
      chatId: "memory-test",
    })

    expect(followUp.intent).toBe("discovery")
    expect(followUp.conversationContextUsed).toBe(true)
    expect(followUp.retrievalTrace?.recentMessagesCount).toBeGreaterThan(0)
  })
})
