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
})
