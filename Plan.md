# QueryLens Plan

## Current Checkpoint

- Phase 1 is implemented as a local-first vertical slice and committed at `4bdd671`.
- The app is now branded as `QueryLens` and runs as a single `Next.js` service.
- `Docker Compose`, the built-in sample dataset, `Vitest`, `Playwright`, and Bun-based build validation are in place.
- The current shipped capability now includes two narrow but strong flows:
  - `what changed` for `cashflow_health_score`
  - `breakdown` for `at_risk_account_count`
- Stage 3 compare is now shipped for `cashflow_health_score`, covering week-over-week and peer comparisons within the current weekly windows.
- The live `database` mode path, submission-ready packaging cleanup, and root `README.md` are now complete.
- Stage 1 foundation is now in place: built-in dataset abstraction, structured query plans, a generic orchestrator, and a dedicated `what changed` executor.

## What Is Already Done

### Experience

- The three-pane prototype shell has been repurposed into a `QueryLens` workspace.
- Chat is the main interaction surface.
- The center panel is now evidence-first, with intent-aware trend/breakdown views, ranked insights, source evidence, assumptions, and metric framing.
- The default first-run state is loaded with the flagship question.

### Data and Infrastructure

- `Postgres` and `MongoDB` are defined in `docker-compose.yml`.
- One synthetic 12-week SME portfolio is bundled as the current sample dataset, including a deliberate downturn narrative for demo clarity.
- `Postgres` stores canonical weekly and daily facts.
- `MongoDB` stores supporting complaints, incidents, alerts, and RM notes.
- A repo-managed manifest defines the phase-1 metric and its weighted scoring model.

### Server Flow

- `POST /api/query` and `GET /api/metrics` are implemented.
- Query handling now serves `what changed`, `breakdown`, and `compare` through the generalized internal query engine.
- The server now uses a built-in dataset definition, a structured query-plan model, a generic orchestrator, and a registered intent executor.
- Gemini-assisted planning and narrative generation remain constrained, and deterministic parsing fallback is still present in the current interactive path.

### Quality and Stability

- Remote Google font fetching has been removed from the build path.
- Bun `lint`, `test`, `build`, and the Playwright smoke flow pass in the current sample-dataset flow.
- Docker services boot and the sample-data load script completes successfully.

## Current Product Gap

The current product is demoable, but it still falls short of the challenge brief in one important way: it can answer the current supported questions without truly requiring LLM interpretation.

- Shipped today:
  - one built-in sample dataset
  - two metrics
  - three intent families: `what changed`, `breakdown`, and `compare`
  - Gemini-assisted parsing and narration with deterministic data execution
  - Stage 1 engine foundations for future intents
- Still required for a requirements-complete submission:
  - an LLM-first interactive planning path
  - reusable dataset onboarding
  - `weekly briefing`
  - richer trust/debug UX on top of the generalized engine

## Immediate Next Stage

### Stage 4 Pivot: LLM-First QueryLens

Status: next implementation stage.

- Keep the built-in portfolio as the demo dataset for now; user-supplied data is still deferred.
- Remove deterministic parsing as the normal interactive path.
- Require Gemini planning for `POST /api/query` and return an honest guided failure when Gemini cannot safely interpret a request.
- Keep execution deterministic after planning so evidence, charts, confidence, and source reads remain grounded.
- Reframe the product story from “seeded demo logic” to “LLM-first analytics over a sample dataset.”

## Requirements Completion Roadmap

### Step 1. Generalize the Core Query Engine

Status: complete for the built-in SME portfolio dataset.

- Replace the phase-1-only parser contract with a reusable structured query plan.
- Keep Gemini constrained to structured parsing and wording only.
- Keep data retrieval deterministic and manifest-driven.

### Step 2. Make Interactive Queries LLM-First

- Make Gemini planning mandatory for supported interactive queries.
- Remove silent deterministic parsing fallback from the main path.
- Keep bootstrap reliable and deterministic so the app still opens cleanly.

### Step 3. Add Reusable Dataset Onboarding

- Introduce dataset manifests, schema profiling, and a reusable onboarding path for tabular datasets.
- Keep the current SME portfolio as the built-in default judged dataset.

### Step 4. Add the Missing Product Use Cases

- `weekly briefing`

Recommended implementation order:

1. `weekly briefing`

### Step 5. Upgrade the Workspace for Multi-Intent Answers

- Add dataset selection.
- Render intent-specific result surfaces while keeping evidence first.
- Expose a lightweight interpretation trace so users can see how QueryLens understood the request.

### Step 6. Tighten Trust, Clarity, and Speed

- Expand source attribution, assumptions, and confidence rules.
- Add privacy-aware dataset handling for onboarded data.
- Keep the local demo fast and honest under fallback conditions.

## Remaining Tasks

1. Keep the repo honest and polished as the product grows.
   - Keep planning and architecture notes aligned with the latest shipped stages.
   - Keep the submission story centered on what is actually implemented.

2. Work through the requirements roadmap one stage at a time.
   - LLM-first interactive planning
   - dataset onboarding
   - `weekly briefing`
   - trust/debug polish

## Next Fully Testable Slice

### Goal

Use the completed Stage 3 compare slice to pivot the engine into an honest LLM-first product:

- Gemini becomes required for interactive planning
- deterministic parsing fallback is removed from the main interactive path
- the built-in portfolio is described and handled as a sample dataset, not as the reason the app works

### Done When

- the chosen stage is isolated, testable, and commit-sized
- Bun `lint`, `test`, and `build` remain green
- the new stage is reflected honestly in the docs and demo story
- unsupported or model-unavailable cases fail honestly instead of silently falling back

### Order of Work

1. Update docs and product framing from “seeded demo” to “sample dataset”.
2. Make Gemini-required planning the interactive query path while keeping deterministic execution.
3. Keep the current `what changed`, `breakdown`, and `compare` flows stable under the new planner contract.
4. Add focused tests for model-unavailable and invalid-plan behavior.
5. Re-run the full validation stack and update docs if the shipped surface changes.

## Defaults and Boundaries

- Keep the app as a single `Next.js` service.
- Keep phase 1 local-first and Docker-backed.
- Keep the built-in sample dataset for the demo until dataset onboarding is implemented.
- Do not jump to broad autonomous-agent behavior; keep Gemini constrained and the execution path deterministic after planning.
- Add one small, fully tested stage at a time.
