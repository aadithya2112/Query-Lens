# Agent Brief

- QueryLens is a trust-first analytics workspace that should evolve from a seeded demo into a governed, adaptable analytics system.
- The long-term product direction is: **bring data in -> understand it semantically -> let agents plan analysis -> execute safely -> show trust clearly.**
- Shipped today: `discovery`, `what changed`, and `compare` for `cashflow_health_score`, plus `breakdown` for `at_risk_account_count`, over the current SME portfolio dataset.
- The app supports both fixture mode and Docker-backed database mode, with `pgvector` retrieval and conversational memory already in place.
- Gemini is required for the main interactive planning flow; deterministic interactive parsing is scaffolding, not the intended product experience.
- The target architecture is:
  - agentic for understanding
  - deterministic for execution
  - agentic for explanation
- The next major product moves are dataset onboarding, semantic layer generation, guarded agentic planning, a unified execution plan, stronger trust scoring, and weekly briefing.
- Start with structured data as the source of analytic truth: CSV, structured JSON, Postgres, and Mongo-backed tabular views.
- Treat text files, notes, and documents as contextual evidence for retrieval and corroboration, not as the primary source of metric computation.
- Keep execution bounded, inspectable, and governed by explicit capabilities and validation rules.
- Keep the architecture as a single `Next.js` service with Dockerized `Postgres` and `MongoDB`.
- Use Bun as the primary local validation path.
- Keep trust UX central: evidence, assumptions, source transparency, interpretation trace, and metric context should always stay visible.
- Do not present dataset onboarding, weekly briefing, or generalized multi-dataset support as shipped until they are real.
- Keep all documentation precise about what exists now versus what is still planned.
