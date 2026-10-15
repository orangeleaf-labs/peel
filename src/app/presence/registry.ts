import { shallowRef, type ShallowRef } from 'vue'

import { AI_ACTIVE_COLOR } from '@open-pencil/core/constants'
import { computeContentBounds } from '@open-pencil/core/io'
import type { Color } from '@open-pencil/scene-graph/primitives'
import { randomHex } from '@open-pencil/scene-graph/random'

import type { EditorStore } from '@/app/editor/active-store'
import { appPreferences } from '@/app/settings/preferences/store'

import { pickCallsign } from './callsigns'
import { glideViewTo, showCursors, stopViewGlide, type TrackedCursor } from './cursor-motion'
import { MAX_NAME_LENGTH } from './limits'
import type { AgentKind, AgentPresence, FollowTarget, PersonPoint } from './types'

/** Agents' color on the canvas and in the page list. */
const SOLO_AGENT_COLOR: Color = { ...AI_ACTIVE_COLOR, a: 1 }

interface Presence {
  /** Agents running in this app for the document. */
  agents: ShallowRef<readonly AgentPresence[]>
  /** Who the viewport follows, if anyone. */
  following: ShallowRef<FollowTarget | null>
  /** The page following put the view on; landing anywhere else means you left. */
  followPage: string | null
  /** The page a follow switch is on its way to, so cursor updates do not restart it. */
  switching: string | null
  /** True while following centers the view; any other viewport change is yours. */
  moving: boolean
  /** Our agents the person stopped following mid-work; following them again waits until they rest. */
  declined: Set<string>
  /** The agent Follow agents started following, which ends when it rests; null for one picked. */
  autoFollowed: string | null
}

const presences = new WeakMap<EditorStore, Presence>()

export function presenceOf(store: EditorStore): Presence {
  const existing = presences.get(store)
  if (existing) return existing
  const presence: Presence = {
    agents: shallowRef([]),
    following: shallowRef(null),
    followPage: null,
    switching: null,
    moving: false,
    declined: new Set(),
    autoFollowed: null
  }
  presences.set(store, presence)
  store.onEditorEvent('page:changed', () => {
    stopIfLeftFollowedPage(store)
    refreshCursors(store)
  })
  // Zooming or fitting the view yourself, by any shortcut or menu, ends following. A page
  // switch restores that page's viewport without this event, so only centering is ours.
  store.onEditorEvent('viewport:changed', () => {
    if (presence.following.value && !presence.moving) stopFollowing(store, true)
  })
  return presence
}

/** An agent working on a page, as page lists show them. */
export interface PagePresenceEntry {
  /** Stable per agent; names can repeat. */
  id: string
  kind: 'agent'
  name: string
  color: Color
}

/** The page an agent is working on, or undefined while it is idle. */
export function agentPage(agent: AgentPresence): string | undefined {
  return agent.status === 'idle' ? undefined : (agent.pageId ?? agent.cursor?.pageId)
}

/**
 * Working agents by page. Reads reactive state, so computed values that call it update as
 * agents start and stop.
 */
export function presenceByPage(store: EditorStore): Map<string, PagePresenceEntry[]> {
  const byPage = new Map<string, PagePresenceEntry[]>()
  for (const agent of presenceOf(store).agents.value) {
    const pageId = agentPage(agent)
    if (!pageId) continue
    byPage.set(pageId, [
      ...(byPage.get(pageId) ?? []),
      { id: `agent:${agent.id}`, kind: 'agent', name: agent.name, color: SOLO_AGENT_COLOR }
    ])
  }
  return byPage
}

function agentCursor(agent: AgentPresence, color: Color, pageId: string): TrackedCursor[] {
  if (agent.status === 'idle' || agent.cursor?.pageId !== pageId) return []
  const { x, y } = agent.cursor
  return [
    {
      id: `agent:${agent.id}`,
      kind: 'agent',
      name: agent.name,
      color,
      x,
      y,
      selection: agent.selection,
      outline: agent.outline
    }
  ]
}

/** Draw the agents working on the page on screen. */
export function refreshCursors(store: EditorStore): void {
  const pageId = store.state.currentPageId
  showCursors(
    store,
    presenceOf(store).agents.value.flatMap((agent) => agentCursor(agent, SOLO_AGENT_COLOR, pageId))
  )
  autoFollow(store)
  keepFollowing(store)
}

/** An agent in a run: following it starts here and waits for its first cursor. */
function isWorking(agent: AgentPresence): boolean {
  return agent.status !== 'idle'
}

/**
 * With Follow agents on, the view follows our agents while they work: whichever starts first
 * when nobody is followed, and the next one at work once the followed agent rests. Following
 * starts with the run, so leaving the page or moving the view while the agent thinks counts as
 * stopping, and an agent the person stopped following is left alone until it rests. When the
 * last one rests, as its reply finishes, stops, or fails, following ends; an agent the person
 * picked to follow keeps its followers while it rests.
 */
function autoFollow(store: EditorStore): void {
  const presence = presenceOf(store)
  const working = presence.agents.value.filter(isWorking)
  for (const id of presence.declined) {
    if (!working.some((agent) => agent.id === id)) presence.declined.delete(id)
  }
  const target = presence.following.value
  if (target?.kind !== 'agent' || target.agentId !== presence.autoFollowed) {
    presence.autoFollowed = null
  }
  if (!appPreferences.value.chat.followAgents) return
  if (target && working.some((agent) => agent.id === target.agentId)) return
  const next = working.find((agent) => !presence.declined.has(agent.id))
  if (next) {
    presence.following.value = { kind: 'agent', agentId: next.id }
    presence.autoFollowed = next.id
    presence.followPage = store.state.currentPageId
  } else if (presence.autoFollowed !== null && target?.agentId === presence.autoFollowed) {
    presence.autoFollowed = null
    stopFollowing(store, false)
  }
}

/** Starts following our agents at work right away, for when Follow agents is turned on. */
export function followWorkingAgents(store: EditorStore): void {
  autoFollow(store)
  keepFollowing(store)
}

/** Where the followed agent is: null when it is gone, idle while it rests. */
function followedPoint(store: EditorStore, target: FollowTarget): PersonPoint | 'idle' | null {
  const agent = presenceOf(store).agents.value.find((entry) => entry.id === target.agentId)
  if (!agent) return null
  return agent.status === 'idle' ? 'idle' : (agent.cursor ?? 'idle')
}

/** Move the view to the followed agent; stop when it is gone. */
function keepFollowing(store: EditorStore): void {
  const presence = presenceOf(store)
  const target = presence.following.value
  if (!target) return
  const point = followedPoint(store, target)
  if (point === 'idle') return
  if (!point) {
    presence.following.value = null
    return
  }
  // A cursor can name a page this document no longer has; wait as for a resting agent.
  if (store.graph.getNode(point.pageId)?.type !== 'CANVAS') return
  presence.followPage = point.pageId
  if (point.pageId !== store.state.currentPageId) {
    // Each switch cancels the one before it, so frequent cursor updates must not restart one
    // already heading to this page; when it lands, follow wherever they went meanwhile.
    if (presence.switching === point.pageId) return
    const pageId = point.pageId
    presence.switching = pageId
    void store.switchPage(pageId).finally(() => {
      if (presence.switching === pageId) presence.switching = null
      if (store.state.currentPageId === pageId) keepFollowing(store)
    })
    return
  }
  glideViewTo(store, point, point.zoom ?? store.state.zoom, (x, y, zoom) => {
    // Following ended while the view was on its way: leave it where the person left it.
    if (!presence.following.value) return
    presence.moving = true
    try {
      store.centerOn(x, y, zoom)
    } finally {
      presence.moving = false
    }
  })
}

/** A page change following did not make is yours, so it ends following, even of a resting agent. */
function stopIfLeftFollowedPage(store: EditorStore): void {
  const presence = presenceOf(store)
  if (presence.following.value && store.state.currentPageId !== presence.followPage) {
    declineFollowed(presence)
    presence.following.value = null
  }
}

/** The person stopped following an agent of ours at work: auto-follow leaves it until it rests. */
function declineFollowed(presence: Presence): void {
  const target = presence.following.value
  if (!target) return
  const agent = presence.agents.value.find((entry) => entry.id === target.agentId)
  if (agent && isWorking(agent)) presence.declined.add(agent.id)
}

/** Who the view follows, for showing it: the agent's name and color. */
export interface FollowedLabel {
  kind: FollowTarget['kind']
  name: string
  color: Color
}

export function followedLabel(store: EditorStore): FollowedLabel | null {
  const { agents, following } = presenceOf(store)
  const target = following.value
  if (!target) return null
  const agent = agents.value.find((entry) => entry.id === target.agentId)
  return agent ? { kind: 'agent', name: agent.name, color: SOLO_AGENT_COLOR } : null
}

/** Stop following; a follow switch still loading is overtaken, so it does not land later. */
function stopFollowing(store: EditorStore, byPerson: boolean): void {
  const presence = presenceOf(store)
  if (byPerson) declineFollowed(presence)
  presence.following.value = null
  stopViewGlide(store)
  if (presence.switching) {
    presence.switching = null
    void store.switchPage(store.state.currentPageId)
  }
}

/** Follow an agent, or stop following with null. */
export function follow(store: EditorStore, target: FollowTarget | null): void {
  if (!target) {
    stopFollowing(store, true)
    return
  }
  const presence = presenceOf(store)
  presence.following.value = target
  // Picked by the person, so it keeps following an agent that rests.
  presence.autoFollowed = null
  presence.followPage = store.state.currentPageId
  keepFollowing(store)
}

/** Rename one of our agents. */
export function renameAgent(store: EditorStore, agentId: string, name: string): void {
  const trimmed = name.trim().slice(0, MAX_NAME_LENGTH)
  const presence = presenceOf(store)
  if (!trimmed) return
  presence.agents.value = presence.agents.value.map((agent) =>
    agent.id === agentId ? { ...agent, name: trimmed } : agent
  )
  refreshCursors(store)
}

export interface AgentHandle {
  readonly id: string
  readonly name: string
  update: (patch: Partial<Omit<AgentPresence, 'id' | 'name' | 'kind'>>) => void
  remove: () => void
}

/** Announce an agent working in this document under a callsign unique among visible agents. */
export function addAgent(store: EditorStore, kind: AgentKind, model?: string): AgentHandle {
  const presence = presenceOf(store)
  const taken = new Set(presence.agents.value.map((agent) => agent.name))
  const agent: AgentPresence = {
    id: randomHex(8),
    name: pickCallsign(taken),
    kind,
    model,
    status: 'idle'
  }
  presence.agents.value = [...presence.agents.value, agent]
  const current = () => presence.agents.value.find((entry) => entry.id === agent.id)
  const replace = (next: AgentPresence | null) => {
    const agents = presence.agents.value
    presence.agents.value = next
      ? agents.map((entry) => (entry.id === agent.id ? next : entry))
      : agents.filter((entry) => entry.id !== agent.id)
    refreshCursors(store)
  }
  return {
    id: agent.id,
    // The owner may rename the agent.
    get name() {
      return current()?.name ?? agent.name
    },
    update: (patch) => {
      const entry = current()
      if (entry) replace({ ...entry, ...patch })
    },
    remove: () => replace(null)
  }
}

/**
 * Where an agent shows it is working on `nodeIds`: on the page they are on, whichever page the
 * agent started from, with its cursor at their top-left corner and their outlines. Null when
 * none of them is in the document.
 */
export function agentPlacement(
  store: EditorStore,
  nodeIds: readonly string[],
  fallbackPageId: string
): Pick<AgentPresence, 'pageId' | 'cursor' | 'selection' | 'outline'> | null {
  const present = nodeIds.filter((id) => store.graph.getNode(id))
  const bounds = computeContentBounds(store.graph, present)
  if (!bounds) return null
  const [first] = present
  const pageId = (first && store.graph.pageOf(first)) ?? fallbackPageId
  return {
    pageId,
    cursor: { x: bounds.minX, y: bounds.minY, pageId },
    selection: present,
    outline: undefined
  }
}
