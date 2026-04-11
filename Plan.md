# QueryLens Plan

## Current Checkpoint

- Phase 1 is implemented as a local-first vertical slice and committed at `4bdd671`.
- The app is now branded as `QueryLens` and runs as a single `Next.js` service.
- `Docker Compose`, seed data, `Vitest`, `Playwright`, and Bun-based build validation are in place.
- The current shipped capability is one narrow but strong flow: `what changed` for `cashflow_health_score`.
- The live `database` mode path, submission-ready packaging cleanup, and root `README.md` are now complete.

## What Is Already Done

### Experience

- The three-pane prototype shell has been repurposed into a `QueryLens` workspace.
- Chat is the main interaction surface.
- The center panel is now evidence-first, with trend, drivers, source evidence, assumptions, and metric framing.
- The default first-run state is seeded with the flagship question.

### Data and Infrastructure

- `Postgres` and `MongoDB` are defined in `docker-compose.yml`.
- One synthetic 12-week SME portfolio is seeded with a deliberate final-week downturn narrative.
- `Postgres` stores canonical weekly and daily facts.
- `MongoDB` stores supporting complaints, incidents, alerts, and RM notes.
- A repo-managed manifest defines the phase-1 metric and its weighted scoring model.

### Server Flow

- `POST /api/query` and `GET /api/metrics` are implemented.
- Query handling is deterministic and constrained to the phase-1 `what changed` flow.
- The server parses the question, validates scope and timeframe, queries data sources, ranks evidence, and renders a grounded response.
- The phase-1 provider now supports optional Gemini-assisted parsing and narrative generation with deterministic fallback.

### Quality and Stability

- Remote Google font fetching has been removed from the build path.
- Bun `lint`, `test`, `build`, and the Playwright smoke flow pass in the current fixture-backed flow.
- Docker services boot and the seed script completes successfully.

## Remaining Tasks

1. Keep the repo honest and polished as the product grows.
   - Keep planning and architecture notes aligned with the latest shipped stages.
   - Keep the submission story centered on what is actually implemented.

2. Defer broader feature work until a new stage is deliberately chosen.
   - `breakdown`
   - `compare`
   - `weekly briefing`
   - richer Gemini usage beyond the current constrained parsing and narration path

## Next Fully Testable Slice

### Goal

Choose one narrow next stage and complete it end to end:

- a second product slice such as `breakdown`
- or the second product slice: `breakdown` for at-risk accounts by region and sector

### Done When

- the chosen stage is isolated, testable, and commit-sized
- Bun `lint`, `test`, and `build` remain green
- the new stage is reflected honestly in the docs and demo story

### Order of Work

1. Pick the next product slice, most likely `breakdown`, now that the Gemini-assisted phase-1 flow is in place.
2. Implement only that stage without expanding into adjacent feature families.
3. Add focused tests and one demoable gold-path flow.
4. Re-run the full validation stack and update docs if the shipped surface changes.

## Defaults and Boundaries

- Keep the app as a single `Next.js` service.
- Keep phase 1 local-first and Docker-backed.
- Keep fixture mode as the safe fallback when databases are unavailable.
- Do not expand product scope broadly; add one small, fully tested stage at a time.
