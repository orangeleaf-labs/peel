import 'fake-indexeddb/auto'
import { afterEach, beforeEach, expect, jest, mock, spyOn, test } from 'bun:test'

import type { ToolExecutionOptions } from 'ai'

import { FigmaAPI } from '@open-pencil/core/figma-api'

import { createAITools, endRun, startRun } from '@/app/ai/tools'
import { runWithWriteApproval } from '@/app/ai/tools/approval'
import * as figmaFactory from '@/app/automation/bridge/figma-factory'
import { currentWriteApproval } from '@/app/automation/write-approval'
import { createEditorStore } from '@/app/editor/session/create'
import { WRITE_APPROVAL_TIMEOUT_MS } from '@/constants'

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

test('no answer before the timeout counts as Deny and runs nothing', async () => {
  jest.useFakeTimers()
  try {
    const execute = mock(async () => ({ written: true }))
    const pending = runWithWriteApproval(store, fileWriter, target, execute)
    await Promise.resolve()
    jest.advanceTimersByTime(WRITE_APPROVAL_TIMEOUT_MS)
    expect(await pending).toEqual({ error: expect.stringContaining('did not allow "save_copy"') })
    expect(execute).not.toHaveBeenCalled()
  } finally {
    jest.useRealTimers()
  }
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
    const options: ToolExecutionOptions<unknown> = {
      toolCallId: 'call-1',
      messages: [],
      context: undefined
    }
    const runs = [
      () =>
        tools.create_shape.execute?.(
          { type: 'RECTANGLE', x: 0, y: 0, width: 10, height: 10 },
          options
        ),
      () => tools.get_page_tree.execute?.({}, options),
      // The chat returns the SVG to the model; the `path` is not written.
      () => tools.export_svg.execute?.({ path: '/tmp/never-written.svg' }, options)
    ]
    for (const run of runs) {
      const result = run()
      expect(currentWriteApproval.value).toBeNull()
      await result
      expect(currentWriteApproval.value).toBeNull()
    }
    expect(store.graph.getChildren(store.state.currentPageId)).toHaveLength(1)
  } finally {
    factory.mockRestore()
  }
})
