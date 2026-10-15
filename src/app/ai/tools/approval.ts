import type { ToolDef } from '@open-pencil/core/tools'

import {
  requestWriteApproval,
  toolWriteRequest,
  writeDeniedMessage
} from '@/app/automation/write-approval'
import type { EditorStore } from '@/app/editor/active-store'

import { currentRun } from './run'

/**
 * Runs a chat tool call, first asking the user when it would write outside the document (files,
 * app settings). Document edits and reads run straight away. A denied call, or one whose reply
 * stopped while the user decided, returns an error to the model and runs nothing.
 */
export async function runWithWriteApproval(
  store: EditorStore,
  def: Pick<ToolDef, 'name' | 'capabilities'>,
  args: Record<string, unknown>,
  execute: () => Promise<unknown>
): Promise<unknown> {
  // The chat hands results to the model; only the MCP server writes a tool's `path`.
  const request = toolWriteRequest(def, args, { writesOutputPath: false })
  if (!request) return execute()
  const run = currentRun(store)
  // Stopping the reply withdraws its request, which then reads as stopped rather than denied.
  const allowed = await requestWriteApproval(request, run)
  if (!run.active) return { error: 'Stopped before this call ran; nothing was changed.' }
  if (!allowed) return { error: writeDeniedMessage(request) }
  return execute()
}
