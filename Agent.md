# Agent Notes

- Current checkpoint series:
  - `4bdd671` phase-1 vertical slice
  - `31f6f3f` database-mode parity fix
  - `41dff15` submission-ready packaging cleanup
- Current product state: `discovery`, `what changed`, and `compare` for `cashflow_health_score`, plus `breakdown` for `at_risk_account_count`, are implemented over a built-in sample dataset, with both fixture mode and Docker-backed `database` mode working, `pgvector` retrieval/memory active, and interactive query planning requiring Gemini by default
- Current engineering priority: build `weekly briefing` on top of the current LLM-first planner and executor foundation
- Keep the app as a single `Next.js` service with Dockerized `Postgres` and `MongoDB`
- Use Bun as the primary local validation path
- Do not present dataset onboarding or `weekly briefing` as shipped yet
- Treat deterministic interactive parsing as test-only scaffolding, not shipped product behavior
- Keep the trust UX central: evidence, assumptions, source transparency, retrieval framing, and metric context must remain visible
- Keep documentation honest about what is implemented versus deferred
