import { Pool } from "pg"

import { getDatasetDefinition, getDatasetMetricManifest } from "@/lib/querylens/datasets"
import {
  getSemanticManifest,
  getSemanticSourceMappings,
  getSemanticSupportedQuestions,
  getSupportedEntityLabels,
} from "@/lib/querylens/semantic-manifest"
import {
  cosineSimilarity,
  embedTexts,
  EMBEDDING_DIMENSIONS,
  formatVectorLiteral,
} from "@/lib/querylens/server/embedding-service"
import { getSampleDataset } from "@/lib/querylens/seed-data"
import type {
  CatalogSection,
  Phase1AnalysisResponse,
  QueryIntent,
  RetrievalContext,
  RetrievalMatch,
  StoredConversationMessage,
} from "@/lib/querylens/types"

const CATALOG_TOP_K = 5
const MEMORY_TOP_K = 5
const RECENT_MESSAGE_LIMIT = 5

interface DatasetCatalogChunk {
  id: string
  kind: string
  title: string
  content: string
}

interface PersistConversationArgs {
  chatId: string
  question: string
  response: Phase1AnalysisResponse
}

export interface QueryLensRetrievalStore {
  retrieveContext(args: {
    chatId: string
    question: string
  }): Promise<RetrievalContext>
  persistConversation(args: PersistConversationArgs): Promise<void>
}

declare global {
  var __querylensRetrievalPgPool: Pool | undefined
  var __querylensFixtureCatalogChunks:
    | Array<DatasetCatalogChunk & { embedding: number[] }>
    | undefined
  var __querylensFixtureConversationMessages:
    | Map<string, StoredConversationMessage[]>
    | undefined
  var __querylensFixtureMemoryChunks:
    | Map<string, Array<RetrievalMatch & { embedding: number[] }>>
    | undefined
  var __querylensPgRetrievalReady: boolean | undefined
}

function getPgPool() {
  if (!process.env.POSTGRES_URL) {
    throw new Error("POSTGRES_URL is not configured.")
  }

  if (!globalThis.__querylensRetrievalPgPool) {
    globalThis.__querylensRetrievalPgPool = new Pool({
      connectionString: process.env.POSTGRES_URL,
    })
  }

  return globalThis.__querylensRetrievalPgPool
}

function buildTimeCoverageLabel() {
  const weeklyRows = getSampleDataset().weeklyMetrics
    .filter((row) => row.recordType === "portfolio")
    .sort((left, right) => left.weekStart.localeCompare(right.weekStart))

  const first = weeklyRows[0]
  const last = weeklyRows.at(-1)

  if (!first || !last) {
    return "No weekly coverage is currently available."
  }

  return `${first.weekStart} to ${last.weekEnd}`
}

export function buildDatasetCatalogChunks(): DatasetCatalogChunk[] {
  const dataset = getDatasetDefinition()
  const manifest = getDatasetMetricManifest()
  const semanticManifest = getSemanticManifest()
  const supportedEntities = getSupportedEntityLabels()
  const supportedQuestions = getSemanticSupportedQuestions()
  const sourceMappings = getSemanticSourceMappings()

  return [
    {
      id: "dataset-overview",
      kind: "overview",
      title: "Dataset overview",
      content: `${dataset.label} is the active built-in sample dataset. ${dataset.description} Current story anchors: stress pocket ${semanticManifest.storyAnchors.stressPocket}, healthy control ${semanticManifest.storyAnchors.healthyControl}, softer secondary pocket ${semanticManifest.storyAnchors.softeningPocket}, and recovery pocket ${semanticManifest.storyAnchors.recoveryPocket}.`,
    },
    {
      id: "dataset-metrics",
      kind: "metrics",
      title: "Available metrics",
      content: manifest.metrics
        .map(
          (metric) =>
            `${metric.label}: ${metric.description}. Supported intents: ${metric.supportedIntents.join(", ")}.`
        )
        .join(" "),
    },
    {
      id: "dataset-dimensions",
      kind: "dimensions",
      title: "Available dimensions",
      content: `QueryLens currently supports ${semanticManifest.dimensions.map((dimension) => dimension.label.toLowerCase()).join(", ")} as analysis dimensions. Regions: ${supportedEntities.regions.join(", ")}. Sectors: ${supportedEntities.sectors.join(", ")}.`,
    },
    {
      id: "dataset-sources",
      kind: "sources",
      title: "Connected sources",
      content: sourceMappings
        .map((source) => `${source.label}: ${source.description}.`)
        .join(" "),
    },
    {
      id: "dataset-time-coverage",
      kind: "time_coverage",
      title: "Time coverage",
      content: `The current weekly coverage spans ${buildTimeCoverageLabel()}. Supported question windows are this week and last week.`,
    },
    {
      id: "dataset-supported-questions",
      kind: "questions",
      title: "Supported questions",
      content: `You can ask about what changed, breakdowns, compares, and dataset discovery. Example questions: ${supportedQuestions.join(" | ")}`,
    },
  ]
}

function buildCatalogSectionFromChunk(chunk: DatasetCatalogChunk): CatalogSection {
  return {
    id: chunk.id,
    title: chunk.title,
    summary: chunk.content,
    items: chunk.content.split(". ").slice(0, 3).map((item) => item.trim()).filter(Boolean),
  }
}

export function buildDiscoveryCatalogSections() {
  return buildDatasetCatalogChunks().map(buildCatalogSectionFromChunk)
}

function buildMemoryChunkTitle(response: Phase1AnalysisResponse) {
  if (response.intent === "discovery") {
    return "Discovery memory"
  }

  return `${response.intent.replace("_", " ")} memory`
}

export function buildConversationMemoryText(args: PersistConversationArgs) {
  const parts = [
    `User asked: ${args.question}`,
    `Intent: ${args.response.intent}`,
    `Active scope: ${args.response.activeScope}`,
    `Headline: ${args.response.headline}`,
    `Summary: ${args.response.summary}`,
    `Metric: ${args.response.metric}`,
  ]

  if (args.response.comparisonSummary) {
    parts.push(
      `Comparison: ${args.response.comparisonSummary.leftLabel} versus ${args.response.comparisonSummary.rightLabel}`
    )
  }

  if (args.response.catalogSections?.length) {
    parts.push(
      `Catalog sections: ${args.response.catalogSections.map((section) => section.title).join(", ")}`
    )
  }

  return parts.join(". ")
}

function mapRetrievedMatch(args: {
  id: string
  title: string
  content: string
  kind: string
  score: number
}): RetrievalMatch {
  return {
    id: args.id,
    title: args.title,
    content: args.content,
    kind: args.kind,
    score: Number(args.score.toFixed(4)),
  }
}

class FixtureRetrievalStore implements QueryLensRetrievalStore {
  private async ensureCatalogIndex() {
    if (globalThis.__querylensFixtureCatalogChunks) {
      return globalThis.__querylensFixtureCatalogChunks
    }

    const chunks = buildDatasetCatalogChunks()
    const embeddings = await embedTexts({
      texts: chunks.map((chunk) => chunk.content),
      task: "document",
    })

    globalThis.__querylensFixtureCatalogChunks = chunks.map((chunk, index) => ({
      ...chunk,
      embedding: embeddings[index],
    }))

    return globalThis.__querylensFixtureCatalogChunks
  }

  private getMessageStore() {
    if (!globalThis.__querylensFixtureConversationMessages) {
      globalThis.__querylensFixtureConversationMessages = new Map()
    }

    return globalThis.__querylensFixtureConversationMessages
  }

  private getMemoryStore() {
    if (!globalThis.__querylensFixtureMemoryChunks) {
      globalThis.__querylensFixtureMemoryChunks = new Map()
    }

    return globalThis.__querylensFixtureMemoryChunks
  }

  async retrieveContext(args: {
    chatId: string
    question: string
  }): Promise<RetrievalContext> {
    const questionEmbedding = (
      await embedTexts({ texts: [args.question], task: "query" })
    )[0]
    const catalog = await this.ensureCatalogIndex()
    const datasetMatches = [...catalog]
      .map((chunk) =>
        mapRetrievedMatch({
          id: chunk.id,
          title: chunk.title,
          content: chunk.content,
          kind: chunk.kind,
          score: cosineSimilarity(questionEmbedding, chunk.embedding),
        })
      )
      .sort((left, right) => right.score - left.score)
      .slice(0, CATALOG_TOP_K)

    const memoryChunks = this.getMemoryStore().get(args.chatId) ?? []
    const memoryMatches = [...memoryChunks]
      .map((chunk) =>
        mapRetrievedMatch({
          id: chunk.id,
          title: chunk.title,
          content: chunk.content,
          kind: chunk.kind,
          score: cosineSimilarity(questionEmbedding, chunk.embedding),
        })
      )
      .sort((left, right) => right.score - left.score)
      .slice(0, MEMORY_TOP_K)

    const recentMessages = [...(this.getMessageStore().get(args.chatId) ?? [])].slice(
      -RECENT_MESSAGE_LIMIT
    )

    return {
      datasetMatches,
      memoryMatches,
      recentMessages,
    }
  }

  async persistConversation(args: PersistConversationArgs): Promise<void> {
    const messages = this.getMessageStore()
    const currentMessages = messages.get(args.chatId) ?? []
    const timestamp = new Date().toISOString()

    const userMessage: StoredConversationMessage = {
      id: `user-${Date.now()}`,
      chatId: args.chatId,
      role: "user",
      text: args.question,
      createdAt: timestamp,
    }
    const assistantMessage: StoredConversationMessage = {
      id: `assistant-${Date.now() + 1}`,
      chatId: args.chatId,
      role: "assistant",
      text: args.response.summary,
      createdAt: timestamp,
    }

    messages.set(args.chatId, [...currentMessages, userMessage, assistantMessage])

    const memoryText = buildConversationMemoryText(args)
    const [embedding] = await embedTexts({ texts: [memoryText], task: "document" })
    const memoryStore = this.getMemoryStore()
    const currentChunks = memoryStore.get(args.chatId) ?? []

    memoryStore.set(args.chatId, [
      ...currentChunks,
      {
        id: `memory-${Date.now()}`,
        title: buildMemoryChunkTitle(args.response),
        content: memoryText,
        kind: "conversation_memory",
        score: 1,
        embedding,
      },
    ])
  }
}

interface RetrievalDbRow {
  id: string
  title: string
  content: string
  chunk_kind: string
  score: number | string
}

interface ConversationMessageDbRow {
  id: number
  chat_id: string
  role: "user" | "assistant"
  message_text: string
  created_at: Date | string
}

class DatabaseRetrievalStore implements QueryLensRetrievalStore {
  private async ensureSchema() {
    if (globalThis.__querylensPgRetrievalReady) {
      return
    }

    const pool = getPgPool()

    await pool.query(`
      CREATE EXTENSION IF NOT EXISTS vector;

      CREATE TABLE IF NOT EXISTS conversation_threads (
        chat_id TEXT PRIMARY KEY,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS conversation_messages (
        id BIGSERIAL PRIMARY KEY,
        chat_id TEXT NOT NULL REFERENCES conversation_threads(chat_id) ON DELETE CASCADE,
        role TEXT NOT NULL,
        message_text TEXT NOT NULL,
        intent TEXT,
        metric_id TEXT,
        active_scope TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS conversation_memory_chunks (
        id BIGSERIAL PRIMARY KEY,
        chat_id TEXT NOT NULL REFERENCES conversation_threads(chat_id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        source_message_ids BIGINT[] NOT NULL DEFAULT '{}',
        embedding vector(${EMBEDDING_DIMENSIONS}) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS dataset_catalog_chunks (
        id TEXT PRIMARY KEY,
        chunk_kind TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        embedding vector(${EMBEDDING_DIMENSIONS}) NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `)

    await pool.query(`
      CREATE INDEX IF NOT EXISTS conversation_messages_chat_idx
      ON conversation_messages (chat_id, created_at DESC);

      CREATE INDEX IF NOT EXISTS conversation_memory_chat_idx
      ON conversation_memory_chunks (chat_id, created_at DESC);
    `)

    globalThis.__querylensPgRetrievalReady = true
  }

  private async ensureCatalogIndex() {
    await this.ensureSchema()
    const pool = getPgPool()
    const countResult = await pool.query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM dataset_catalog_chunks"
    )

    if (Number(countResult.rows[0]?.count ?? 0) > 0) {
      return
    }

    const chunks = buildDatasetCatalogChunks()
    const embeddings = await embedTexts({
      texts: chunks.map((chunk) => chunk.content),
      task: "document",
    })

    for (const [index, chunk] of chunks.entries()) {
      await pool.query(
        `
          INSERT INTO dataset_catalog_chunks (id, chunk_kind, title, content, embedding)
          VALUES ($1, $2, $3, $4, $5::vector)
          ON CONFLICT (id) DO UPDATE SET
            chunk_kind = EXCLUDED.chunk_kind,
            title = EXCLUDED.title,
            content = EXCLUDED.content,
            embedding = EXCLUDED.embedding,
            updated_at = NOW()
        `,
        [
          chunk.id,
          chunk.kind,
          chunk.title,
          chunk.content,
          formatVectorLiteral(embeddings[index]),
        ]
      )
    }
  }

  async retrieveContext(args: {
    chatId: string
    question: string
  }): Promise<RetrievalContext> {
    await this.ensureCatalogIndex()
    const pool = getPgPool()
    const [queryEmbedding] = await embedTexts({
      texts: [args.question],
      task: "query",
    })
    const vector = formatVectorLiteral(queryEmbedding)

    const datasetResult = await pool.query<RetrievalDbRow>(
      `
        SELECT
          id,
          title,
          content,
          chunk_kind,
          1 - (embedding <=> $1::vector) AS score
        FROM dataset_catalog_chunks
        ORDER BY embedding <=> $1::vector
        LIMIT ${CATALOG_TOP_K}
      `,
      [vector]
    )

    const memoryResult = await pool.query<RetrievalDbRow>(
      `
        SELECT
          id::text,
          title,
          content,
          'conversation_memory' AS chunk_kind,
          1 - (embedding <=> $1::vector) AS score
        FROM conversation_memory_chunks
        WHERE chat_id = $2
        ORDER BY embedding <=> $1::vector
        LIMIT ${MEMORY_TOP_K}
      `,
      [vector, args.chatId]
    )

    const recentMessagesResult = await pool.query<ConversationMessageDbRow>(
      `
        SELECT id, chat_id, role, message_text, created_at
        FROM conversation_messages
        WHERE chat_id = $1
        ORDER BY created_at DESC
        LIMIT ${RECENT_MESSAGE_LIMIT}
      `,
      [args.chatId]
    )

    return {
      datasetMatches: datasetResult.rows.map((row) =>
        mapRetrievedMatch({
          id: row.id,
          title: row.title,
          content: row.content,
          kind: row.chunk_kind,
          score: Number(row.score),
        })
      ),
      memoryMatches: memoryResult.rows.map((row) =>
        mapRetrievedMatch({
          id: row.id,
          title: row.title,
          content: row.content,
          kind: row.chunk_kind,
          score: Number(row.score),
        })
      ),
      recentMessages: recentMessagesResult.rows
        .map((row) => ({
          id: String(row.id),
          chatId: row.chat_id,
          role: row.role,
          text: row.message_text,
          createdAt:
            typeof row.created_at === "string"
              ? row.created_at
              : row.created_at.toISOString(),
        }))
        .reverse(),
    }
  }

  async persistConversation(args: PersistConversationArgs): Promise<void> {
    await this.ensureSchema()
    const pool = getPgPool()

    await pool.query(
      `
        INSERT INTO conversation_threads (chat_id)
        VALUES ($1)
        ON CONFLICT (chat_id) DO UPDATE SET updated_at = NOW()
      `,
      [args.chatId]
    )

    const userInsert = await pool.query<{ id: string }>(
      `
        INSERT INTO conversation_messages (chat_id, role, message_text)
        VALUES ($1, 'user', $2)
        RETURNING id::text AS id
      `,
      [args.chatId, args.question]
    )

    const assistantInsert = await pool.query<{ id: string }>(
      `
        INSERT INTO conversation_messages (
          chat_id,
          role,
          message_text,
          intent,
          metric_id,
          active_scope
        )
        VALUES ($1, 'assistant', $2, $3, $4, $5)
        RETURNING id::text AS id
      `,
      [
        args.chatId,
        args.response.summary,
        args.response.intent,
        args.response.metric,
        args.response.activeScope,
      ]
    )

    const memoryText = buildConversationMemoryText(args)
    const [embedding] = await embedTexts({
      texts: [memoryText],
      task: "document",
    })

    await pool.query(
      `
        INSERT INTO conversation_memory_chunks (
          chat_id,
          title,
          content,
          source_message_ids,
          embedding
        )
        VALUES ($1, $2, $3, $4::bigint[], $5::vector)
      `,
      [
        args.chatId,
        buildMemoryChunkTitle(args.response),
        memoryText,
        [Number(userInsert.rows[0].id), Number(assistantInsert.rows[0].id)],
        formatVectorLiteral(embedding),
      ]
    )
  }
}

export async function getQueryLensRetrievalStore(): Promise<QueryLensRetrievalStore> {
  try {
    if (
      process.env.QUERYLENS_DATA_MODE === "fixture" ||
      !process.env.POSTGRES_URL
    ) {
      return new FixtureRetrievalStore()
    }

    return new DatabaseRetrievalStore()
  } catch {
    return new FixtureRetrievalStore()
  }
}
