# QueryLens Todo

This roadmap reflects the current product direction for QueryLens:

**Bring data in -> understand it semantically -> let agents plan analysis -> execute safely -> show trust clearly.**

## Platform Direction
- Migrate model access from the direct Gemini API integration to OpenRouter.
- Plan around `deepseek/deepseek-v4-pro` as the primary model for agentic planning and explanation.
- Keep the model integration swappable so the execution and semantic layers do not become provider-bound.
- Do not treat the OpenRouter migration as a standalone phase before onboarding; fold it into the onboarding implementation behind a provider-agnostic model interface.

## 1. Dataset Onboarding
- Support CSV uploads as the first-class onboarding path.
- Support structured JSON and connected Postgres sources next.
- Support Mongo-backed tabular views where the data can be flattened into an analytic shape.
- The first implementation order should be:
  1. CSV onboarding end to end
  2. provider-agnostic model interface extraction
  3. OpenRouter integration through that interface
  4. Postgres onboarding via connection URL
  5. MongoDB onboarding via connection URL
- For Postgres and MongoDB, the first user input should be a connection URL, not a manual schema definition.
- Treat the connection URL as the start of onboarding, not the end of it: QueryLens should inspect, profile, and prepare the source before queries run against it.
- Add an onboarding flow that inspects schema before the user starts querying.
- Detect time fields, candidate dimensions, measures, identifiers, and dataset grain.
- For Postgres, inspect schemas, tables, views, columns, and likely analytic keys and time fields.
- For MongoDB, inspect collections, sample documents, infer common fields, and derive flattenable tabular views where possible.
- The first implementation can remain inside the single Next.js app; a separate worker is not required until onboarding jobs become slow or operationally heavy.
- Onboarded data should be stored or registered in a queryable form before normal question answering begins.

## 2. Semantic Layer Generation
- Generate a semantic manifest for each onboarded dataset.
- Define dimensions, measures, derived metrics, synonyms, valid filters, and allowed groupings.
- Capture source mappings and supported analysis capabilities in metadata.
- Surface uncertainty when the system is not fully confident about inferred semantics.
- Make the semantic layer the contract between changing data and trustworthy analytics.
- The first onboarding slice should end with a semantic draft that is good enough to support a small set of safe questions.

## 3. Agentic Planning With Guardrails
- Let the model interpret the user question and choose approved analysis capabilities.
- Keep the planner agentic, but do not allow unrestricted freeform execution.
- Add strong prompts, routing constraints, and validation rules around planning.
- Route planning and explanation through OpenRouter using `deepseek/deepseek-v4-pro` as the initial primary model.
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
