import 'fake-indexeddb/auto'
import { afterEach, expect, spyOn, test } from 'bun:test'

import { createEditorStore } from '@/app/editor/session/create'
import {
  addAgent,
  follow,
  followedLabel,
  presenceByPage,
  presenceOf,
  renameAgent
} from '@/app/presence/registry'

const stores: ReturnType<typeof createEditorStore>[] = []
afterEach(() => {
  for (const store of stores.splice(0)) store.dispose()
})

function setup() {
  const store = createEditorStore()
  stores.push(store)
  return { store, pageId: store.state.currentPageId, other: store.graph.addPage('Other').id }
}

test('draws active agents on their page, in the agent color', () => {
  const { store, pageId, other } = setup()
  const here = addAgent(store, 'chat')
  const there = addAgent(store, 'chat')
  here.update({ status: 'editing', cursor: { x: 5, y: 6, pageId } })
  there.update({ status: 'editing', cursor: { x: 1, y: 1, pageId: other } })
  expect(store.state.presenceCursors).toEqual([
    {
      id: `agent:${here.id}`,
      kind: 'agent',
      name: here.name,
      color: expect.anything(),
      x: 5,
      y: 6,
      selection: undefined,
      outline: undefined
    }
  ])
})

test('hides idle agents and gives each a different callsign', () => {
  const { store, pageId } = setup()
  const agents = Array.from({ length: 5 }, () => addAgent(store, 'chat'))
  expect(new Set(agents.map((agent) => agent.name)).size).toBe(5)
  agents[0]?.update({ status: 'idle', cursor: { x: 0, y: 0, pageId } })
  expect(store.state.presenceCursors).toEqual([])
})

test('follows the page on screen', async () => {
  const { store, other } = setup()
  addAgent(store, 'chat').update({ status: 'editing', cursor: { x: 1, y: 1, pageId: other } })
  expect(store.state.presenceCursors).toHaveLength(0)
  store.preparationController.acknowledgePresentation(Number.MAX_SAFE_INTEGER)
  await store.switchPage(other)
  expect(store.state.presenceCursors).toHaveLength(1)
})

/** In app tests the viewport falls back to 1920 × 1080. */
function centered(store: ReturnType<typeof createEditorStore>) {
  const { panX, panY, zoom } = store.state
  return { x: (960 - panX) / zoom, y: (540 - panY) / zoom }
}

test('following an agent takes the view to its page and keeps its cursor centered', async () => {
  const { store, other } = setup()
  store.preparationController.acknowledgePresentation(Number.MAX_SAFE_INTEGER)
  const agent = addAgent(store, 'chat')
  agent.update({ status: 'editing', cursor: { x: 300, y: 200, pageId: other } })
  const switched = new Promise<string>((resolve) => {
    store.onEditorEvent('page:changed', resolve)
  })
  follow(store, { kind: 'agent', agentId: agent.id })
  expect(await switched).toBe(other)
  expect(centered(store)).toEqual({ x: 300, y: 200 })

  agent.update({ cursor: { x: 500, y: 100, pageId: other } })
  expect(centered(store)).toEqual({ x: 500, y: 100 })
})

test('an idle agent keeps its followers; a departed one releases them', () => {
  const { store, pageId } = setup()
  const agent = addAgent(store, 'chat')
  agent.update({ status: 'editing', cursor: { x: 10, y: 10, pageId } })
  follow(store, { kind: 'agent', agentId: agent.id })
  agent.update({ status: 'idle', cursor: undefined })
  expect(presenceOf(store).following.value).toEqual({ kind: 'agent', agentId: agent.id })
  agent.remove()
  expect(presenceOf(store).following.value).toBeNull()
})

test('switching to another page yourself stops following', async () => {
  const { store, pageId, other } = setup()
  store.preparationController.acknowledgePresentation(Number.MAX_SAFE_INTEGER)
  const agent = addAgent(store, 'chat')
  agent.update({ status: 'editing', cursor: { x: 40, y: 50, pageId } })
  follow(store, { kind: 'agent', agentId: agent.id })
  expect(followedLabel(store)).toEqual({
    kind: 'agent',
    name: agent.name,
    color: expect.anything()
  })
  await store.switchPage(other)
  expect(presenceOf(store).following.value).toBeNull()
})

test('following survives the target moving on while its page switch is in flight', async () => {
  const { store, other } = setup()
  store.preparationController.acknowledgePresentation(Number.MAX_SAFE_INTEGER)
  const third = store.graph.addPage('Third').id
  const agent = addAgent(store, 'chat')
  agent.update({ status: 'editing', cursor: { x: 10, y: 10, pageId: other } })
  const reachedThird = new Promise<void>((resolve) => {
    store.onEditorEvent('page:changed', (id) => {
      if (id === third) resolve()
    })
  })
  follow(store, { kind: 'agent', agentId: agent.id })
  // Before the switch to `other` lands, the agent moves to a third page.
  agent.update({ cursor: { x: 20, y: 20, pageId: third } })
  await reachedThird
  expect(presenceOf(store).following.value).toEqual({ kind: 'agent', agentId: agent.id })
  expect(store.state.currentPageId).toBe(third)
})

test('switching pages yourself stops following a resting agent too', async () => {
  const { store, other } = setup()
  store.preparationController.acknowledgePresentation(Number.MAX_SAFE_INTEGER)
  const agent = addAgent(store, 'chat')
  follow(store, { kind: 'agent', agentId: agent.id })
  await store.switchPage(other)
  expect(presenceOf(store).following.value).toBeNull()
})

test('zooming yourself stops following', () => {
  const { store, pageId } = setup()
  const agent = addAgent(store, 'chat')
  agent.update({ status: 'editing', cursor: { x: 40, y: 50, pageId } })
  follow(store, { kind: 'agent', agentId: agent.id })
  agent.update({ cursor: { x: 60, y: 70, pageId } })
  expect(presenceOf(store).following.value).toEqual({ kind: 'agent', agentId: agent.id })
  store.applyZoom(-100, 960, 540)
  expect(presenceOf(store).following.value).toBeNull()
})

test('cursor updates while heading to a page do not restart the switch', async () => {
  const { store, other } = setup()
  store.preparationController.acknowledgePresentation(Number.MAX_SAFE_INTEGER)
  const switchPage = spyOn(store, 'switchPage')
  const agent = addAgent(store, 'chat')
  agent.update({ status: 'editing', cursor: { x: 10, y: 10, pageId: other } })
  const arrived = new Promise<void>((resolve) => {
    store.onEditorEvent('page:changed', () => resolve())
  })
  follow(store, { kind: 'agent', agentId: agent.id })
  for (const x of [20, 30, 40]) agent.update({ cursor: { x, y: 10, pageId: other } })
  await arrived
  expect(switchPage).toHaveBeenCalledTimes(1)
  expect(store.state.currentPageId).toBe(other)
})

test('zooming while following heads to another page stops following', () => {
  const { store, other } = setup()
  const agent = addAgent(store, 'chat')
  agent.update({ status: 'editing', cursor: { x: 10, y: 10, pageId: other } })
  follow(store, { kind: 'agent', agentId: agent.id })
  store.applyZoom(-100, 960, 540)
  expect(presenceOf(store).following.value).toBeNull()
})

test('a cursor on a page this document lacks is waited out, not switched to', () => {
  const { store } = setup()
  const switchPage = spyOn(store, 'switchPage')
  const agent = addAgent(store, 'chat')
  agent.update({ status: 'editing', cursor: { x: 1, y: 1, pageId: 'missing' } })
  follow(store, { kind: 'agent', agentId: agent.id })
  expect(switchPage).not.toHaveBeenCalled()
  expect(presenceOf(store).following.value).toEqual({ kind: 'agent', agentId: agent.id })
})

test('stopping while following heads to another page stays where you are', async () => {
  const { store, pageId, other } = setup()
  store.preparationController.acknowledgePresentation(Number.MAX_SAFE_INTEGER)
  const agent = addAgent(store, 'chat')
  agent.update({ status: 'editing', cursor: { x: 10, y: 10, pageId: other } })
  follow(store, { kind: 'agent', agentId: agent.id })
  follow(store, null)
  await new Promise((resolve) => {
    setTimeout(resolve, 20)
  })
  expect(store.state.currentPageId).toBe(pageId)
})

test('renames our agents, and their handles report the new name', () => {
  const { store } = setup()
  const agent = addAgent(store, 'chat')
  renameAgent(store, agent.id, '  Juniper  ')
  expect(agent.name).toBe('Juniper')
  renameAgent(store, agent.id, '   ')
  expect(agent.name).toBe('Juniper')
})

test("lists working agents by page, knowing an agent's page before its first edit", () => {
  const { store, pageId, other } = setup()
  addAgent(store, 'chat')
  const thinking = addAgent(store, 'chat')
  thinking.update({ status: 'thinking', pageId: other })
  expect(presenceByPage(store).get(pageId)).toBeUndefined()
  expect(presenceByPage(store).get(other)).toEqual([
    { id: `agent:${thinking.id}`, kind: 'agent', name: thinking.name, color: expect.anything() }
  ])
})

test('without animation frames, cursors and following move at once', () => {
  const { store, pageId } = setup()
  const agent = addAgent(store, 'chat')
  agent.update({ status: 'editing', cursor: { x: 5, y: 6, pageId } })
  agent.update({ status: 'editing', cursor: { x: 50, y: 60, pageId } })
  expect(store.state.presenceCursors.map(({ x, y }) => ({ x, y }))).toEqual([{ x: 50, y: 60 }])

  follow(store, { kind: 'agent', agentId: agent.id })
  expect(centered(store)).toEqual({ x: 50, y: 60 })
})
