import { afterAll, describe, expect, it } from "vitest"

import { POST } from "@/app/api/query/route"

const runIfDatabase =
  process.env.POSTGRES_URL && process.env.MONGODB_URL ? it : it.skip

describe.sequential("/api/query database mode", () => {
  runIfDatabase(
    "returns a grounded database-backed analysis for the flagship question",
    async () => {
      delete process.env.QUERYLENS_DATA_MODE
      process.env.QUERYLENS_REFERENCE_DATE = "2026-04-11"

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
      expect(payload.sourceMode).toBe("database")
      expect(payload.fallback).not.toBe(true)
      expect(payload.headline.toLowerCase()).toContain("fell")
      expect(payload.evidence.some((item: { sourceType: string }) => item.sourceType === "postgres")).toBe(true)
      expect(payload.evidence.some((item: { sourceType: string }) => item.sourceType === "mongodb")).toBe(true)
    }
  )
})

afterAll(async () => {
  await globalThis.__querylensPgPool?.end()
  globalThis.__querylensPgPool = undefined

  const mongoClient = await globalThis.__querylensMongoClientPromise
  await mongoClient?.close()
  globalThis.__querylensMongoClientPromise = undefined

  process.env.QUERYLENS_DATA_MODE = "fixture"
})
