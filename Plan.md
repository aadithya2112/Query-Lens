# QueryLens Plan

## Current Checkpoint

- Phase 1 is implemented as a local-first vertical slice and committed at `4bdd671`.
- The app is now branded as `QueryLens` and runs as a single `Next.js` service.
- `Docker Compose`, seed data, `Vitest`, `Playwright`, and Bun-based build validation are in place.
- The current shipped capability is one narrow but strong flow: `what changed` for `cashflow_health_score`.
- The next blocker is not feature breadth. It is finishing and proving `database` mode parity with the existing `fixture` mode.

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
- A provider interface exists, but phase 1 does not call a live LLM.

### Quality and Stability

- Remote Google font fetching has been removed from the build path.
- Bun `lint`, `test`, `build`, and the Playwright smoke flow pass in the current fixture-backed flow.
- Docker services boot and the seed script completes successfully.

## Remaining Tasks

1. Finish `database` mode parity for the flagship question.
   - Ensure real `Postgres` weekly rows line up with the phase-1 timeframe logic.
   - Ensure real `MongoDB` context is pulled into the same answer window.
   - Ensure the response is grounded and non-fallback in `database` mode.

2. Lock that parity with targeted regression coverage.
   - Add tests that catch SQL date normalization mistakes.
   - Add an integration assertion for `sourceMode: "database"` and cross-source evidence.

3. Make submission docs honest and complete.
   - Add `README.md` with setup, usage, scope, and limitations.
   - Keep all planning and architecture notes aligned with the actual delivered phase.

4. Defer broader feature work until the above is closed.
   - `breakdown`
   - `compare`
   - `weekly briefing`
   - any extra AI orchestration beyond the deterministic phase-1 provider

## Next Fully Testable Slice

### Goal

Complete and fully verify the flagship flow in real `database` mode:
`Why did SME cashflow health drop last week?`

### Done When

- Dockerized `Postgres` and `MongoDB` are healthy.
- The seed script runs successfully.
- `POST /api/query` returns a non-fallback `database` response for the flagship question.
- The response includes at least one `postgres` evidence item and one `mongodb` evidence item.
- Bun `lint`, `test`, and `build` remain green after the fix.

### Order of Work

1. Close the date and comparison-window mismatch in the repository layer.
2. Re-run the direct `database` mode query until it returns the grounded narrative instead of fallback.
3. Add regression tests for the real adapter path.
4. Re-run the full Bun validation stack and smoke flow.

## Defaults and Boundaries

- Keep the app as a single `Next.js` service.
- Keep phase 1 local-first and Docker-backed.
- Keep fixture mode as the safe fallback when databases are unavailable.
- Do not expand product scope until the one flagship `database` flow is completely proven.
