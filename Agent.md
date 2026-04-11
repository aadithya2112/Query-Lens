# Agent Notes

- Build `QueryLens` as a trust-first intelligence copilot for a synthetic NatWest-adjacent SME banking portfolio.
- Keep the app as `Next.js` full-stack in v1. Do not add a separate API service unless a concrete scaling or deployment need appears.
- Use seeded demo data only. No user-uploaded datasets in v1.
- Prefer `Docker Compose` for local infrastructure, with `Postgres` for canonical facts and `MongoDB` for contextual signals.
- Preserve the strongest parts of the current three-pane prototype shell, but replace the generic SQL playground behavior and e-commerce sample data.
- Optimize for 4 judging flows: `what changed`, `breakdown`, `compare`, and `weekly briefing`.
- Every answer must show evidence, metric definitions, assumptions, and source transparency. Trust UX is a primary feature, not a footer detail.
- Keep the product tone as `modern banking intelligence`: premium, calm, clear, and credible.
