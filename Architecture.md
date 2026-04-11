# QueryLens Architecture

## Current Architecture Summary

`QueryLens` is a single `Next.js` application with an integrated server layer. The current phase now includes the Stage 1 engine foundation plus the first three product slices: a built-in dataset definition, a structured query-plan model, a generic analysis orchestrator, and registered `what changed`, `breakdown`, and `compare` executors. Retrieval remains deterministic over the built-in sample dataset, `Postgres` facts, account-level stress rollups, `MongoDB` context, and a repo-managed metric manifest, while Gemini remains constrained to query planning and final wording.

## Target Architecture Direction

The architecture will stay as a single `Next.js` service for the hackathon build. The major change is not service decomposition; it is generalization:

- from one hard-coded phase-1 intent to a reusable query-planning layer
- from one built-in sample dataset to manifest-backed datasets
- from one result surface to multi-intent analytics views
- from optional LLM interpretation to an LLM-first interactive planning path

## Current System Diagram

```mermaid
flowchart LR
    U["Judge / User"] --> UI["Next.js App Router UI"]

    subgraph FE["Frontend"]
      UI --> CHAT["Chat Panel"]
      UI --> WORK["Evidence Workspace"]
      UI --> SIDE["Source + Metric Sidebar"]
    end

    subgraph API["Next.js Route Handlers"]
      QUERY["POST /api/query"]
      METRICS["GET /api/metrics"]
    end

    CHAT --> QUERY
    SIDE --> METRICS

    subgraph ORCH["Server Orchestration"]
      PLAN["Query Planner (Gemini-first)"]
      VALIDATE["Dataset / Metric / Timeframe Validation"]
      ORCH["Analysis Orchestrator"]
      EXEC["Intent Executor"]
      NARRATE["Narrative Provider (Deterministic or Gemini)"]
    end

    QUERY --> PLAN --> VALIDATE --> ORCH --> EXEC --> NARRATE --> QUERY

    subgraph DATA["Data Sources"]
      PG["Postgres\naccounts, daily metrics, weekly metrics"]
      MG["MongoDB\ncomplaints, incidents, alerts, RM notes"]
      MANIFEST["Metric Manifest JSON"]
      SAMPLE["Built-in Sample Dataset"]
      GEMINI["Gemini API\nstructured parse + narrative output"]
    end

    EXEC --> PG
    EXEC --> MG
    VALIDATE --> MANIFEST
    EXEC --> SAMPLE
    PLAN --> GEMINI
    NARRATE --> GEMINI

    subgraph OPS["Local Ops"]
      DC["docker-compose"]
      SEED["sample-data load script"]
    end

    DC --> PG
    DC --> MG
    SEED --> PG
    SEED --> MG
    SEED --> MANIFEST
```

## Current API Surface

- `POST /api/query`
  - input: `{ question: string, scope?: { region?: string, sector?: string } }`
  - output: `Phase1AnalysisResponse`
- `GET /api/metrics`
  - returns the supported metric definitions and dimensions for the shipped slices

Deferred endpoints such as briefing or trace APIs are not part of the current shipped slice and should not be documented as implemented.

## Current Request Lifecycle

1. The user submits a question through chat.
2. The server produces a structured query plan for the built-in dataset, with Gemini as the intended interactive planner and local validation enforcing the manifest boundaries.
3. The plan is validated against the dataset definition, supported metric, and allowed timeframe rules.
4. The analysis orchestrator dispatches the plan to the registered `what changed`, `breakdown`, or `compare` executor.
5. The executor reads weekly movement or account-level stress from `Postgres` and corroborating context from `MongoDB`, or reads the built-in sample dataset when local databases are unavailable.
6. Drivers, evidence, confidence, assumptions, and chart data are assembled deterministically into a grounded response payload.
7. For interactive requests only, the planner is moving to a Gemini-required path and the narrative provider can ask Gemini for a structured headline and summary, while deterministic execution remains the source of truth for facts and evidence.
8. The UI renders the answer with visible trust evidence rather than raw SQL as the main user experience.

## Data Responsibilities

### Postgres

- Canonical structured facts
- Weekly comparison rows used to explain score movement
- Daily account metrics used to support believable sample-dataset behavior

### MongoDB

- Contextual corroboration in the same time window
- Complaints, incidents, alerts, and RM notes

### Manifest

- Metric definitions for `cashflow_health_score` and `at_risk_account_count`
- Supported synonyms, dimensions, intents, and allowed time windows

### Built-in Sample Dataset

- Safe built-in dataset for the local demo when database services are not configured or unavailable
- Must behave the same as the intended `database` answer shape

## Current Constraints

- No separate backend service
- No free-form SQL generation
- No model-authored facts, SQL, or evidence retrieval
- No upload-driven ingestion path in the main flow

## Immediate Next Gap

The Stage 1 foundation is now complete for the built-in dataset. The next gaps to meet the challenge are:

- making interactive query interpretation honestly LLM-first
- dataset onboarding and manifest persistence
- the remaining intent family: `weekly briefing`
- richer trust/debug UX around the Gemini-assisted path
