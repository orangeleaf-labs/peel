import type { Rect } from '@open-pencil/scene-graph/primitives'

import type { PagePoint } from '@/app/editor/pages/point'

export const AGENT_KINDS = ['chat', 'acp', 'harness', 'mcp'] as const
export type AgentKind = (typeof AGENT_KINDS)[number]

export const AGENT_STATUSES = ['thinking', 'editing', 'idle'] as const
export type AgentStatus = (typeof AGENT_STATUSES)[number]

/** A person's pointer, with the zoom they view it at so followers can match it. */
export interface PersonPoint extends PagePoint {
  zoom?: number
}

/** Who to keep in view: one of the agents working in this document. */
export interface FollowTarget {
  kind: 'agent'
  agentId: string
}

/** An agent working in this document, as the canvas and page list show it: metadata only. */
export interface AgentPresence {
  id: string
  /** A callsign, unique among the document's agents, such as "Fern". */
  name: string
  kind: AgentKind
  model?: string
  status: AgentStatus
  /** The page the agent works on, known before its first edit. */
  pageId?: string
  /** Where the agent last worked, derived from the nodes it touched. */
  cursor?: PagePoint
  selection?: string[]
  /** Outlines, in world coordinates on the cursor's page, of what is not a layer yet. */
  outline?: Rect[]
}
