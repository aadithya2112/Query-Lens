import { normalizeSemanticText } from "@/lib/querylens/semantic-manifest"

export type BroadQuestionCapability =
  | "csv_preview"
  | "source_catalog"
  | "visual_overview"
  | "clarification"

export function classifyBroadQuestion(
  question: string,
): BroadQuestionCapability | undefined {
  const normalizedQuestion = normalizeSemanticText(question)

  if (!normalizedQuestion) {
    return "clarification"
  }

  if (
    /^(any question|anything|whatever|what can you answer|what can i ask)$/.test(
      normalizedQuestion,
    )
  ) {
    return "clarification"
  }

  if (
    /\b(csv|uploaded|upload)\b/.test(normalizedQuestion) &&
    /\b(show|preview|view|display|data|rows|records|table)\b/.test(
      normalizedQuestion,
    ) &&
    !/\b(by|trend|over time|total|sum|average|avg|count)\b/.test(
      normalizedQuestion,
    )
  ) {
    return "csv_preview"
  }

  if (
    /\b(visualize|visualise|chart|plot|graph)\b/.test(normalizedQuestion) ||
    /\b(most important|important information|important trends|key information|key insights|main insights|summarize insights|summarise insights)\b/.test(
      normalizedQuestion,
    )
  ) {
    return "visual_overview"
  }

  if (
    /\b(table|tables|source|sources|context|schema|columns|fields)\b/.test(
      normalizedQuestion,
    ) &&
    /\b(break down|breakdown|understand|explain|what kind|what data|stored|available|have)\b/.test(
      normalizedQuestion,
    )
  ) {
    return "source_catalog"
  }

  return undefined
}
