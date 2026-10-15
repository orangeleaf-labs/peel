import 'fake-indexeddb/auto'
import { afterEach, beforeEach, expect, mock, spyOn, test } from 'bun:test'

import { FigmaAPI } from '@open-pencil/core/figma-api'

import { createAITools, endRun, startRun } from '@/app/ai/tools'
import { runWithWriteApproval } from '@/app/ai/tools/approval'
import * as figmaFactory from '@/app/automation/bridge/figma-factory'
import { currentWriteApproval } from '@/app/automation/write-approval'
import { createEditorStore } from '@/app/editor/session/create'

import { answerNextWriteApproval, nextWriteApproval } from '#tests/helpers/write-approval'

type EditorStore = ReturnType<typeof createEditorStore>

let store: EditorStore

beforeEach(() => {
  store = createEditorStore()
  startRun(store, 10)
})

afterEach(() => {
  endRun(store)
  store.dispose()
})

const fileWriter = { name: 'save_copy', capabilities: ['filesystem:write'] } as const
const target = { path: '/Users/me/Desktop/copy.fig' }

test('a chat call that writes a file waits for the user and runs on Allow', async () => {
  const execute = mock(async () => ({ written: true }))
  const pending = runWithWriteApproval(store, fileWriter, target, execute)

  const request = await nextWriteApproval()
  expect(request).toEqual({ tool: 'save_copy', kind: 'write', target: target.path })
  expect(execute).not.toHaveBeenCalled()

  await answerNextWriteApproval(true)
  expect(await pending).toEqual({ written: true })
  expect(execute).toHaveBeenCalledTimes(1)
})

test('Deny returns an error to the model and runs nothing', async () => {
  const execute = mock(async () => ({ written: true }))
  const pending = runWithWriteApproval(store, fileWriter, target, execute)
  await answerNextWriteApproval(false)

  const result = await pending
  expect(result).toEqual({ error: expect.stringContaining('did not allow "save_copy"') })
  expect(execute).not.toHaveBeenCalled()
})

test('a reply stopped while the user decided runs nothing, even on Allow', async () => {
  const execute = mock(async () => ({ written: true }))
  const pending = runWithWriteApproval(store, fileWriter, target, execute)
  await nextWriteApproval()
  endRun(store)
  await answerNextWriteApproval(true)

  expect(await pending).toEqual({ error: expect.stringContaining('Stopped') })
  expect(execute).not.toHaveBeenCalled()
})

test('document edits, reads and returned exports from the chat never ask', async () => {
  const factory = spyOn(figmaFactory, 'makeFigmaFromStore').mockImplementation((editor, pageId) => {
    const api = new FigmaAPI(editor.graph)
    api.currentPage = api.wrapNode(pageId ?? editor.state.currentPageId)
    return api
  })
  try {
    const tools = createAITools(store)
    const options = { toolCallId: 'call-1', messages: [] }
    const calls: Array<[keyof typeof tools, Record<string, unknown>]> = [
      ['create_shape', { type: 'RECTANGLE', x: 0, y: 0, width: 10, height: 10 }],
      ['get_page_tree', {}],
      // The chat returns the SVG to the model; the `path` is not written.
      ['export_svg', { path: '/tmp/never-written.svg' }]
    ]
    for (const [name, input] of calls) {
      const execute = tools[name].execute
      if (!execute) throw new Error(`${String(name)} has no execute`)
      const result = execute(input, options)
      expect(currentWriteApproval.value).toBeNull()
      await result
      expect(currentWriteApproval.value).toBeNull()
    }
    expect(store.graph.getChildren(store.state.currentPageId)).toHaveLength(1)
  } finally {
    factory.mockRestore()
  }
})
