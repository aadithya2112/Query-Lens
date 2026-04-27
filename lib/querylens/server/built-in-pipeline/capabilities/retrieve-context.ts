import type {
  ContextEvent,
  DateWindow,
  ScopeFilter,
} from "@/lib/querylens/types"
import {
  assertBuiltInCapability,
  type BuiltInCapabilityContext,
} from "@/lib/querylens/server/built-in-pipeline/capabilities/types"

export async function retrieveContextCapability(args: {
  context: BuiltInCapabilityContext
  requests: Array<{
    window: DateWindow
    scope: ScopeFilter
  }>
}): Promise<ContextEvent[]> {
  assertBuiltInCapability(args.context, "retrieve_context")

  const eventsByRequest = await Promise.all(
    args.requests.map((request) =>
      args.context.dataAccess.listContextEvents({
        targetStart: request.window.startDate,
        targetEnd: request.window.endDate,
        scope: request.scope,
      }),
    ),
  )

  return eventsByRequest.flat()
}
