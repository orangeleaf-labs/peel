import type { Color } from '@open-pencil/scene-graph/primitives'

import { agentPage } from '@/app/presence/registry'
import type { AgentPresence, AgentStatus, FollowTarget } from '@/app/presence/types'

export interface PresenceAgentRow {
  id: string
  name: string
  status: AgentStatus
  /** The page the agent works on, when it is working. */
  page?: string
  renamable: boolean
}

export interface PresencePersonRow {
  /** A stable key for anyone other than you, such as a comment author; undefined for you. */
  clientId?: number
  name: string
  color: Color
  agents: PresenceAgentRow[]
}

function agentRows(
  agents: readonly AgentPresence[],
  pageName: (pageId: string) => string | undefined,
  renamable: boolean
): PresenceAgentRow[] {
  return agents.map((agent) => ({
    id: agent.id,
    name: agent.name,
    status: agent.status,
    page: agent.status !== 'idle' && agent.cursor ? pageName(agent.cursor.pageId) : undefined,
    renamable
  }))
}

/** You on one page, with only the agents you run there; empty while none of them works there. */
export function pagePresenceRows(
  self: { name: string; color: Color; agents: readonly AgentPresence[] },
  pageId: string
): PresencePersonRow[] {
  const agents = agentRows(
    self.agents.filter((agent) => agentPage(agent) === pageId),
    () => undefined,
    false
  )
  return agents.length > 0 ? [{ name: self.name, color: self.color, agents }] : []
}

export function isFollowing(following: FollowTarget | null, target: FollowTarget): boolean {
  return following?.agentId === target.agentId
}
