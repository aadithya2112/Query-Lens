import { afterAll, describe, expect, it } from "vitest"

import { getQueryLensDatasetRuntime } from "@/lib/querylens/server/dataset-runtime"

const runIfDatabase =
  process.env.POSTGRES_URL && process.env.MONGODB_URL ? it : it.skip

describe("dataset runtime profile store", () => {
  it("uses the database runtime by default", async () => {
    const runtime = await getQueryLensDatasetRuntime()

    expect(runtime.dataAccess.sourceMode).toBe("database")
    expect(runtime.profileStore.sourceMode).toBe("database")
  })

  runIfDatabase("reads a live database profile snapshot", async () => {
    const runtime = await getQueryLensDatasetRuntime()
    const snapshot = await runtime.profileStore.getProfileSnapshot()

    expect(snapshot.sourceMode).toBe("database")
    expect(snapshot.sourceHealth.some((source) => source.status === "connected")).toBe(true)
  })
})

afterAll(async () => {
  await globalThis.__querylensPgPool?.end()
  globalThis.__querylensPgPool = undefined

  const mongoClient = await globalThis.__querylensMongoClientPromise
  await mongoClient?.close()
  globalThis.__querylensMongoClientPromise = undefined
})
