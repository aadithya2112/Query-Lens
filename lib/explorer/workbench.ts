import type { QueryMockMatch } from "@/lib/explorer/types"

const KEYWORDS = [
  "select",
  "from",
  "where",
  "group by",
  "order by",
  "having",
  "limit",
  "offset",
  "join",
  "left join",
  "right join",
  "inner join",
  "outer join",
  "union",
  "with",
  "as",
  "and",
  "or",
  "desc",
  "asc",
]

export function normalizeQuery(query: string) {
  return query.replace(/\s+/g, " ").trim().toLowerCase()
}

export function resolveMockQueryPreviewId(
  query: string,
  queryMocks: QueryMockMatch[],
  fallbackPreviewId: string,
) {
  const normalized = normalizeQuery(query)

  if (!normalized) {
    return fallbackPreviewId
  }

  const matched = queryMocks.find((candidate) =>
    candidate.matchers.every((matcher) => normalized.includes(matcher))
  )

  return matched?.previewId ?? fallbackPreviewId
}

export function formatSqlQuery(query: string) {
  let next = query.replace(/\r\n/g, "\n").trim()

  for (const keyword of KEYWORDS) {
    const escaped = keyword.replace(/\s+/g, "\\s+")
    const regex = new RegExp(`\\b${escaped}\\b`, "gi")
    next = next.replace(regex, keyword.toUpperCase())
  }

  next = next
    .replace(/\s+FROM\b/g, "\nFROM")
    .replace(/\s+WHERE\b/g, "\nWHERE")
    .replace(/\s+GROUP BY\b/g, "\nGROUP BY")
    .replace(/\s+ORDER BY\b/g, "\nORDER BY")
    .replace(/\s+HAVING\b/g, "\nHAVING")
    .replace(/\s+LIMIT\b/g, "\nLIMIT")
    .replace(/\s+OFFSET\b/g, "\nOFFSET")
    .replace(/\s+(INNER|LEFT|RIGHT|OUTER)?\s*JOIN\b/g, "\n$1 JOIN")
    .replace(/\n{3,}/g, "\n\n")

  return `${next.replace(/\s+\n/g, "\n")}\n`
}
