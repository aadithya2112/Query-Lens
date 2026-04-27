# QueryLens Refactor Priorities

This document captures the most important refactors for the current QueryLens direction:

**Bring data in -> understand it semantically -> let agents plan analysis -> execute safely -> show trust clearly.**

These refactors are chosen for one reason: they should make future implementation faster, safer, and much less repetitive.

## Refactor Guardrails

- Do not break the current shipped flows: `discovery`, `what changed`, `compare`, and `breakdown`.
- Preserve both fixture mode and Docker-backed database mode.
- Prefer incremental refactors over a rewrite.
- Optimize for future feature velocity, clarity, and debuggability.
- Keep current external behavior stable unless a change is truly necessary.
- It is fine to introduce new types, modules, and interfaces if they reduce future coupling.
- Do not implement full dataset onboarding as part of the refactor itself; prepare the architecture for it.
- Avoid overbuilding abstractions that the current repo cannot meaningfully support yet.
- Keep the new north star explicit:
  - agentic for understanding
  - deterministic for execution
  - agentic for explanation
- Treat structured data as the source of analytic truth, and treat text as contextual evidence.

## 1. Introduce A First-Class Semantic Manifest Layer [Completed]

### Goal
Move dataset meaning out of scattered code paths and into one explicit semantic contract.

### Why This Matters
- This is now the biggest productivity multiplier in the codebase.
- New datasets should not require touching planners, executors, follow-ups, and scoring logic in multiple places.
- Agentic planning only works well if there is one clean semantic layer to plan against.

### What The Semantic Layer Should Capture
- dataset metadata
- entities and dimensions
- measures and derived metrics
- time fields and grain
- synonyms and aliases
- valid filters and groupings
- source mappings
- supported analysis capabilities
- uncertainty notes when semantics are inferred rather than confirmed

### What To Refactor
- Pull dataset-specific assumptions out of executors and planners.
- Replace implicit SME-specific logic with manifest-backed semantics wherever possible.
- Make the semantic layer the contract between onboarding, planning, execution, and trust.

### Expected Productivity Gain
- Faster support for new datasets
- Less copy-paste logic across intent flows
- Cleaner agent prompts and validation rules

### Completion Notes
- Completed by introducing a single checked-in semantic manifest for `sme_portfolio`.
- Planning, discovery metadata, entity resolution, and scope labels now project from the manifest-backed contract instead of scattered helpers and JSON fragments.
- Existing shipped flows remain stable while the semantic layer now acts as the shared metadata source for future refactors.

## 2. Separate Planning, Execution, And Presentation [Completed]

### Goal
Create a clean pipeline where:
- planning decides what the user is asking
- execution gathers grounded facts
- presentation shapes the user-facing response

### Why This Matters
- Reduces coupling in the current orchestration flow.
- Makes the upcoming agentic planner easier to evolve without breaking execution.
- Prevents response decoration and trust shaping from leaking into execution logic.

### What To Refactor
- Pull interpretation and routing into a distinct planning stage.
- Keep execution focused on retrieving and computing grounded results.
- Move response shaping, follow-ups, trust artifacts, and presentation defaults into a dedicated presentation stage.

### Expected Productivity Gain
- Easier testing
- Easier debugging
- Smaller mental load while building new features

### Completion Notes
- Completed by introducing explicit planning, execution, and presentation stages for the built-in `discovery`, `what_changed`, `compare`, and `breakdown` flows.
- `analysis-orchestrator.ts` now coordinates context loading, persistence, and route selection while the built-in pipeline owns staged analysis.
- `leadership_summary` and `agentic_query` intentionally remain on their existing paths until their own refactors.
- External `/api/query` behavior stayed stable while the internal built-in pipeline became easier to test and evolve.

## 3. Create An Explicit Execution-Plan Contract [Completed]

### Goal
Introduce a typed execution-plan layer between planning and execution.

### Why This Matters
- This is the backbone of “agentic for understanding, deterministic for execution.”
- It creates one durable interface for both structured and more agentic workflows.
- It makes reasoning, validation, and debugging far easier.

### What The Execution Plan Should Capture
- dataset and semantic targets
- selected capabilities
- allowed sources
- allowed operations
- constraints and validation outcomes
- fallback policy
- trace metadata for trust and debugging

### What To Refactor
- Add an approved execution-plan model in addition to or in place of the current query-plan shape.
- Make dispatch use the execution plan instead of ad hoc branching.
- Carry execution trace information all the way into the final response.

### Expected Productivity Gain
- More predictable feature development
- Fewer hidden assumptions
- Cleaner bridge between planning and execution

### Completion Notes
- Completed by introducing a typed built-in execution plan between structured planning and deterministic execution.
- The plan now carries semantic targets, selected capability labels, allowed sources and operations, validation outcomes, fallback policy, and execution trace metadata.
- Built-in dispatch consumes the execution plan while existing intent executors continue to receive the original structured plan internally, keeping shipped flows stable.
- Execution trace metadata now reaches successful and fallback responses through the presentation layer without changing existing response behavior.

## 4. Refactor Intent Executors Into Capability Executors [Completed]

### Goal
Move from one-off intent-driven executors to reusable capability-driven execution.

### Why This Matters
- The future product is not just `what changed`, `compare`, `breakdown`, and `discovery`.
- Weekly briefing, onboarding, and multi-dataset support will be much easier if execution is built from reusable capabilities.
- This is how deterministic paths can feel more agentic without becoming unbounded.

### Example Capability Direction
- `profile_dataset`
- `aggregate_metric`
- `compare_slices`
- `explain_change`
- `retrieve_context`
- `summarize_period`
- `validate_metric_definition`

### What To Refactor
- Standardize executor inputs and outputs.
- Strip UI-specific formatting out of execution internals.
- Replace custom per-intent glue with composable capability calls.

### Expected Productivity Gain
- Faster feature composition
- Easier reuse across datasets
- Cleaner path to weekly briefing and richer agentic flows

### Completion Notes
- Completed by adding a built-in capability layer for metric aggregation, compare slice resolution, context retrieval, dataset profiling, and cashflow change explanation.
- Intent executors now compose payloads from reusable capability outputs while preserving shipped `discovery`, `what_changed`, `compare`, and `breakdown` behavior.
- Execution-plan capability metadata now reflects actual contextual reads for compare and breakdown flows.
- Capability tests cover the reusable execution paths and the runtime guard that prevents undeclared capability calls.

## 5. Split Ingestion And Profiling From Query-Time Data Access [Completed]

### Goal
Separate the system that learns what a dataset is from the system that answers questions against it.

### Why This Matters
- Onboarding will get messy if ingestion and analytics access are too tightly coupled.
- Profiling, inference, and manifest generation are different responsibilities from live analysis execution.
- This makes CSV, JSON, Postgres, and Mongo onboarding much easier to extend.

### What To Refactor
- Introduce dedicated modules for ingestion, schema profiling, and semantic draft generation.
- Keep query-time data access focused on validated analytic reads.
- Avoid forcing raw source-specific quirks deep into planners and executors.

### Expected Productivity Gain
- Cleaner onboarding work
- Less coupling between setup-time and query-time logic
- Easier iteration on source support

### Completion Notes
- Completed by splitting dataset runtime responsibilities into a query-time data-access layer and a separate dataset profile store.
- Query answering now stays focused on validated analytic reads, while source inspection, schema snapshots, source health, catalog profiling, and semantic draft generation live in dedicated profiling modules.
- Discovery, bootstrap, source-context, retrieval, and seeding paths now consume the profile/runtime seam without changing shipped `discovery`, `what_changed`, `compare`, `breakdown`, fixture-mode, or database-mode behavior.
- Tests now cover the runtime resolver, fixture profile snapshots, semantic draft generation, and the rewired consumers that depend on profiling instead of query-time repositories.

## 6. Create A First-Class Trust And Confidence Model

### Goal
Replace trust as a loose mix of score + artifacts with a structured trust model.

### Why This Matters
- Trust is now a core product feature, not a finishing touch.
- The current confidence score is useful but too simple for the new direction.
- A stronger trust model will make both product and implementation decisions cleaner.

### What The Trust Model Should Capture
- interpretation confidence
- data coverage confidence
- source corroboration confidence
- execution confidence
- trust trace entries
- uncertainty and limitation notes

### What To Refactor
- Pull confidence logic into a clearer domain model.
- Make trust traces explicit and typed.
- Stop treating trust as only a late-stage response decoration step.

### Expected Productivity Gain
- Easier confidence improvements later
- Cleaner UI trust rendering
- Better separation between analytics output and trust explanation

## Suggested Order

1. Introduce a first-class semantic manifest layer. [Completed]
2. Separate planning, execution, and presentation. [Completed]
3. Create an explicit execution-plan contract. [Completed]
4. Refactor intent executors into capability executors. [Completed]
5. Split ingestion and profiling from query-time data access. [Completed]
6. Create a first-class trust and confidence model.

## Expected Outcome

If these refactors are completed first, QueryLens should become much easier to evolve into a multi-dataset, guarded-agentic analytics system without piling new complexity onto today’s hardcoded flows.
