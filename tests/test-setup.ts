import { vi } from "vitest"

process.env.QUERYLENS_REFERENCE_DATE = "2026-04-11"
process.env.QUERYLENS_AI_MODE = "deterministic"
delete process.env.GEMINI_API_KEY

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(async () => ({ userId: "test-clerk-user" })),
  clerkMiddleware: vi.fn(() => () => undefined),
  createRouteMatcher: vi.fn(() => () => false),
}))
