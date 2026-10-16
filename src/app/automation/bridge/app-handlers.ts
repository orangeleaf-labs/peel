import { receiveAutomationCall } from '@/app/automation/bridge/call'
import type { AutomationTarget } from '@/app/automation/bridge/target'
import { isAutomationUndoLabel } from '@/app/automation/execution/editor'
import { approveWrite, settingsPatchPaths } from '@/app/automation/write-approval'
import {
  parseAutomationSettingsPatch,
  readAutomationSettings,
  updateAutomationSettings
} from '@/app/settings/automation'
import { switchTab } from '@/app/tabs'

export async function handleActivateDocument(
  target: AutomationTarget,
  _args: unknown
): Promise<unknown> {
  switchTab(target.documentId)
  if (target.store.state.currentPageId !== target.pageId) {
    await target.store.switchPage(target.pageId)
  }
  return { ok: true, result: { activated: true } }
}

type HistoryDirection = 'undo' | 'redo'

// The history is shared with the person in the editor, so automation steps back only
// through its own changes, and only while they are on top.
function stepHistory(target: AutomationTarget, direction: HistoryDirection) {
  const store = target.store
  if (store.state.nodeEditState) {
    throw new Error('The document is in vector edit mode; finish editing in the app first')
  }
  const available = direction === 'undo' ? store.undo.canUndo : store.undo.canRedo
  if (!available) return { applied: false, label: null }
  const label = direction === 'undo' ? store.undo.undoLabel : store.undo.redoLabel
  if (!isAutomationUndoLabel(label)) {
    const change = direction === 'undo' ? 'last change' : 'last undone change'
    throw new Error(
      `The ${change}${label ? ` ("${label}")` : ''} was made in the editor, not through automation; ${direction} it there`
    )
  }
  if (direction === 'undo') store.undoAction()
  else store.redoAction()
  return { applied: true, label }
}

export async function handleUndo(target: AutomationTarget, _args: unknown): Promise<unknown> {
  return { ok: true, result: stepHistory(target, 'undo') }
}

export async function handleRedo(target: AutomationTarget, _args: unknown): Promise<unknown> {
  return { ok: true, result: stepHistory(target, 'redo') }
}

export function handleGetSettings(): unknown {
  return { ok: true, result: { settings: readAutomationSettings() } }
}

/** App settings outlive the document, so the user allows each change an agent asks for. */
export async function handleUpdateSettings(
  args: unknown,
  call = receiveAutomationCall(args)
): Promise<unknown> {
  const settings = (args as { settings?: unknown } | undefined)?.settings ?? {}
  // A patch that would be rejected anyway is rejected before the user is asked.
  const patch = parseAutomationSettingsPatch(settings)
  const changes = settingsPatchPaths(patch)
  if (changes.length > 0) {
    await approveWrite(
      { tool: 'update_settings', kind: 'settings', target: changes.join(', ') },
      call.approval
    )
  }
  return { ok: true, result: { settings: updateAutomationSettings(patch) } }
}
