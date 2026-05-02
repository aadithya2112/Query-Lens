import { describe, expect, it } from "vitest"

import {
  buildColumnProfiles,
  inferColumnType,
  normalizeHeaders,
  parseCsv,
} from "@/lib/querylens/server/csv-onboarding"

describe("csv onboarding utilities", () => {
  it("parses quoted CSV values safely", () => {
    const rows = parseCsv('name,notes\nAcme,"North, East"\nBravo,"Line ""quoted"""')

    expect(rows).toEqual([
      ["name", "notes"],
      ["Acme", "North, East"],
      ["Bravo", 'Line "quoted"'],
    ])
  })

  it("normalizes duplicate and blank headers", () => {
    const headers = normalizeHeaders(["Revenue", "Revenue", ""])

    expect(headers.map((header) => header.normalizedName)).toEqual([
      "revenue",
      "revenue_2",
      "column_3",
    ])
  })

  it("infers numeric, boolean, and temporal column types", () => {
    expect(inferColumnType(["1", "2", "3"])).toBe("integer")
    expect(inferColumnType(["true", "false", "yes"])).toBe("boolean")
    expect(inferColumnType(["2026-04-01", "2026-04-02"])).toBe("date")
    expect(inferColumnType(["1.2", "3.4"])).toBe("number")
  })

  it("builds identifier, dimension, and measure profiles from row samples", () => {
    const headers = normalizeHeaders(["Customer ID", "Region", "Revenue"])
    const rows = [
      {
        customer_id: "A-100",
        region: "North",
        revenue: "125.50",
      },
      {
        customer_id: "A-101",
        region: "South",
        revenue: "300.00",
      },
    ]

    const profiles = buildColumnProfiles(headers, rows)

    expect(profiles.find((profile) => profile.normalizedName === "customer_id")).toMatchObject({
      isIdentifier: true,
      isMeasure: false,
    })
    expect(profiles.find((profile) => profile.normalizedName === "region")).toMatchObject({
      isDimension: true,
    })
    expect(profiles.find((profile) => profile.normalizedName === "revenue")).toMatchObject({
      type: "number",
      isMeasure: true,
    })
  })
})
