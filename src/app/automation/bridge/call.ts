import { AUTOMATION_APPROVAL_DEADLINE_MS } from '@open-pencil/core/rpc'

import { agentApprovalOwner, readAgentSession } from '@/app/automation/agents'
import { isUnknownRecord } from '@/app/automation/bridge/target'
import type { WriteApprovalOptions } from '@/app/automation/write-approval'

/** What a handler knows about the automation request it serves, beyond its arguments. */
export interface AutomationCall {
  /**
   * How a write the call asks the user about is settled: by a deadline from when the app received
   * the call, before its caller gives up (`AUTOMATION_APPROVAL_RPC_TIMEOUT_MS`), and withdrawn
   * when the app's own ACP or Pi chat that made it stops.
   */
  approval: WriteApprovalOptions
}

/** Starts a call's clock as the app receives it. */
export function receiveAutomationCall(args: unknown, now = Date.now()): AutomationCall {
  const session = isUnknownRecord(args) ? readAgentSession(args.agent) : null
  return {
    approval: {
      deadline: now + AUTOMATION_APPROVAL_DEADLINE_MS,
      owner: agentApprovalOwner(session)
    }
  }
}
