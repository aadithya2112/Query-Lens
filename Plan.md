# QueryLens Plan

## Current Checkpoint

- Phase 1 is implemented as a local-first vertical slice and committed at `4bdd671`.
- The app is now branded as `QueryLens` and runs as a single `Next.js` service.
- `Docker Compose`, the built-in sample dataset, `Vitest`, `Playwright`, and Bun-based build validation are in place.
- The current shipped capability now includes four narrow but strong flows:
  - `discovery` for dataset and source questions
  - `what changed` for `cashflow_health_score`
  - `breakdown` for `at_risk_account_count`
- Stage 3 compare is now shipped for `cashflow_health_score`, covering week-over-week and peer comparisons within the current weekly windows.
- Conversational retrieval is now shipped with `pgvector` metadata retrieval and browser/server conversation memory.
- The live `database` mode path, submission-ready packaging cleanup, and root `README.md` are now complete.
- Stage 1 foundation is now in place: built-in dataset abstraction, structured query plans, a generic orchestrator, and a dedicated `what changed` executor.

## What Is Already Done

### Experience

- The three-pane prototype shell has been repurposed into a `QueryLens` workspace.
- Chat is the main interaction surface.
- The workspace now persists a browser `chatId`, visible conversation history, and the last active analysis across refreshes.
- The center panel is now evidence-first, with intent-aware trend/breakdown views, ranked insights, source evidence, assumptions, and metric framing.
- Broad metadata questions now render a dedicated discovery view with dataset, source, time-coverage, and suggested-question context.
- The default first-run state is loaded with the flagship question.

### Data and Infrastructure

- `Postgres` and `MongoDB` are defined in `docker-compose.yml`.
- One synthetic 12-week SME portfolio is bundled as the current sample dataset, including a deliberate downturn narrative for demo clarity.
- `Postgres` stores canonical weekly and daily facts.
- `Postgres` now also stores `pgvector` catalog chunks and conversation-memory chunks for lightweight RAG.
- `MongoDB` stores supporting complaints, incidents, alerts, and RM notes.
- A repo-managed manifest defines the phase-1 metric and its weighted scoring model.

### Server Flow

- `POST /api/query` and `GET /api/metrics` are implemented.
- Query handling now serves `discovery`, `what changed`, `breakdown`, and `compare` through the generalized internal query engine.
- The server now uses a built-in dataset definition, a structured query-plan model, a generic orchestrator, and a registered intent executor.
- Gemini-assisted planning and narrative generation remain constrained, Gemini planning is now required for the main interactive path, and retrieval now feeds planning with dataset and conversation context.

### Quality and Stability

- Remote Google font fetching has been removed from the build path.
- Bun `lint`, `test`, `build`, and the Playwright smoke flow pass in the current sample-dataset flow.
- Docker services boot and the sample-data load script completes successfully.

## Current Product Gap

The current product is demoable and now honestly LLM-first for interactive questions, but it still falls short of the full challenge brief.

- Shipped today:
  - one built-in sample dataset
  - two metrics
  - four intent families: `discovery`, `what changed`, `breakdown`, and `compare`
  - Gemini-required interactive planning, Gemini embeddings for retrieval, and Gemini-assisted narration with deterministic data execution
  - Stage 1 engine foundations for future intents
- Still required for a requirements-complete submission:
  - reusable dataset onboarding
  - `weekly briefing`
  - richer trust/debug UX on top of the generalized engine

## Immediate Next Stage

### Stage 5: Weekly Briefing

Status: next implementation stage.

- Keep the built-in portfolio as the demo dataset for now; user-supplied data is still deferred.
- Build one concise weekly briefing flow on top of the existing planner and orchestrator.
- Keep the current `what changed`, `breakdown`, and `compare` flows stable.
- Reuse the same evidence-first trust surface instead of introducing a separate report page.

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
  - trust/debug polish and richer retrieval trace UX

## Next Fully Testable Slice

### Goal

Use the completed compare slice and LLM-first pivot to ship the next user-visible capability:

- `weekly briefing`, starting with one clear sample-dataset portfolio briefing flow

### Done When

- the chosen stage is isolated, testable, and commit-sized
- Bun `lint`, `test`, and `build` remain green
- the new stage is reflected honestly in the docs and demo story
- the briefing flow remains evidence-backed and easy to demo

### Order of Work

1. Add a `weekly briefing` intent and executor on top of the current planner/orchestrator.
2. Keep the current `discovery`, `what changed`, `breakdown`, and `compare` flows stable.
3. Add focused tests and one clear briefing smoke flow.
4. Re-run the full validation stack and update docs if the shipped surface changes.

## Defaults and Boundaries

- Keep the app as a single `Next.js` service.
- Keep phase 1 local-first and Docker-backed.
- Keep the built-in sample dataset for the demo until dataset onboarding is implemented.
- Do not jump to broad autonomous-agent behavior; keep Gemini constrained and the execution path deterministic after planning.
- Add one small, fully tested stage at a time.
