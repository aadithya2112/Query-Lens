import { calculateConfidenceScore } from "@/lib/querylens/scoring"

describe("calculateConfidenceScore", () => {
  it("rewards cross-source evidence", () => {
    const withoutMongo = calculateConfidenceScore({
      evidenceCount: 2,
      driverCount: 2,
      hasCrossSourceEvidence: false,
    })
    const withMongo = calculateConfidenceScore({
      evidenceCount: 4,
      driverCount: 3,
      hasCrossSourceEvidence: true,
    })

    expect(withMongo).toBeGreaterThan(withoutMongo)
  })
})
