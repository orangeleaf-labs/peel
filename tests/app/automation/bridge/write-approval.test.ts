import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, jest, spyOn, test, vi } from 'bun:test'

import { toRaw } from 'vue'

import * as layoutModule from '@open-pencil/core/layout'
import {
  AUTOMATION_APPROVAL_DEADLINE_MS,
  MCP_CLIENT_DEFAULT_REQUEST_TIMEOUT_MS,
  AUTOMATION_APPROVAL_RPC_TIMEOUT_MS,
  automationRPCTimeout
} from '@open-pencil/core/rpc'

import { restAgents } from '@/app/automation/agents'
import { receiveAutomationCall } from '@/app/automation/bridge/call'
import { makeFigmaFromStore } from '@/app/automation/bridge/figma-factory'
import { handleSaveFile } from '@/app/automation/bridge/file-handlers'
import { createAutomationCommandHandlers } from '@/app/automation/bridge/handlers'
import { resolveAutomationTarget } from '@/app/automation/bridge/target'
import {
  answerWriteApproval,
  currentWriteApproval,
  denyWriteApprovals,
  WriteDeniedError
} from '@/app/automation/write-approval'
import { readAutomationSettings } from '@/app/settings/automation'
import { appPreferences } from '@/app/settings/preferences/store'
import { createTab, getActiveStore, getTabById, getTabsSnapshot } from '@/app/tabs'

import { expectDefined } from '#tests/helpers/assert'
import { asDouble } from '#tests/helpers/doubles'
import { answerNextWriteApproval, nextWriteApproval } from '#tests/helpers/write-approval'

const { handleRequest } = createAutomationCommandHandlers(makeFigmaFromStore)

type Response = { ok: boolean; result: Record<string, unknown> }

function request(command: string, args: Record<string, unknown> = {}) {
  return handleRequest(getActiveStore(), command, args) as Promise<Response>
}

function dirtyTab() {
  const tab = createTab()
  tab.store.createShape('RECTANGLE', 0, 0, 10, 10)
  return tab
}

let previousPreferences: typeof appPreferences.value

beforeEach(() => {
  globalThis.window = asDouble<Window & typeof globalThis>({
    innerWidth: 1024,
    innerHeight: 768,
    requestAnimationFrame: (callback: FrameRequestCallback) => {
      callback(0)
      return 0
    },
    cancelAnimationFrame: vi.fn(),
    openPencil: {},
    location: { href: 'http://localhost/' } as Location,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  })
  globalThis.document = asDouble<Document>({
    fonts: { add: vi.fn(), ready: Promise.resolve() }
  })
  vi.spyOn(layoutModule, 'computeAllLayouts').mockReturnValue(undefined)
  previousPreferences = structuredClone(toRaw(appPreferences.value))
})

afterEach(() => {
  // A request a failed test left waiting must not stand in front of the next file's.
  denyWriteApprovals()
  vi.restoreAllMocks()
  appPreferences.value = previousPreferences
  Reflect.deleteProperty(globalThis, 'window')
  Reflect.deleteProperty(globalThis, 'document')
})

describe('save_file', () => {
  test('waits for the user, names the file, and saves on Allow', async () => {
    const tab = dirtyTab()
    const save = spyOn(tab.store, 'saveFigFileToPath').mockResolvedValue(true)
    const pending = request('save_file', { document_id: tab.id, path: '/tmp/agent.fig' })

    expect(await nextWriteApproval()).toEqual({
      tool: 'save_file',
      kind: 'save',
      target: '/tmp/agent.fig'
    })
    expect(save).not.toHaveBeenCalled()

    await answerNextWriteApproval(true)
    expect((await pending).result).toEqual({ saved: true })
    expect(save).toHaveBeenCalledWith('/tmp/agent.fig')
  })

  test('Deny fails the call and writes nothing', async () => {
    const tab = dirtyTab()
    const save = spyOn(tab.store, 'saveFigFileToPath').mockResolvedValue(true)
    const pending = request('save_file', { document_id: tab.id, path: '/tmp/agent.fig' })
    await answerNextWriteApproval(false)

    await expect(pending).rejects.toBeInstanceOf(WriteDeniedError)
    expect(save).not.toHaveBeenCalled()
    expect(tab.store.hasUnsavedChanges()).toBe(true)
    expect(tab.store.getDocumentFilePath()).toBeNull()
  })

  test('a save that cannot happen fails without asking', async () => {
    const tab = dirtyTab()
    await expect(request('save_file', { document_id: tab.id })).rejects.toThrow(
      'has not been saved to a file yet'
    )
    expect(currentWriteApproval.value).toBeNull()
  })
})

test('close_file that saves first asks, and Deny keeps the document open', async () => {
  const tab = dirtyTab()
  const save = spyOn(tab.store, 'saveFigFileToPath').mockResolvedValue(true)
  const pending = request('close_file', {
    document_id: tab.id,
    unsaved: 'save',
    path: '/tmp/closing.fig'
  })
  expect((await answerNextWriteApproval(false)).tool).toBe('close_file')

  await expect(pending).rejects.toBeInstanceOf(WriteDeniedError)
  expect(save).not.toHaveBeenCalled()
  expect(getTabById(tab.id)).toBeDefined()
})

test('new_document with a path asks before it opens a tab', async () => {
  createTab()
  const tabs = getTabsSnapshot().length
  const pending = request('new_document', { path: '/tmp/new.fig' })
  expect(await nextWriteApproval()).toEqual({
    tool: 'new_document',
    kind: 'save',
    target: '/tmp/new.fig'
  })
  expect(getTabsSnapshot()).toHaveLength(tabs)
  await answerNextWriteApproval(false)

  await expect(pending).rejects.toBeInstanceOf(WriteDeniedError)
  expect(getTabsSnapshot()).toHaveLength(tabs)
})

describe('update_settings', () => {
  test('names the settings it changes and applies them on Allow', async () => {
    createTab()
    const pending = request('update_settings', {
      settings: { chat: { reasoningDisplay: 'collapsed' } }
    })
    expect(await nextWriteApproval()).toEqual({
      tool: 'update_settings',
      kind: 'settings',
      target: 'chat.reasoningDisplay'
    })
    await answerNextWriteApproval(true)
    await pending
    expect(readAutomationSettings().chat.reasoningDisplay).toBe('collapsed')
  })

  test('Deny leaves every setting as it was', async () => {
    createTab()
    const before = readAutomationSettings()
    const next = before.chat.reasoningDisplay === 'collapsed' ? 'expanded' : 'collapsed'
    const pending = request('update_settings', { settings: { chat: { reasoningDisplay: next } } })
    await answerNextWriteApproval(false)

    await expect(pending).rejects.toBeInstanceOf(WriteDeniedError)
    expect(readAutomationSettings()).toEqual(before)
  })

  test('an invalid patch fails without asking', async () => {
    createTab()
    await expect(
      request('update_settings', { settings: { chat: { reasoningDisplay: 'loud' } } })
    ).rejects.toThrow('Invalid settings')
    expect(currentWriteApproval.value).toBeNull()
  })
})

describe('tool', () => {
  test('an export the MCP server writes to a path waits, and Deny returns no data', async () => {
    const tab = createTab()
    tab.store.createShape('RECTANGLE', 0, 0, 10, 10)
    const pending = request('tool', {
      document_id: tab.id,
      name: 'export_svg',
      args: { path: 'card.svg' }
    })
    expect(await nextWriteApproval()).toEqual({
      tool: 'export_svg',
      kind: 'export',
      target: 'card.svg',
      format: 'SVG'
    })
    await answerNextWriteApproval(false)
    await expect(pending).rejects.toBeInstanceOf(WriteDeniedError)

    const allowed = request('tool', {
      document_id: tab.id,
      name: 'export_svg',
      args: { path: 'card.svg' }
    })
    await answerNextWriteApproval(true)
    expect((await allowed).result.svg).toEqual(expect.stringContaining('<svg'))
  })

  test('document edits, reads and returned exports never ask', async () => {
    const tab = createTab()
    const page = tab.store.state.currentPageId
    const calls: Array<[string, Record<string, unknown>]> = [
      ['create_shape', { type: 'RECTANGLE', x: 0, y: 0, width: 10, height: 10 }],
      ['get_page_tree', {}],
      ['export_svg', {}]
    ]
    for (const [name, args] of calls) {
      const response = request('tool', { document_id: tab.id, page_id: page, name, args })
      expect(currentWriteApproval.value).toBeNull()
      await response
      expect(currentWriteApproval.value).toBeNull()
    }
    expect(tab.store.graph.getChildren(page)).toHaveLength(1)
  })
})

describe('scripts', () => {
  const code = "figma.createRectangle(); return 'ran'"

  test('eval waits for the user, shows the script, and runs on Allow', async () => {
    const tab = createTab()
    const page = tab.store.state.currentPageId
    const pending = request('eval', { document_id: tab.id, code })
    const asked = await nextWriteApproval()
    expect(asked).toMatchObject({ tool: 'eval', kind: 'code' })
    expect(asked.target).toContain('figma.createRectangle()')
    expect(tab.store.graph.getChildren(page)).toHaveLength(0)

    await answerNextWriteApproval(true)
    const result: unknown = (await pending).result
    expect(result).toBe('ran')
    expect(tab.store.graph.getChildren(page)).toHaveLength(1)
  })

  test('Deny runs nothing, through eval or the eval tool', async () => {
    const tab = createTab()
    const page = tab.store.state.currentPageId
    const viaCommand = request('eval', { document_id: tab.id, code })
    await answerNextWriteApproval(false)
    await expect(viaCommand).rejects.toBeInstanceOf(WriteDeniedError)

    const viaTool = request('tool', { document_id: tab.id, name: 'eval', args: { code } })
    expect((await answerNextWriteApproval(false)).kind).toBe('code')
    await expect(viaTool).rejects.toBeInstanceOf(WriteDeniedError)
    expect(tab.store.graph.getChildren(page)).toHaveLength(0)
  })
})

describe('approvals never outlive their caller', () => {
  test('past the deadline from receipt the call is denied, and a later Allow writes nothing', async () => {
    const tab = dirtyTab()
    const save = spyOn(tab.store, 'saveFigFileToPath').mockResolvedValue(true)
    const target = resolveAutomationTarget(tab.store, { document_id: tab.id })
    jest.useFakeTimers()
    try {
      const args = { path: '/tmp/late.fig' }
      const pending = handleSaveFile(target, args, receiveAutomationCall(args))
      const asked = expectDefined(currentWriteApproval.value, 'approval')
      jest.advanceTimersByTime(AUTOMATION_APPROVAL_DEADLINE_MS)
      expect(currentWriteApproval.value).toBeNull()
      answerWriteApproval(asked, true)
      await expect(pending).rejects.toBeInstanceOf(WriteDeniedError)
    } finally {
      jest.useRealTimers()
    }
    expect(save).not.toHaveBeenCalled()
  })

  test('the deadline ends before the MCP client, the MCP server, and the CLI stop waiting', () => {
    // MCP SDK clients give up after 60 s by default; an Allow must never land after that.
    expect(AUTOMATION_APPROVAL_DEADLINE_MS).toBeLessThanOrEqual(
      MCP_CLIENT_DEFAULT_REQUEST_TIMEOUT_MS - 10_000
    )
    expect(AUTOMATION_APPROVAL_DEADLINE_MS).toBeLessThan(AUTOMATION_APPROVAL_RPC_TIMEOUT_MS)
    for (const command of ['save_file', 'close_file', 'new_document', 'update_settings', 'eval']) {
      expect(automationRPCTimeout(command, 20_000)).toBe(AUTOMATION_APPROVAL_RPC_TIMEOUT_MS)
    }
    expect(automationRPCTimeout('tool', 20_000)).toBe(AUTOMATION_APPROVAL_RPC_TIMEOUT_MS)
    expect(automationRPCTimeout('list_documents', 20_000)).toBe(20_000)
    const call = receiveAutomationCall({}, 1_000)
    expect(call.approval.deadline).toBe(1_000 + AUTOMATION_APPROVAL_DEADLINE_MS)
  })

  test("stopping the app's ACP chat withdraws its pending writes, not an outside client's", async () => {
    const tab = createTab()
    tab.store.createShape('RECTANGLE', 0, 0, 10, 10)
    const exportCall = (kind: 'acp' | 'mcp', session: string) =>
      request('tool', {
        document_id: tab.id,
        name: 'export_svg',
        args: { path: `${session}.svg` },
        agent: { session, kind }
      })
    const fromChat = exportCall('acp', 'chat-session')
    const fromClient = exportCall('mcp', 'outside-session')
    await nextWriteApproval()

    restAgents('acp')
    await expect(fromChat).rejects.toBeInstanceOf(WriteDeniedError)
    expect((await answerNextWriteApproval(true)).target).toBe('outside-session.svg')
    expect((await fromClient).result.svg).toEqual(expect.stringContaining('<svg'))
  })
})
