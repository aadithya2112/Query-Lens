import { defineConfig } from "@playwright/test"

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "QUERYLENS_DATA_MODE=fixture QUERYLENS_REFERENCE_DATE=2026-04-11 npm run dev",
    port: 3000,
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
