import { afterAll, describe, expect, it } from "vitest"

import { getQueryLensDatasetRuntime } from "@/lib/querylens/server/dataset-runtime"

const runIfDatabase =
  process.env.POSTGRES_URL && process.env.MONGODB_URL ? it : it.skip

describe("dataset runtime profile store", () => {
  it("returns a stable fixture profile snapshot with source health, schema, and coverage", async () => {
    process.env.QUERYLENS_DATA_MODE = "fixture"

    const { dataAccess, profileStore } = await getQueryLensDatasetRuntime()
    const snapshot = await profileStore.getProfileSnapshot()

    expect(dataAccess.sourceMode).toBe("fixture")
    expect(profileStore.sourceMode).toBe("fixture")
    expect(snapshot.sourceMode).toBe("fixture")
    expect(snapshot.datasetId).toBe("sme_portfolio")
    expect(snapshot.sourceHealth).toHaveLength(3)
    expect(snapshot.schemaSnapshot.postgres.length).toBeGreaterThan(0)
    expect(snapshot.schemaSnapshot.mongodb.length).toBeGreaterThan(0)
    expect(snapshot.dateCoverage.startDate).toBe("2026-01-19")
    expect(snapshot.dateCoverage.endDate).toBe("2026-04-12")
    expect(snapshot.sourceCounts.find((count) => count.sourceId === "postgres")?.recordCount).toBeGreaterThan(0)
  })

  it("builds a deterministic semantic draft for the fixture profile", async () => {
    process.env.QUERYLENS_DATA_MODE = "fixture"

    const { profileStore } = await getQueryLensDatasetRuntime()
    const [first, second] = await Promise.all([
      profileStore.getSemanticDraft(),
      profileStore.getSemanticDraft(),
    ])

    expect(first).toEqual(second)
    expect(first.datasetLabel).toBe("SME portfolio")
    expect(first.timeCoverage).toBe("2026-01-19 to 2026-04-12")
    expect(first.sources.map((source) => source.label)).toEqual(
      expect.arrayContaining(["Postgres facts", "Mongo context", "Semantic manifest"])
    )
  })

  it("falls back to the fixture runtime when fixture mode is forced", async () => {
    process.env.QUERYLENS_DATA_MODE = "fixture"

    const runtime = await getQueryLensDatasetRuntime()

    expect(runtime.dataAccess.sourceMode).toBe("fixture")
    expect(runtime.profileStore.sourceMode).toBe("fixture")
  })

  runIfDatabase("uses the database runtime when live adapters are available", async () => {
    delete process.env.QUERYLENS_DATA_MODE

    const runtime = await getQueryLensDatasetRuntime()
    const snapshot = await runtime.profileStore.getProfileSnapshot()

    expect(runtime.dataAccess.sourceMode).toBe("database")
    expect(runtime.profileStore.sourceMode).toBe("database")
    expect(snapshot.sourceMode).toBe("database")
    expect(snapshot.sourceHealth.some((source) => source.status === "connected")).toBe(true)
  })
})

afterAll(async () => {
  process.env.QUERYLENS_DATA_MODE = "fixture"

  await globalThis.__querylensPgPool?.end()
  globalThis.__querylensPgPool = undefined

  const mongoClient = await globalThis.__querylensMongoClientPromise
  await mongoClient?.close()
  globalThis.__querylensMongoClientPromise = undefined
})
