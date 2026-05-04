# QueryLens Demo Script

## Demo Flow

### 1. Home Page

**Action:** Start on the home page.

**Say:**

QueryLens is a trust-first analytics workspace. The idea is simple: instead of forcing business users to write SQL, build dashboards, or wait for analysts, they can ask questions in plain English and get answers backed by real evidence.

Everything here is built around three things: clarity, trust, and speed. The answer should be easy to understand, the sources should be visible, and the user should be able to move from question to insight quickly.

**Action:** Point to the main buttons: `Launch Workspace`, `Import CSV`, and `View Source Context`.

Before I jump into asking questions, I will first show where the data is coming from.

### 2. Source Context

**Action:** Click `View Source Context` or the `Context` nav item.

**Say:**

This is the Source Context view. QueryLens is not just a generic chatbot over data. It shows the connected sources, the available tables and collections, and the context it can actually reason over.

For the built-in demo, we have an SME banking portfolio. Structured facts live in Postgres, while contextual signals like complaints, risk alerts, service incidents, and relationship-manager notes come from MongoDB.

This matters because when the system gives an answer later, we can inspect what it used instead of trusting a black-box response.

### 3. CSV Import

**Action:** Go to `Import CSV` or `Onboarding`.

**Say:**

Now I will show how a new dataset can be brought into the workspace. This is the CSV onboarding flow.

**Action:** Upload `sample.csv`.

**Say:**

The user uploads a CSV, and QueryLens profiles it automatically. It looks at the columns, row shape, possible metrics, dimensions, and the kind of questions that make sense for this dataset.

**Action:** Click through `Import and profile CSV`, `Continue to semantic draft`, and `Activate dataset`.

**Say:**

The important part is that the user does not need to define a schema manually. QueryLens creates a semantic draft so the dataset becomes usable in natural-language analysis.

**Action:** Optionally click `Source context`.

**Say:**

Now the uploaded CSV appears as part of the source context too. So the platform can handle both the built-in banking dataset and newly uploaded tabular data.

### 4. Workspace

**Action:** Click `Open in workspace` or go to `Launch Workspace`.

**Say:**

This is the main analysis workspace. On the left, I have chats and dataset context. In the center, I ask questions. On the right, QueryLens keeps the evidence and trust layer visible.

**Action:** Ask:

```text
What data is currently stored?
```

**Say:**

I usually start with a discovery question. This is useful when the user does not know what tables, metrics, or sources are available yet.

**Action:** Ask the flagship built-in question:

```text
Why did SME cashflow health drop last week?
```

**Say:**

Now QueryLens interprets the business question, plans the analysis, queries the approved sources, and returns a plain-English explanation.

Notice that the answer is not just a paragraph. It includes the trend, the drivers, the assumptions, confidence, and the supporting evidence.

### 5. Evidence And Trust

**Action:** Point to the `Evidence & Trust` panel.

**Say:**

This is the key differentiator. QueryLens shows what ran, what sources were used, what was directly observed, what was inferred, and where there is uncertainty.

So a business user gets the speed of an AI interface, but with the governance cues of a proper analytics workflow.

### 6. Optional CSV Question

**Action:** If the uploaded CSV is active, ask:

```text
Preview uploaded rows
```

or:

```text
Show revenue by region
```

**Say:**

For uploaded CSVs, QueryLens can preview rows and answer bounded analytical questions using the inferred columns. In this sample file, it can reason about revenue, orders, refunds, regions, channels, and product categories.

### 7. Closing

**Say:**

To summarize: QueryLens lets users start from a question, understand the available data, bring in new CSV context, and get grounded answers with visible evidence. It is not trying to replace analysts with a black box. It is making trusted self-service intelligence faster and easier for non-technical users.
