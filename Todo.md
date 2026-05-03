# QueryLens Todo

This roadmap is ordered by what matters most for the next strong demo.

Only items that are fully implemented in the current codebase are marked `[Completed]`.

Core demo story:

**Bring data in -> understand it semantically -> ask a safe question -> execute deterministically -> show trust clearly.**

## Current Build Order

This is the real priority order for the remaining demo work:

1. Persist uploaded datasets per user.
2. Persist the active dataset as workspace state.
3. Persist dataset/source metadata and onboarding context in the same user-scoped layer.
4. Tighten the trust UI:
   - show interpreted intent
   - show why the answer is trusted
   - show trust/source trace clearly
   - show the actual SQL or Mongo query when appropriate, including CSV-backed queries
5. Strengthen semantic governance for safe querying:
   - valid filters
   - allowed groupings
   - clearer semantic constraints
6. Improve execution transparency:
   - selected metric
   - timeframe
   - scope
   - source used
   - execution path
7. Build bounded agentic execution with guardrails:
   - approved capabilities
   - multi-step investigation
   - bounded retry/query repair
   - full execution trace
8. Fold in the provider-agnostic model interface and OpenRouter wherever onboarding, planning, or explanation still need cleanup.

## Product Direction

- Keep the model integration provider-agnostic so planning, onboarding, and explanation do not become vendor-bound. [Completed]
- Move model access from the direct Gemini integration to OpenRouter.
- Plan around `deepseek/deepseek-v4-pro` as the initial primary model for planning and explanation. [Completed]
- Do not treat the OpenRouter migration as a standalone phase before onboarding; fold it into onboarding work behind a provider-agnostic model interface.
- Treat structured data as the source of analytic truth.
- Treat text as contextual evidence, not the primary source of metric computation.

## Priority 0: Must Ship For The Demo

These items create the minimum believable QueryLens story:

1. sign in [Completed]
2. upload data [Completed]
3. see what QueryLens understood [Completed]
4. ask a safe question [Completed]
5. see why the answer is trustworthy

### 1. Auth, Sessions, And Saved Workspace

Goal: every user gets a clean, persistent workspace that survives refreshes and sign-in cycles.

#### Must have

- Use Clerk for authentication. [Completed]
- Use Convex for app-state persistence.
- Persist uploaded dataset metadata so the user can come back to prior work.
- Persist the active dataset selection for the user.
- Store chat history as `user -> chat -> messages`. [Completed]
- Link each chat to the active dataset or source when relevant. [Completed]
- Persist onboarding context needed to resume or inspect a dataset later.

#### Break this down into concrete work

- Persist `users`. [Completed]
- Persist `chats`. [Completed]
- Persist `messages`. [Completed]
- Persist dataset/source metadata.
- Persist active dataset state.
- Persist semantic draft references or semantic manifest records.

#### Demo definition of done

- Uploaded datasets are scoped to the signed-in user.
- Previously uploaded datasets still appear in that user's workspace.
- Previously created chats still appear.
- The active dataset is stored explicitly as workspace state.

### 2. CSV Onboarding End To End

Goal: CSV is the first-class onboarding path and the hero demo flow.

#### Must have

- Upload a CSV. [Completed]
- Inspect and profile the dataset before normal querying starts. [Completed]
- Detect likely time fields, dimensions, measures, identifiers, and dataset grain. [Completed]
- Store or register the onboarded dataset in a queryable form. [Completed]
- Land the user in a saved dataset workspace after onboarding.

#### Break this down into concrete work

- File upload and validation. [Completed]
- Schema inference from headers and sampled values. [Completed]
- Basic profiling and preview. [Completed]
- Queryable dataset registration/storage. [Completed]
- Handoff from onboarding into the main workspace. [Completed]

#### Demo definition of done

- A user can upload a CSV and start asking first questions without manual schema authoring. [Completed]
- The first shipped slice supports `discovery + simple metrics`, not full parity with the seeded SME demo flows. [Completed]

### 3. Semantic Draft Generation

Goal: end onboarding with a usable semantic contract for safe first queries.

#### Must have

- Generate a semantic draft for each onboarded dataset. [Completed]
- Define dimensions, measures, derived metrics, synonyms, valid filters, and allowed groupings.
- Capture source mappings and supported analysis capabilities in metadata. [Completed]
- Surface uncertainty when semantics are inferred rather than confirmed. [Completed]

#### Break this down into concrete work

- Generate a first semantic draft from profiling results. [Completed]
- Refine labels, measures, and supported questions. [Completed]
- Store the semantic draft with the onboarded dataset. [Completed]
- Render the semantic draft clearly in the onboarding/workspace UI. [Completed]

#### Demo definition of done

- The user can see what QueryLens inferred. [Completed]
- The semantic draft is good enough to support a small set of safe questions. [Completed]

### 4. First Safe Query Path

Goal: support the first believable questions against onboarded datasets without opening the system up to unbounded behavior.

#### Must have

- Let the model interpret the user question against approved semantics. [Completed]
- Keep execution deterministic and inspectable. [Completed]
- Fail clearly when a request is unsupported or ambiguous. [Completed]
- Support a small approved set of first-question capabilities. [Completed]

#### Break this down into concrete work

- Route user questions against the semantic draft. [Completed]
- Introduce or reuse an explicit execution-plan model between planning and execution.
- Show interpreted intent, selected metric, timeframe, scope, and sources used.
- Keep the first onboarded slice limited to governed capabilities instead of freeform execution. [Completed]

#### Demo definition of done

- The user can ask a few supported questions and get stable answers. [Completed]
- Unsupported questions fail safely and clearly. [Completed]

### 5. Trust And Confidence Experience

Goal: make the answer feel trustworthy, not opaque.

#### Must have

- Replace the single opaque confidence score with clearer trust components. [Completed]
- Break confidence into interpretation confidence, data coverage confidence, source corroboration confidence, and execution confidence. [Completed]
- Show why the system trusts its answer.
- Make trust trace and source trace visible in the product experience.
- When suitable for the query, show the SQL query or MongoDB query that QueryLens executed, including for answers grounded in onboarded CSV data.

#### Break this down into concrete work

- Render interpreted intent.
- Render source usage. [Completed]
- Render execution status or trace. [Completed]
- Render the executed SQL query or MongoDB query for supported answers when it adds trust and debuggability, including queries over onboarded CSV-backed tables.
- Render uncertainty and limitation notes. [Completed]
- Render trust components in a way that is easy to scan in a live demo. [Completed]

#### Demo definition of done

- A viewer can understand what QueryLens did, what it used, and where uncertainty remains.
- For query-backed answers, a viewer can inspect the actual SQL query or MongoDB query in the trust UI when appropriate, including for uploaded CSV datasets after onboarding.

## Priority 1: Next Highest Leverage

These should happen right after the core demo path feels real.

### 6. Bounded Agentic Execution With Guardrails

Goal: let QueryLens behave agentically during execution without allowing unbounded or opaque behavior.

#### Why this matters

- A strong analytics product should not be limited to one rigid execution path.
- QueryLens should be able to investigate, decompose, and adapt while staying trustworthy.
- The system should be agentic in orchestration, but bounded in the operations it is allowed to perform.

#### Must have

- Let the executor choose from approved capabilities instead of following only one hardcoded path.
- Allow multi-step execution when the question requires investigation across more than one approved source or capability.
- Support bounded retries and query repair when an approved query fails for recoverable reasons.
- Allow the system to inspect schema, validate assumptions, and gather corroborating evidence during execution.
- Keep metric definitions, permission boundaries, and approved operations deterministic and auditable.

#### Break this down into concrete work

- Define an approved capability graph for execution, not just planning.
- Allow execution to compose steps like `inspect_schema`, `run_metric_query`, `group_results`, `retrieve_context`, and `validate_output`.
- Add explicit guardrails for allowed tables, collections, operations, row limits, and time budgets.
- Add retry and repair rules for failed SQL or MongoDB queries without allowing freeform execution.
- Persist an execution trace that shows each execution step, why it was chosen, and what query or operation actually ran.
- Separate trusted deterministic primitives from higher-level agentic orchestration.

#### Demo definition of done

- QueryLens can answer more complex questions by composing multiple approved execution steps.
- The system can adapt when a simple path is insufficient, without becoming a black box.
- A viewer can still inspect the exact steps, queries, and evidence used to produce the answer.

### 7. Provider-Agnostic Model Interface And OpenRouter

Goal: make the onboarding and planning stack swappable without turning provider migration into separate busywork.

#### Must have

- Extract a provider-agnostic model interface. [Completed]
- Route onboarding refinement, planning, and explanation through that interface. [Completed]
- Integrate OpenRouter through that interface. [Completed]
- Use `deepseek/deepseek-v4-pro` as the initial primary model. [Completed]

#### Important sequencing note

- Do this as part of onboarding and query experience work.
- Do not pause onboarding work to do a provider migration as its own isolated phase.

<!--
### 8. Postgres Onboarding Via Connection URL

Goal: make Postgres the next real onboarding path after CSV.

#### Must have

- Accept a connection URL as the first input.
- Inspect schemas, tables, views, columns, likely keys, and likely time fields.
- Profile the source before queries begin.
- Produce a semantic draft from the inspected source.

#### Demo-friendly storage rule

- For the demo, it is acceptable to store Postgres connection URLs directly so sources can be reused across sessions.
- Keep the code shaped so secret handling can later be swapped in without rewriting onboarding logic.

### 9. MongoDB Onboarding Via Connection URL

Goal: support Mongo-backed tabular views after Postgres onboarding is working.

#### Must have

- Accept a connection URL as the first input.
- Inspect collections and sample documents.
- Infer common fields.
- Derive flattenable tabular views where possible.
- Produce a semantic draft from the inspected source.

#### Demo-friendly storage rule

- For the demo, it is acceptable to store MongoDB connection URLs directly so sources can be reused across sessions.
- Keep the code shaped so secret handling can later be swapped in without rewriting onboarding logic.
-->

## Priority 2: Differentiate The Product Further

These improve the product story, but they should not outrank the core onboarding and trust path.

<!--
### 10. Weekly Briefing

Goal: make proactive analysis a hero experience after onboarding is solid.

- Generate top changes, biggest movers, strongest drivers, and cross-source context.
- Run the briefing over onboarded datasets.
- Use this to demonstrate intelligence beyond reactive question-answering.

### 11. Text As Contextual Evidence

Goal: use documents and notes to strengthen explanations without blurring the source of truth.

- Support text files, notes, and documents as contextual evidence.
- Use text for retrieval, explanation, and corroboration.
- Keep structured data as the source of analytic truth.
- Link contextual evidence back to the main answer when relevant.
-->

## Suggested Execution Order

1. Finish auth, sessions, and saved workspace.
2. Make trust and confidence legible in the product.
3. Strengthen semantic governance for safe querying.
4. Improve execution transparency.
5. Add bounded agentic execution with guardrails.
6. Fold in the provider-agnostic model interface and OpenRouter where onboarding and planning need it.
<!--
7. Add Postgres onboarding via connection URL.
8. Add MongoDB onboarding via connection URL.
9. Add weekly briefing.
10. Add text as contextual evidence.
-->

## Build Principle

QueryLens should be:

- agentic for understanding
- deterministic for execution
- agentic for explanation
