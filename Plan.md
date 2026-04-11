# QueryLens Plan

## Goal

Build a winning-worthy demo that lets judges ask natural-language questions about a synthetic SME banking portfolio and receive clear, fast, evidence-backed answers.

## Success Criteria

- A judge can reach a meaningful insight in under 30 seconds.
- The product feels tailored to a NatWest-adjacent business context rather than a generic analytics toy.
- Every answer includes visible evidence, assumptions, and metric context.
- The app is stable to run locally and easy to explain in a short demo.
- The repository is submission-ready with honest documentation, setup steps, and a clear architecture story.

## Product Scope

- Read-only web app built in `Next.js`
- Seeded synthetic SME banking portfolio
- `Postgres` for structured portfolio facts
- `MongoDB` for contextual notes, alerts, and incidents
- Natural-language query flows for:
  - what changed
  - breakdown
  - compare
  - weekly summary

## Workstreams

### 1. Product Reframe

- Rename the experience from a generic `DataTalk AI` demo to `QueryLens`.
- Rewrite all copy, prompts, and sample narratives around SME banking portfolio intelligence.
- Tighten the feature set around high-confidence demo flows only.

### 2. Data Foundation

- Design a synthetic portfolio schema with believable regional, sector, and risk patterns.
- Seed `Postgres` with balances, payments, utilization, arrears, and KPI facts.
- Seed `MongoDB` with complaints, incidents, relationship-manager notes, and alerts.
- Create a semantic manifest for metrics, dimensions, synonyms, and approved query templates.

### 3. Intelligence Layer

- Replace the mock engine with a constrained planner.
- Use the LLM only for structured intent parsing and grounded explanation generation.
- Validate all requests against supported metrics, dimensions, and time windows.
- Generate evidence packages before generating narratives.

### 4. Experience Redesign

- Keep the three-pane shell from the prototype.
- Convert the center panel from SQL-first to evidence-first.
- Keep chat as the primary interaction model.
- Add a visible trust layer for confidence, assumptions, evidence, and source lineage.

### 5. Infrastructure and Delivery

- Run local services with `Docker Compose`.
- Keep the app deployable as a single `Next.js` web app.
- Add seed scripts, environment examples, and a judge-friendly README.

### 6. Submission Polish

- Add screenshots and a short architecture note.
- Prepare a concise demo script with the 4 flagship questions.
- Document limitations honestly.
- Ensure the repository structure is easy for judges to inspect.

## Phase Order

1. Create architecture and planning docs
2. Define data model and seed strategy
3. Add Docker infrastructure
4. Replace mock query engine with server-side orchestration
5. Rework the prototype UI around the new product story
6. Write README, demo script, and submission polish docs

## Non-Goals for v1

- Arbitrary CSV upload
- Free-form SQL editing as a main user path
- Multi-tenant auth or user management
- Autonomous agents that query databases without guardrails
- A separate backend service unless a real need emerges
