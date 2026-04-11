import { POST } from "@/app/api/query/route"

describe("/api/query", () => {
  it("returns a grounded analysis for the flagship question", async () => {
    const request = new Request("http://localhost/api/query", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        question: "Why did SME cashflow health drop last week?",
      }),
    })

    const response = await POST(request)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.metric).toBe("cashflow_health_score")
    expect(payload.sourceMode).toBe("fixture")
    expect(payload.fallback).not.toBe(true)
    expect(payload.headline.toLowerCase()).toContain("fell")
    expect(payload.drivers.length).toBeGreaterThanOrEqual(2)
    expect(payload.evidence.some((item: { sourceType: string }) => item.sourceType === "postgres")).toBe(true)
    expect(payload.evidence.some((item: { sourceType: string }) => item.sourceType === "mongodb")).toBe(true)
  })

  it("returns a guided fallback for unsupported questions", async () => {
    const request = new Request("http://localhost/api/query", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        question: "Why did revenue drop last month?",
      }),
    })

    const response = await POST(request)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.fallback).toBe(true)
    expect(payload.summary).toContain("cashflow health")
  })

  it("returns a grounded breakdown for at-risk accounts", async () => {
    const request = new Request("http://localhost/api/query", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        question: "What makes up at-risk accounts by region and sector last week?",
      }),
    })

    const response = await POST(request)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.metric).toBe("at_risk_account_count")
    expect(payload.sourceMode).toBe("fixture")
    expect(payload.fallback).not.toBe(true)
    expect(payload.headline.toLowerCase()).toContain("at-risk")
    expect(payload.drivers.length).toBeGreaterThanOrEqual(1)
    expect(payload.evidence.some((item: { sourceType: string }) => item.sourceType === "postgres")).toBe(true)
  })

  it("returns a grounded timeframe compare for cashflow health", async () => {
    const request = new Request("http://localhost/api/query", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        question: "Compare cashflow health this week vs last week",
      }),
    })

    const response = await POST(request)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.metric).toBe("cashflow_health_score")
    expect(payload.fallback).not.toBe(true)
    expect(payload.comparisonSummary?.mode).toBe("timeframe")
    expect(payload.comparisonSummary?.leftLabel).toContain("This week")
    expect(payload.evidence.some((item: { sourceType: string }) => item.sourceType === "postgres")).toBe(true)
    expect(payload.evidence.some((item: { sourceType: string }) => item.sourceType === "mongodb")).toBe(true)
  })

  it("returns a grounded region peer compare for cashflow health", async () => {
    const request = new Request("http://localhost/api/query", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        question: "Compare North West vs London & South East cashflow health last week",
      }),
    })

    const response = await POST(request)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.metric).toBe("cashflow_health_score")
    expect(payload.fallback).not.toBe(true)
    expect(payload.comparisonSummary?.mode).toBe("peer")
    expect(payload.comparisonSummary?.leftLabel).toBe("North West")
    expect(payload.comparisonSummary?.rightLabel).toBe("London & South East")
  })

  it("returns a grounded sector peer compare for cashflow health", async () => {
    const request = new Request("http://localhost/api/query", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        question: "Compare hospitality vs retail cashflow health this week",
      }),
    })

    const response = await POST(request)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.metric).toBe("cashflow_health_score")
    expect(payload.fallback).not.toBe(true)
    expect(payload.comparisonSummary?.mode).toBe("peer")
    expect(payload.comparisonSummary?.leftLabel).toBe("Hospitality")
    expect(payload.comparisonSummary?.rightLabel).toBe("Retail")
  })
})
