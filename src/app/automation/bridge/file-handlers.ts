import * as v from 'valibot'

import { parseToolArgs } from '@open-pencil/core/tools'

import { receiveAutomationCall, type AutomationCall } from '@/app/automation/bridge/call'
import {
  resolveAutomationTarget,
  responseWithTarget,
  type AutomationTarget
} from '@/app/automation/bridge/target'
import { approveWrite } from '@/app/automation/write-approval'
import { resolveBrowserFileURL } from '@/app/document/io/browser'
import { openBrowserFileFromURL } from '@/app/shell/menu/files'
import { openFileFromPath } from '@/app/shell/menu/use'
import { closeTab, createTab, getActiveStore, getTabById } from '@/app/tabs'
import { isTauri } from '@/app/tauri/env'

const saveArgsSchema = v.object({ path: v.optional(v.string()) })

const closeArgsSchema = v.object({
  path: v.optional(v.string()),
  unsaved: v.optional(v.picklist(['error', 'save', 'discard']), 'error')
})

/** The fs plugin's refusal of a path outside the desktop capability and the files the user granted. */
export function isFileScopeRefusal(error: unknown): boolean {
  return /forbidden path/i.test(error instanceof Error ? error.message : String(error))
}

/**
 * The desktop app reads and writes documents only where the user put them: files picked in an
 * Open or Save dialog, or opened from the system file manager (`desktop/capabilities/default.json`).
 * An automation client naming any other path is refused rather than given a wider scope.
 */
export function automationPathOutsideScope(action: 'open' | 'save', path: string): Error {
  return new Error(
    `The desktop app cannot ${action} "${path}" for automation: it only reads and writes files ` +
      'the user opened or saved in the app, through a file dialog or the system file manager. ' +
      `Have the user ${action} the file in the app once, then retry.`
  )
}

async function withFileScope<T>(
  action: 'open' | 'save',
  path: string,
  run: () => Promise<T>
): Promise<T> {
  try {
    return await run()
  } catch (error) {
    if (isTauri() && isFileScopeRefusal(error)) throw automationPathOutsideScope(action, path)
    throw error
  }
}

// Automation never opens the Save dialog: nobody may be there to answer it.
function assertSavable(store: AutomationTarget['store'], path?: string): void {
  if (!path && !store.hasWritableSource()) {
    throw new Error(
      `"${store.state.documentName}" has not been saved to a file yet; pass a path to save it`
    )
  }
}

/** The user allows each save an agent asks for, naming the file it writes. */
function approveSave(
  call: AutomationCall,
  tool: string,
  store: AutomationTarget['store'],
  path?: string
) {
  const target = path ?? store.getDocumentFilePath() ?? store.state.documentName
  return approveWrite({ tool, kind: 'save', target }, call.approval)
}

async function saveWithoutPrompt(store: AutomationTarget['store'], path?: string): Promise<void> {
  const name = store.state.documentName
  assertSavable(store, path)
  // A failed save to a new path leaves the document with the source it had.
  const saved = path
    ? await withFileScope('save', path, () => store.saveFigFileToPath(path))
    : await store.saveFigFile()
  if (!saved) throw new Error(`Could not save "${name}"`)
}

/** Saves once the user allows it; a denied save writes nothing. */
async function approvedSave(
  call: AutomationCall,
  tool: string,
  store: AutomationTarget['store'],
  path?: string
) {
  assertSavable(store, path)
  await approveSave(call, tool, store, path)
  await saveWithoutPrompt(store, path)
}

export async function handleSaveFile(
  target: AutomationTarget,
  args: unknown,
  call = receiveAutomationCall(args)
): Promise<unknown> {
  const { path } = parseToolArgs('save_file', saveArgsSchema, args)
  await approvedSave(call, 'save_file', target.store, path)
  return { ok: true, result: { saved: true } }
}

export async function handleCloseFile(
  target: AutomationTarget,
  args: unknown,
  call = receiveAutomationCall(args)
): Promise<unknown> {
  const { path, unsaved } = parseToolArgs('close_file', closeArgsSchema, args)
  const store = target.store
  if (store.hasUnsavedChanges()) {
    if (unsaved === 'error') {
      throw new Error(
        `"${store.state.documentName}" has unsaved changes. ` +
          'Save or discard them: CLI --save or --discard, MCP unsaved "save" or "discard"'
      )
    }
    if (unsaved === 'save') await approvedSave(call, 'close_file', store, path)
  }
  await closeTab(target.documentId, unsaved === 'discard' ? 'discard' : 'save')
  return { ok: true, result: { closed: getTabById(target.documentId) === undefined } }
}

export async function handleNewDocument(
  _target: AutomationTarget,
  args: unknown,
  call = receiveAutomationCall(args)
): Promise<unknown> {
  const { path } = parseToolArgs('new_document', saveArgsSchema, args)
  // Asked before the tab opens, so a denied file leaves no new document behind.
  if (path) await approveWrite({ tool: 'new_document', kind: 'save', target: path }, call.approval)
  const tab = createTab()
  if (path) {
    try {
      await saveWithoutPrompt(tab.store, path)
    } catch (error) {
      await closeTab(tab.id, 'discard')
      throw error
    }
  }
  const target = resolveAutomationTarget(tab.store, { document_id: tab.id })
  return responseWithTarget({ ok: true, result: { created: true } }, target)
}

export async function handleOpenFile(_target: AutomationTarget, args: unknown): Promise<unknown> {
  const path = (args as { path?: string }).path
  if (!path) throw new Error('Missing "path" in args')
  if (isTauri()) {
    await withFileScope('open', path, () => openFileFromPath(path))
  } else {
    // Same fetch, cap and format check as every other browser open: an automation client
    // is not more trusted than a link.
    await openBrowserFileFromURL(resolveBrowserFileURL(path))
  }
  const target = resolveAutomationTarget(getActiveStore(), undefined)
  return responseWithTarget({ ok: true, result: { opened: true } }, target)
}
