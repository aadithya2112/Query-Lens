const CONVERSATIONAL_SMALL_TALK_PATTERN =
  /^(hi|hello|hey|yo|sup|good (morning|afternoon|evening)|thanks|thank you|ok|okay|cool|nice|how are you)[!.?,\s]*$/i

export function isConversationalSmallTalk(question: string) {
  const trimmed = question.trim()
  if (!trimmed) {
    return true
  }

  return CONVERSATIONAL_SMALL_TALK_PATTERN.test(trimmed)
}
