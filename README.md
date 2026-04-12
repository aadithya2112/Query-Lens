# QueryLens

QueryLens is a trust-first analytics demo for a synthetic SME banking portfolio. It lets a non-technical user ask grounded natural-language questions such as `What data is currently stored?`, `Why did SME cashflow health drop last week?`, `What makes up at-risk accounts by region and sector last week?`, or `Compare cashflow health this week vs last week` and get evidence-backed answers from a built-in sample dataset surfaced through structured facts, contextual signals, and retrieval-backed metadata.

The current shipped milestone is intentionally focused on one strong local demo dataset rather than a broad but partial product. The app is designed for a short local demo where a reviewer can boot the stack, run a few sample-dataset questions, and understand both the product story and the supporting architecture quickly.

## Working Features

- `QueryLens` three-pane interface with chat, evidence workspace, and source/metric sidebar
- `what changed` analysis for `cashflow_health_score`
- `breakdown` analysis for `at_risk_account_count`
- `compare` analysis for `cashflow_health_score`
- `discovery` answers for vague dataset questions such as available data, metrics, sources, and time coverage
- Stage 1 internal query-engine foundation:
  - built-in dataset abstraction for `sme_portfolio`
  - structured query-plan model
  - generic orchestrator and registered `discovery` / `what changed` / `breakdown` / `compare` executors
- Supported time windows: `this week` and `last week`
- Optional phase-1 scope filters for `region` and `sector`
- Cross-source evidence using the built-in sample portfolio facts and contextual signals
- Conversational memory with browser-persisted `chatId` and server-side conversation storage
- Simple RAG using `pgvector` in `Postgres` for dataset metadata retrieval and conversation-memory retrieval
- Visible trust artifacts: weekly trend, ranked drivers, evidence cards, assumptions, and confidence
- Dockerized local stack with reproducible sample data
- Automated coverage with `Vitest` and a Playwright browser smoke test

## Not Yet Implemented

These are intentionally deferred and should not be treated as shipped:

- `weekly briefing`
- arbitrary file upload or open-ended source ingestion
- raw SQL as a primary user workflow

## Tech Stack

- `TypeScript`
- `Next.js` App Router
- `React`
- `Postgres`
- `MongoDB`
- `Docker Compose`
- `pgvector`
- `Vitest`
- `Playwright`
- `Bun`
- `Gemini API` via `@google/genai` for required interactive planning, embeddings, and narrative generation

## Recommended Local Demo Path

This is the best way to run the product exactly as intended.

### 1. Install dependencies

```bash
npm install
```

### 2. Create local environment config

```bash
cp .env.example .env.local
```

The default values in `.env.example` are already set for the local Docker stack:

- `QUERYLENS_REFERENCE_DATE=2026-04-11`
- `QUERYLENS_DATA_MODE=database`
- `QUERYLENS_AI_MODE=gemini`
- local `POSTGRES_URL`
- local `MONGODB_URL`

Interactive `/api/query` requests now require Gemini. Set:

- `GEMINI_API_KEY=...`
- optionally override `QUERYLENS_GEMINI_MODEL` if you do not want the default `gemini-2.5-flash`

### 3. Start the databases

```bash
npm run db:up
```

Wait until both `postgres` and `mongodb` are healthy.

### 4. Load the sample dataset

```bash
npm run seed
```

### 5. Start the app

```bash
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

### 6. Run the flagship questions

Use the sample prompts or ask:

```text
What data is currently stored?
Why did SME cashflow health drop last week?
What makes up at-risk accounts by region and sector last week?
Compare cashflow health this week vs last week
```

Expected result:

- a grounded narrative explaining the drop
- visible `Postgres` and `MongoDB` evidence
- top drivers highlighting stress in North West hospitality
- assumptions and confidence rendered in the center workspace
- a separate breakdown view showing where weekly at-risk accounts are concentrated
- a compare view showing the delta between two weekly windows or two peers
- a discovery view showing dataset coverage, sources, metrics, and suggested next questions

## Fixture Mode

If you want to run the UI without Docker, you can force fixture mode:

```bash
QUERYLENS_DATA_MODE=fixture QUERYLENS_REFERENCE_DATE=2026-04-11 npm run dev
```

This uses the same sample dataset story, but reads from in-repo fixtures instead of the live local databases.

## API Usage Examples

### `GET /api/metrics`

```bash
curl http://localhost:3000/api/metrics
```

Returns the current metric manifest, including `cashflow_health_score` for `what changed` and `compare` questions, plus `at_risk_account_count` for the breakdown slice.

### `POST /api/query`

```bash
curl -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -d '{"question":"What data is currently stored?","chatId":"demo-thread"}'
```

Example response shape:

```json
{
  "intent": "discovery",
  "headline": "QueryLens is currently grounded on the SME portfolio dataset",
  "summary": "QueryLens currently has 2 analytical metrics across 4 intent families for the SME portfolio dataset.",
  "metric": "dataset_catalog",
  "timeframe": "Coverage: 2026-01-12 to 2026-04-05",
  "comparisonBasis": "Catalog, source, and metadata overview",
  "confidence": 88,
  "catalogSections": [],
  "conversationContextUsed": false,
  "sourceMode": "database"
}
```

## Validation Commands

Run the automated checks with:

```bash
npm run lint
npm run test
npm run build
npm run test:e2e
```

## Architecture Notes

QueryLens is a single `Next.js` application with an integrated server layer.

- `POST /api/query` interprets the question, validates it against the current dataset and manifest, reads weekly facts from `Postgres`, reads corroborating context from `MongoDB`, and assembles a grounded narrative response.
- The server now routes requests through a built-in dataset definition, a structured query-plan model, `pgvector` retrieval for metadata and conversation memory, and a generic analysis orchestrator before executing the current `discovery`, `what changed`, `breakdown`, or `compare` intent.
- `GET /api/metrics` exposes the current metric manifest for all shipped slices.
- Interactive query parsing now requires Gemini planning for supported questions, while data retrieval, evidence assembly, charting, confidence, and retrieval persistence remain deterministic and grounded.
- Fixture mode remains available as a safe fallback when live databases are not running.

For the fuller diagram and request lifecycle, see [Architecture.md](./Architecture.md) and [Flow.md](./Flow.md).

## Repository Structure

```text
.
├─ app/                  # Next.js routes and pages
├─ components/querylens/ # Active QueryLens UI
├─ data/                 # Metric manifest
├─ lib/querylens/        # Domain logic, analysis, scoring, sample dataset
├─ scripts/              # Local sample-data load script
├─ tests/                # Unit, integration, and e2e tests
├─ docker-compose.yml
├─ .env.example
└─ README.md
```

## Limitations

- The current milestone supports two analytical metrics plus one catalog/discovery path.
- The sample portfolio is synthetic and designed for demo clarity, not statistical realism.
- Interactive queries require Gemini to interpret supported questions. Deterministic parsing remains only as a developer and test harness mode.
- Conversation memory is scoped to a browser session `chatId` and is not yet a multi-user product feature.
- Database mode is meant for local Docker-backed use, not public deployment.
- The current trace/debug details are lightweight and development-oriented.
- Only one built-in dataset is supported today; reusable dataset onboarding is not implemented yet.

## Future Improvements

- Add reusable dataset onboarding for tabular datasets
- Add `weekly briefing`
- Expand metric coverage beyond `cashflow_health_score`
- Improve trace detail and retrieval transparency for richer trust UX
- Add a submission/demo script with screenshots or recorded walkthrough

## Cleanup

When you are done with the local stack:

```bash
npm run db:down
```
