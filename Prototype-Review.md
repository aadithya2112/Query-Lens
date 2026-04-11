# Prototype Review

## Overall Assessment

The current prototype is a strong visual and interaction starting point, but it is not yet aligned with the product we want to ship. The shell is worth preserving. The domain model, trust layer, and primary workflow need substantial rework.

## What Is Working

- The three-pane layout already feels like a serious analysis product rather than a toy chat app.
- The chat panel has strong interaction patterns: quick prompts, follow-ups, rich answer cards, and a good sense of conversational flow.
- The right-panel answer rendering is more polished than a typical hackathon mock and can support a premium final experience.
- The visual system already has cohesion, contrast, and motion that we can refine into a more credible banking product.

## What Is Not Working

- The current story is generic `talk to data` instead of a sharp NatWest-adjacent SME intelligence story.
- The sample data and copy are built around e-commerce and revenue analytics, which weakens relevance.
- The trust layer is simulated. Confidence, agent steps, sources, and data quality are currently invented rather than computed from real evidence.
- The SQL editor is too central for the audience we are targeting.
- File upload and arbitrary source ingestion add complexity that is out of scope for the seeded demo.
- The current `multi-agent` framing is stronger than the actual implementation and could feel gimmicky if left unchanged.

## Technical Issues Observed

- `npm run lint` currently fails because `eslint` is not installed/configured in the repository.
- `npm run build` failed in the current environment because `next/font/google` tries to fetch remote fonts during build.
- The data engine is monolithic and mock-driven, which makes it hard to evolve into a trustworthy architecture cleanly.

## Keep, Change, Remove

### Keep

- three-pane shell
- conversational workflow
- resizable chat panel
- rich answer cards
- compact chart and insight presentation

### Change

- rename and reposition the product as `QueryLens`
- replace the domain with synthetic SME banking portfolio data
- move the center panel from SQL editing to evidence and analysis
- turn trust indicators into real computed artifacts
- rewrite all prompts and narratives around the 4 flagship demo flows

### Remove or Demote

- arbitrary file upload in v1
- SQL editor as a default user path
- fake agent pipeline as a primary selling point
- generic sales and product-performance examples

## Recommended Modification Strategy

### Stage 1

- Keep the current layout shell and visual baseline.
- Rebrand copy and update the product narrative.
- Swap in the new domain language and flagship demo prompts.

### Stage 2

- Replace the mock engine with a real server-side orchestration flow.
- Add Dockerized `Postgres` and `MongoDB`.
- Seed the synthetic banking portfolio.

### Stage 3

- Rework the center workspace into an evidence-first surface.
- Add traceability, definitions, assumptions, and corroboration status.
- Reduce “AI theater” and increase grounded product clarity.

## Final Recommendation

Treat the current prototype as a strong shell, not as a product to lightly retheme. The fastest path to a winning result is to preserve the best interaction patterns while aggressively replacing the generic data and mocked intelligence with a tighter, more credible architecture.
