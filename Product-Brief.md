# Product Brief

## Vision

`QueryLens` helps non-technical stakeholders ask plain-English questions about data and receive answers they can trust immediately. It should feel like a modern intelligence cockpit, not a generic AI wrapper or a developer SQL console.

## Current Delivered Milestone

The current shipped milestone is intentionally narrow:

- one supported metric: `cashflow_health_score`
- one supported intent family: `what changed`
- one flagship question: `Why did SME cashflow health drop last week?`
- optional phase-1 scope filters for `region` and `sector`
- visible trust evidence from both structured facts and contextual signals
- Stage 1 foundation complete under the hood: built-in dataset abstraction, structured query plans, and a generic orchestrator

## Challenge Completion Direction

To meet the full hackathon brief, `QueryLens` needs to grow from this narrow vertical slice into a reusable natural-language analytics product with:

- reusable dataset onboarding for tabular data
- a semantic layer / metric manifest per dataset
- four supported intent families:
  - `what changed`
  - `breakdown`
  - `compare`
  - `weekly briefing`
- deterministic data execution with Gemini constrained to structured planning and wording

The immediate next user-visible step is `breakdown`, now that the Stage 1 engine groundwork is complete.

## Target User

The primary demo user is an executive, portfolio lead, or business analyst who needs quick answers without building dashboards or writing SQL.

## Product Promise

The product should combine three things in one short flow:

- `Clarity`: plain-English answers for non-experts
- `Trust`: visible evidence, definitions, and assumptions
- `Speed`: a meaningful answer in under two minutes for a live demo

## Why This Still Feels Winning-Worthy

- The story is specific and credible: synthetic SME banking intelligence rather than generic analytics chat.
- The answer is grounded across more than one data source.
- The interface makes the `why` legible instead of hiding it behind technical traces.
- The architecture is realistic enough to grow without forcing hackathon-only shortcuts into the main product story.

## North-Star Follow-Ons

These are part of the product direction, but they are not yet implemented and should not be presented as shipped:

1. `What makes up at-risk accounts by region and sector?`
2. `Compare hospitality vs retail SMEs this month.`
3. `Give me this week's portfolio briefing.`
4. `Ask the same style of questions against a newly onboarded tabular dataset.`

## Experience Rules

- Keep the tone calm, premium, and trustworthy.
- Keep chat as the interaction model, but always pair it with visible evidence.
- Prefer constrained, honest capability over broad but flimsy AI claims.
- Do not introduce a separate backend service for the hackathon build unless a later production need clearly forces it.
