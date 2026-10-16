import type { PresencePersonRow } from '../rows'

/** Sample people for presence stories: you with your agents, then two comment authors. */
export const colors = {
  ana: { r: 0.92, g: 0.34, b: 0.29, a: 1 },
  ben: { r: 0.2, g: 0.55, b: 0.95, a: 1 },
  you: { r: 0.3, g: 0.7, b: 0.45, a: 1 }
}

export const people: PresencePersonRow[] = [
  {
    name: 'Dana',
    color: colors.you,
    agents: [
      { id: 'fern', name: 'Fern', status: 'editing', page: 'Checkout', renamable: true },
      { id: 'orbit', name: 'Orbit', status: 'thinking', page: 'Cover', renamable: true },
      { id: 'pixel', name: 'Pixel', status: 'idle', renamable: true }
    ]
  },
  { clientId: 2, name: 'Ana', color: colors.ana, agents: [] },
  { clientId: 3, name: 'Ben', color: colors.ben, agents: [] }
]
