# QueryLens

QueryLens is a trust-first analytics demo for a synthetic SME banking portfolio. It lets a non-technical user ask grounded natural-language questions such as `Why did SME cashflow health drop last week?`, `What makes up at-risk accounts by region and sector last week?`, or `Compare cashflow health this week vs last week` and get evidence-backed answers from seeded `Postgres` facts and `MongoDB` context.

The current shipped milestone is intentionally focused on one strong phase-1 flow rather than a broad but partial product. The app is designed for a short local demo where a reviewer can boot the stack, run one seeded query, and understand both the product story and the supporting architecture quickly.

## Working Features

- `QueryLens` three-pane interface with chat, evidence workspace, and source/metric sidebar
- `what changed` analysis for `cashflow_health_score`
- `breakdown` analysis for `at_risk_account_count`
- `compare` analysis for `cashflow_health_score`
- Stage 1 internal query-engine foundation:
  - built-in dataset abstraction for `sme_portfolio`
  - structured query-plan model
  - generic orchestrator and registered `what changed` / `breakdown` / `compare` executors
- Supported time windows: `this week` and `last week`
- Optional phase-1 scope filters for `region` and `sector`
- Cross-source evidence using seeded `Postgres` portfolio facts and `MongoDB` contextual signals
- Visible trust artifacts: weekly trend, ranked drivers, evidence cards, assumptions, and confidence
- Dockerized local stack with reproducible seed data
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
- `Vitest`
- `Playwright`
- `Bun`
- `Gemini API` via `@google/genai` for optional structured parsing and narrative generation

## Recommended Local Demo Path

This is the best way to run the product exactly as intended.

### 1. Install dependencies

```bash
bun install
```

### 2. Create local environment config

```bash
cp .env.example .env.local
```

The default values in `.env.example` are already set for the local Docker stack:

- `QUERYLENS_REFERENCE_DATE=2026-04-11`
- `QUERYLENS_DATA_MODE=database`
- `QUERYLENS_AI_MODE=auto`
- local `POSTGRES_URL`
- local `MONGODB_URL`

To enable Gemini-backed parsing and narrative generation for interactive `/api/query` requests, set:

- `GEMINI_API_KEY=...`
- optionally override `QUERYLENS_GEMINI_MODEL` if you do not want the default `gemini-2.5-flash`

### 3. Start the databases

```bash
bun run db:up
```

Wait until both `postgres` and `mongodb` are healthy.

### 4. Seed the demo data

```bash
bun run seed
```

### 5. Start the app

```bash
bun run dev
```

Then open [http://localhost:3000](http://localhost:3000).

### 6. Run the flagship questions

Use the seeded prompt or ask:

```text
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

## Fixture Mode

If you want to run the UI without Docker, you can force fixture mode:

```bash
QUERYLENS_DATA_MODE=fixture QUERYLENS_REFERENCE_DATE=2026-04-11 bun run dev
```

This uses the same seeded story, but reads from in-repo fixtures instead of the live local databases.

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
  -d '{"question":"Why did SME cashflow health drop last week?"}'
```

Example response shape:

```json
{
  "headline": "Portfolio cashflow health fell 1.7 points",
  "summary": "Portfolio moved down from 100.0 to 98.3 week over week.",
  "metric": "cashflow_health_score",
  "timeframe": "Last week (Mar 30, 2026 - Apr 5, 2026)",
  "comparisonBasis": "Compared with the prior week (Mar 23 - 29, 2026)",
  "confidence": 90,
  "drivers": [],
  "evidence": [],
  "assumptions": [],
  "sourceMode": "database"
}
```

## Validation Commands

Run the automated checks with:

```bash
bun run lint
bun run test
bun run build
bun run test:e2e
```

## Architecture Notes

QueryLens is a single `Next.js` application with an integrated server layer.

- `POST /api/query` parses and validates the question, reads weekly facts from `Postgres`, reads corroborating context from `MongoDB`, and assembles a grounded narrative response.
- The server now routes requests through a built-in dataset definition, a structured query-plan model, and a generic analysis orchestrator before executing the current `what changed`, `breakdown`, or `compare` intent.
- `GET /api/metrics` exposes the current metric manifest for all shipped slices.
- Interactive query parsing and narration can use Gemini with structured output and tool calling, while bootstrap, data retrieval, evidence assembly, and fallback behavior remain deterministic.
- Fixture mode remains available as a safe fallback when live databases are not running.

For the fuller diagram and request lifecycle, see [Architecture.md](./Architecture.md).

## Repository Structure

```text
.
├─ app/                  # Next.js routes and pages
├─ components/querylens/ # Active QueryLens UI
├─ data/                 # Metric manifest
├─ lib/querylens/        # Domain logic, analysis, scoring, seeding
├─ scripts/              # Seed script
├─ tests/                # Unit, integration, and e2e tests
├─ docker-compose.yml
├─ .env.example
└─ README.md
```

## Limitations

- The current milestone supports two metrics and three narrow intent families.
- The seeded portfolio is synthetic and designed for demo clarity, not statistical realism.
- Gemini currently helps only with interactive parsing and wording; scoring, evidence ranking, source reads, and fallback logic remain deterministic.
- Database mode is meant for local Docker-backed use, not public deployment.
- The current trace/debug details are lightweight and development-oriented.
- Only one built-in dataset is supported today; reusable dataset onboarding is not implemented yet.

## Future Improvements

- Add reusable dataset onboarding for tabular datasets
- Add `weekly briefing`
- Expand metric coverage beyond `cashflow_health_score`
- Improve source health and trace detail for richer trust UX
- Add a submission/demo script with screenshots or recorded walkthrough

## Cleanup

When you are done with the local stack:

```bash
bun run db:down
```
