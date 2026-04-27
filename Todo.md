# QueryLens Todo

This roadmap reflects the current product direction for QueryLens:

**Bring data in -> understand it semantically -> let agents plan analysis -> execute safely -> show trust clearly.**

## 1. Dataset Onboarding
- Support CSV uploads as the first-class onboarding path.
- Support structured JSON and connected Postgres sources next.
- Support Mongo-backed tabular views where the data can be flattened into an analytic shape.
- Add an onboarding flow that inspects schema before the user starts querying.
- Detect time fields, candidate dimensions, measures, identifiers, and dataset grain.

## 2. Semantic Layer Generation
- Generate a semantic manifest for each onboarded dataset.
- Define dimensions, measures, derived metrics, synonyms, valid filters, and allowed groupings.
- Capture source mappings and supported analysis capabilities in metadata.
- Surface uncertainty when the system is not fully confident about inferred semantics.
- Make the semantic layer the contract between changing data and trustworthy analytics.

## 3. Agentic Planning With Guardrails
- Let the model interpret the user question and choose approved analysis capabilities.
- Keep the planner agentic, but do not allow unrestricted freeform execution.
- Add strong prompts, routing constraints, and validation rules around planning.
- Make unsupported or ambiguous requests fail clearly and safely.
- Treat the goal as governed agentic workflows, not open-ended agent behavior.

## 4. Unified Execution Plan
- Introduce an explicit execution-plan model between planning and execution.
- Show the interpreted intent, selected metric, timeframe, scope, and sources used.
- Keep execution deterministic and inspectable once the plan is approved.
- Make the same execution backbone work for both structured and more agentic flows.
- Use this as the bridge between flexibility and trust.

## 5. Better Trust And Confidence System
- Replace the single opaque confidence score with clearer trust components.
- Break confidence into interpretation confidence, data coverage confidence, source corroboration confidence, and execution confidence.
- Show why the system trusts its own answer.
- Make trust trace and source trace visible in the product experience.
- Keep trust as a core capability, not just a visual theme.

## 6. Weekly Briefing
- Add a proactive weekly briefing workflow over onboarded datasets.
- Generate top changes, biggest movers, strongest drivers, and cross-source context.
- Make this a hero product experience rather than only relying on user prompts.
- Use it to demonstrate both intelligence and grounded analysis in demos.

## 7. Text As Contextual Evidence
- Support text files, notes, and documents as contextual evidence.
- Use text for retrieval, explanation, and corroboration rather than primary metric computation.
- Keep structured data as the source of analytic truth.
- Link contextual evidence back to the main answer when relevant.

## Build Principle

QueryLens should be:

- agentic for understanding
- deterministic for execution
- agentic for explanation

That is the core product and architecture direction.
