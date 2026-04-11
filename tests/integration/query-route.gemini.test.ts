import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { geminiGenerateMock } = vi.hoisted(() => ({
  geminiGenerateMock: vi.fn(),
}))
import { POST } from "@/app/api/query/route"

vi.mock("@/lib/querylens/server/gemini-client", () => ({
  generateGeminiResponse: geminiGenerateMock,
}))

describe("/api/query Gemini narrative mode", () => {
  beforeEach(() => {
    geminiGenerateMock.mockReset()
    process.env.QUERYLENS_AI_MODE = "gemini"
    process.env.GEMINI_API_KEY = "test-key"
    process.env.QUERYLENS_REFERENCE_DATE = "2026-04-11"
    process.env.QUERYLENS_DATA_MODE = "fixture"
  })

  afterEach(() => {
    process.env.QUERYLENS_AI_MODE = "deterministic"
    delete process.env.GEMINI_API_KEY
  })

  it("preserves deterministic analysis and swaps in Gemini narrative fields", async () => {
    geminiGenerateMock.mockResolvedValue({
      json: {
        headline: "Portfolio cashflow health fell 1.7 points",
        summary:
          "Gemini narrative tied the drop to payment coverage deterioration and settlement issues.",
        supportedFollowUps: [
          "Focus on the North West contribution to last week's drop",
          "Focus on hospitality SMEs last week",
          "What changed this week instead?",
        ],
      },
    })

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
    expect(payload.sourceMode).toBe("fixture")
    expect(payload.headline).toBe("Portfolio cashflow health fell 1.7 points")
    expect(payload.summary).toContain("Gemini narrative")
    expect(payload.drivers.length).toBeGreaterThanOrEqual(2)
    expect(payload.evidence.some((item: { sourceType: string }) => item.sourceType === "postgres")).toBe(true)
    expect(payload.evidence.some((item: { sourceType: string }) => item.sourceType === "mongodb")).toBe(true)
  })
})
