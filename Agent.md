# Agent Notes

- Current checkpoint series:
  - `4bdd671` phase-1 vertical slice
  - `31f6f3f` database-mode parity fix
  - `41dff15` submission-ready packaging cleanup
- Current product state: `what changed` and `compare` for `cashflow_health_score`, plus `breakdown` for `at_risk_account_count`, are implemented, with both fixture mode and Docker-backed `database` mode working
- Current engineering priority: Stage 3 compare is shipped; `weekly briefing` is the next user-visible slice
- Keep the app as a single `Next.js` service with Dockerized `Postgres` and `MongoDB`
- Use Bun as the primary local validation path
- Do not present dataset onboarding or `weekly briefing` as shipped yet
- Keep the trust UX central: evidence, assumptions, source transparency, and metric framing must remain visible
- Keep documentation honest about what is implemented versus deferred
