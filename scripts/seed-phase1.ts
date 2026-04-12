import 'dotenv/config'
import { MongoClient } from "mongodb"
import { Pool } from "pg"

import { getSampleDataset } from "@/lib/querylens/seed-data"
import {
  buildDatasetCatalogChunks,
} from "@/lib/querylens/server/retrieval"
import {
  embedTexts,
  EMBEDDING_DIMENSIONS,
  formatVectorLiteral,
} from "@/lib/querylens/server/embedding-service"

async function seedPostgres(pool: Pool) {
  const dataset = getSampleDataset()

  await pool.query("BEGIN")

  try {
    await pool.query(`
      CREATE EXTENSION IF NOT EXISTS vector;

      DROP TABLE IF EXISTS conversation_memory_chunks;
      DROP TABLE IF EXISTS conversation_messages;
      DROP TABLE IF EXISTS conversation_threads;
      DROP TABLE IF EXISTS dataset_catalog_chunks;
      DROP TABLE IF EXISTS daily_account_metrics;
      DROP TABLE IF EXISTS weekly_portfolio_metrics;
      DROP TABLE IF EXISTS accounts;
      DROP TABLE IF EXISTS regions;
      DROP TABLE IF EXISTS sectors;
    `)

    await pool.query(`
      CREATE TABLE regions (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL
      );

      CREATE TABLE sectors (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL
      );

      CREATE TABLE accounts (
        id TEXT PRIMARY KEY,
        business_name TEXT NOT NULL,
        region_id TEXT NOT NULL REFERENCES regions(id),
        sector_id TEXT NOT NULL REFERENCES sectors(id),
        segment TEXT NOT NULL,
        low_balance_threshold NUMERIC NOT NULL,
        base_daily_inbound NUMERIC NOT NULL,
        base_daily_outbound NUMERIC NOT NULL,
        base_balance NUMERIC NOT NULL,
        base_utilization NUMERIC NOT NULL
      );

      CREATE TABLE daily_account_metrics (
        id BIGSERIAL PRIMARY KEY,
        account_id TEXT NOT NULL REFERENCES accounts(id),
        date DATE NOT NULL,
        week_start DATE NOT NULL,
        region_id TEXT NOT NULL REFERENCES regions(id),
        sector_id TEXT NOT NULL REFERENCES sectors(id),
        inbound_payments NUMERIC NOT NULL,
        outbound_payments NUMERIC NOT NULL,
        end_balance NUMERIC NOT NULL,
        loan_utilization NUMERIC NOT NULL,
        low_balance_flag BOOLEAN NOT NULL,
        overdue_flag BOOLEAN NOT NULL
      );

      CREATE TABLE weekly_portfolio_metrics (
        id BIGSERIAL PRIMARY KEY,
        week_start DATE NOT NULL,
        week_end DATE NOT NULL,
        record_type TEXT NOT NULL,
        region_id TEXT,
        sector_id TEXT,
        region_name TEXT,
        sector_name TEXT,
        account_count INTEGER NOT NULL,
        inbound_payments NUMERIC NOT NULL,
        outbound_payments NUMERIC NOT NULL,
        opening_balance NUMERIC NOT NULL,
        closing_balance NUMERIC NOT NULL,
        low_balance_share NUMERIC NOT NULL,
        overdue_share NUMERIC NOT NULL,
        avg_utilization NUMERIC NOT NULL,
        inflow_outflow_score NUMERIC NOT NULL,
        balance_trend_score NUMERIC NOT NULL,
        low_balance_score NUMERIC NOT NULL,
        overdue_score NUMERIC NOT NULL,
        cashflow_health_score NUMERIC NOT NULL
      );

      CREATE TABLE dataset_catalog_chunks (
        id TEXT PRIMARY KEY,
        chunk_kind TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        embedding vector(${EMBEDDING_DIMENSIONS}) NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE conversation_threads (
        chat_id TEXT PRIMARY KEY,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE conversation_messages (
        id BIGSERIAL PRIMARY KEY,
        chat_id TEXT NOT NULL REFERENCES conversation_threads(chat_id) ON DELETE CASCADE,
        role TEXT NOT NULL,
        message_text TEXT NOT NULL,
        intent TEXT,
        metric_id TEXT,
        active_scope TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE conversation_memory_chunks (
        id BIGSERIAL PRIMARY KEY,
        chat_id TEXT NOT NULL REFERENCES conversation_threads(chat_id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        source_message_ids BIGINT[] NOT NULL DEFAULT '{}',
        embedding vector(${EMBEDDING_DIMENSIONS}) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX daily_account_metrics_week_idx ON daily_account_metrics (week_start, region_id, sector_id);
      CREATE INDEX weekly_portfolio_metrics_scope_idx ON weekly_portfolio_metrics (week_start, record_type, region_id, sector_id);
      CREATE INDEX conversation_messages_chat_idx ON conversation_messages (chat_id, created_at DESC);
      CREATE INDEX conversation_memory_chat_idx ON conversation_memory_chunks (chat_id, created_at DESC);
    `)

    for (const region of dataset.regions) {
      await pool.query("INSERT INTO regions (id, name) VALUES ($1, $2)", [
        region.id,
        region.name,
      ])
    }

    for (const sector of dataset.sectors) {
      await pool.query("INSERT INTO sectors (id, name) VALUES ($1, $2)", [
        sector.id,
        sector.name,
      ])
    }

    for (const account of dataset.accounts) {
      await pool.query(
        `
          INSERT INTO accounts (
            id,
            business_name,
            region_id,
            sector_id,
            segment,
            low_balance_threshold,
            base_daily_inbound,
            base_daily_outbound,
            base_balance,
            base_utilization
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `,
        [
          account.id,
          account.businessName,
          account.regionId,
          account.sectorId,
          account.segment,
          account.lowBalanceThreshold,
          account.baseDailyInbound,
          account.baseDailyOutbound,
          account.baseBalance,
          account.baseUtilization,
        ]
      )
    }

    for (const metric of dataset.dailyMetrics) {
      await pool.query(
        `
          INSERT INTO daily_account_metrics (
            account_id,
            date,
            week_start,
            region_id,
            sector_id,
            inbound_payments,
            outbound_payments,
            end_balance,
            loan_utilization,
            low_balance_flag,
            overdue_flag
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `,
        [
          metric.accountId,
          metric.date,
          metric.weekStart,
          metric.regionId,
          metric.sectorId,
          metric.inboundPayments,
          metric.outboundPayments,
          metric.endBalance,
          metric.loanUtilization,
          metric.lowBalanceFlag,
          metric.overdueFlag,
        ]
      )
    }

    for (const metric of dataset.weeklyMetrics) {
      await pool.query(
        `
          INSERT INTO weekly_portfolio_metrics (
            week_start,
            week_end,
            record_type,
            region_id,
            sector_id,
            region_name,
            sector_name,
            account_count,
            inbound_payments,
            outbound_payments,
            opening_balance,
            closing_balance,
            low_balance_share,
            overdue_share,
            avg_utilization,
            inflow_outflow_score,
            balance_trend_score,
            low_balance_score,
            overdue_score,
            cashflow_health_score
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
            $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
          )
        `,
        [
          metric.weekStart,
          metric.weekEnd,
          metric.recordType,
          metric.regionId,
          metric.sectorId,
          metric.regionName,
          metric.sectorName,
          metric.accountCount,
          metric.inboundPayments,
          metric.outboundPayments,
          metric.openingBalance,
          metric.closingBalance,
          metric.lowBalanceShare,
          metric.overdueShare,
          metric.avgUtilization,
          metric.inflowOutflowScore,
          metric.balanceTrendScore,
          metric.lowBalanceScore,
          metric.overdueScore,
          metric.cashflowHealthScore,
        ]
      )
    }

    const catalogChunks = buildDatasetCatalogChunks()
    const catalogEmbeddings = await embedTexts({
      texts: catalogChunks.map((chunk) => chunk.content),
      task: "document",
    })

    for (const [index, chunk] of catalogChunks.entries()) {
      await pool.query(
        `
          INSERT INTO dataset_catalog_chunks (id, chunk_kind, title, content, embedding)
          VALUES ($1, $2, $3, $4, $5::vector)
        `,
        [
          chunk.id,
          chunk.kind,
          chunk.title,
          chunk.content,
          formatVectorLiteral(catalogEmbeddings[index]),
        ]
      )
    }

    await pool.query("COMMIT")
  } catch (error) {
    await pool.query("ROLLBACK")
    throw error
  }
}

async function seedMongo(client: MongoClient) {
  const dataset = getSampleDataset()
  const db = client.db()

  await Promise.all(
    Object.entries(dataset.contextEvents).map(async ([collectionName, documents]) => {
      const collection = db.collection(collectionName)
      await collection.deleteMany({})
      if (documents.length > 0) {
        await collection.insertMany(documents)
      }
    })
  )
}

async function main() {
  if (!process.env.POSTGRES_URL || !process.env.MONGODB_URL) {
    throw new Error("POSTGRES_URL and MONGODB_URL must be set before loading the sample dataset.")
  }

  const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
  })
  const mongoClient = await new MongoClient(process.env.MONGODB_URL).connect()

  try {
    await seedPostgres(pool)
    await seedMongo(mongoClient)
    console.log("QueryLens sample dataset load completed.")
  } finally {
    await pool.end()
    await mongoClient.close()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
