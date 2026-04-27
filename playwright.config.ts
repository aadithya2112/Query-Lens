import { defineConfig } from "@playwright/test"

const port = Number(process.env.PLAYWRIGHT_PORT ?? 3100)

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  workers: 1,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "retain-on-failure",
  },
  webServer: {
    command:
      `PORT=${port} QUERYLENS_DATA_MODE=fixture QUERYLENS_REFERENCE_DATE=2026-04-11 QUERYLENS_AI_MODE=deterministic npm run dev`,
    port,
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
