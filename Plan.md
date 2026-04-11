# QueryLens Plan

## Current Checkpoint

- Phase 1 is implemented as a local-first vertical slice and committed at `4bdd671`.
- The app is now branded as `QueryLens` and runs as a single `Next.js` service.
- `Docker Compose`, seed data, `Vitest`, `Playwright`, and Bun-based build validation are in place.
- The current shipped capability now includes two narrow but strong flows:
  - `what changed` for `cashflow_health_score`
  - `breakdown` for `at_risk_account_count`
- Stage 3 compare is now shipped for `cashflow_health_score`, covering week-over-week and peer comparisons within the seeded weekly windows.
- The live `database` mode path, submission-ready packaging cleanup, and root `README.md` are now complete.
- Stage 1 foundation is now in place: built-in dataset abstraction, structured query plans, a generic orchestrator, and a dedicated `what changed` executor.

## What Is Already Done

### Experience

- The three-pane prototype shell has been repurposed into a `QueryLens` workspace.
- Chat is the main interaction surface.
- The center panel is now evidence-first, with intent-aware trend/breakdown views, ranked insights, source evidence, assumptions, and metric framing.
- The default first-run state is seeded with the flagship question.

### Data and Infrastructure

- `Postgres` and `MongoDB` are defined in `docker-compose.yml`.
- One synthetic 12-week SME portfolio is seeded with a deliberate final-week downturn narrative.
- `Postgres` stores canonical weekly and daily facts.
- `MongoDB` stores supporting complaints, incidents, alerts, and RM notes.
- A repo-managed manifest defines the phase-1 metric and its weighted scoring model.

### Server Flow

- `POST /api/query` and `GET /api/metrics` are implemented.
- Query handling now serves `what changed`, `breakdown`, and `compare` through the generalized internal query engine.
- The server now uses a built-in dataset definition, a structured query-plan model, a generic orchestrator, and a registered intent executor.
- Gemini-assisted planning and narrative generation remain constrained and deterministic fallback remains intact.

### Quality and Stability

- Remote Google font fetching has been removed from the build path.
- Bun `lint`, `test`, `build`, and the Playwright smoke flow pass in the current fixture-backed flow.
- Docker services boot and the seed script completes successfully.

## Requirements Gap

The current product is demoable, but it does not yet satisfy the full challenge brief.

- Shipped today:
  - one dataset story
  - two metrics
  - three intent families: `what changed`, `breakdown`, and `compare`
  - Gemini-assisted parsing and narration with deterministic data execution
  - Stage 1 engine foundations for future intents
- Still required for a requirements-complete submission:
  - reusable dataset onboarding
  - `weekly briefing`
  - richer trust/debug UX on top of the generalized engine

## Requirements Completion Roadmap

### Step 1. Generalize the Core Query Engine

Status: complete for the built-in SME portfolio dataset.

- Replace the phase-1-only parser contract with a reusable structured query plan.
- Keep Gemini constrained to structured parsing and wording only.
- Keep data retrieval deterministic and manifest-driven.

### Step 2. Add Reusable Dataset Onboarding

- Introduce dataset manifests, schema profiling, and a reusable onboarding path for tabular datasets.
- Keep the current SME portfolio as the built-in default judged dataset.

### Step 3. Add the Missing Product Use Cases

- `weekly briefing`

Recommended implementation order:

1. `weekly briefing`

### Step 4. Upgrade the Workspace for Multi-Intent Answers

- Add dataset selection.
- Render intent-specific result surfaces while keeping evidence first.
- Expose a lightweight interpretation trace so users can see how QueryLens understood the request.

### Step 5. Tighten Trust, Clarity, and Speed

- Expand source attribution, assumptions, and confidence rules.
- Add privacy-aware dataset handling for onboarded data.
- Keep the local demo fast and honest under fallback conditions.

## Remaining Tasks

1. Keep the repo honest and polished as the product grows.
   - Keep planning and architecture notes aligned with the latest shipped stages.
   - Keep the submission story centered on what is actually implemented.

2. Work through the requirements roadmap one stage at a time.
   - dataset onboarding
   - `weekly briefing`
   - trust/debug polish

## Next Fully Testable Slice

### Goal

Use the completed Stage 3 compare slice to ship the next user-facing capability:

- `weekly briefing`, starting with one clear seeded portfolio briefing flow

### Done When

- the chosen stage is isolated, testable, and commit-sized
- Bun `lint`, `test`, and `build` remain green
- the new stage is reflected honestly in the docs and demo story

### Order of Work

1. Build `weekly briefing` on top of the current dataset abstraction, query-plan model, and orchestrator.
2. Keep the current `what changed`, `breakdown`, and `compare` flows stable while adding the new executor and UI surface.
3. Add focused tests and one demoable gold-path flow.
4. Re-run the full validation stack and update docs if the shipped surface changes.

## Defaults and Boundaries

- Keep the app as a single `Next.js` service.
- Keep phase 1 local-first and Docker-backed.
- Keep fixture mode as the safe fallback when databases are unavailable.
- Do not jump to broad autonomous-agent behavior; keep Gemini constrained and the execution path deterministic.
- Add one small, fully tested stage at a time.
