import 'fake-indexeddb/auto'
import { afterEach, describe, expect, test } from 'bun:test'

import { handleOpenFile, handleSaveFile } from '@/app/automation/bridge/file-handlers'
import type { AutomationTarget } from '@/app/automation/bridge/target'
import { createEditorStore, type EditorStore } from '@/app/editor/session/create'

import { clearTauriMocks, mockTauriIPC } from '#tests/helpers/tauri/mocks'

// What the fs plugin rejects with for a path outside the capability and the user's grants.
const OUTSIDE = '/Users/someone/elsewhere/design.fig'
const REFUSAL = `forbidden path: ${OUTSIDE}`

/** The automation error, which must name the path and not be the plugin's bare refusal. */
async function rejection(promise: Promise<unknown>): Promise<string> {
  const error = await promise.then(
    () => null,
    (reason: unknown) => reason
  )
  expect(error).toBeInstanceOf(Error)
  return error instanceof Error ? error.message : ''
}

let stores: EditorStore[] = []

afterEach(async () => {
  for (const store of stores) store.dispose()
  stores = []
  await clearTauriMocks()
  Reflect.deleteProperty(globalThis, 'window')
})

function automationTarget(): AutomationTarget {
  const store = createEditorStore()
  stores.push(store)
  const page = store.graph.getPages()[0]
  return {
    store,
    documentId: 'document',
    documentName: store.state.documentName,
    pageId: page.id,
    pageName: page.name
  }
}

describe('Tauri automation file handling', () => {
  test('refuses to save to a path the user never granted, and says why', async () => {
    const calls: string[] = []
    await mockTauriIPC((cmd) => {
      calls.push(cmd)
      if (cmd === 'plugin:fs|write_file') throw new Error(REFUSAL)
      return null
    })
    const target = automationTarget()

    const message = await rejection(handleSaveFile(target, { path: OUTSIDE }))
    expect(message).toContain(OUTSIDE)
    expect(message).not.toContain(REFUSAL)
    // No directory is created on the way: the scope would refuse it, and it is not the app's to make.
    expect(calls).not.toContain('plugin:fs|mkdir')
    expect(target.store.hasWritableSource()).toBe(false)
  })

  test('refuses to open a path the user never granted, and says why', async () => {
    await mockTauriIPC((cmd) => {
      if (cmd === 'plugin:fs|read_file') throw new Error(REFUSAL)
      return null
    })

    const message = await rejection(handleOpenFile(automationTarget(), { path: OUTSIDE }))
    expect(message).toContain(OUTSIDE)
    expect(message).not.toContain(REFUSAL)
  })

  test('passes other file errors through unchanged', async () => {
    await mockTauriIPC((cmd) => {
      if (cmd === 'plugin:fs|read_file') {
        throw new Error('No such file or directory (os error 2)')
      }
      return null
    })

    await expect(
      handleOpenFile(automationTarget(), { path: '/Users/someone/design.fig' })
    ).rejects.toThrow('No such file or directory (os error 2)')
  })
})
