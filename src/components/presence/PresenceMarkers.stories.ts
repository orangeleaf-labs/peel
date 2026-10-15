import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, within } from 'storybook/test'

import type { PagePresenceEntry } from '@/app/presence/registry'

import PresenceMarkers from './PresenceMarkers.vue'

const you = { r: 0.3, g: 0.7, b: 0.45, a: 1 }

const twoAgents: PagePresenceEntry[] = [
  { id: 'agent:fern', kind: 'agent', name: 'Fern', color: you },
  { id: 'agent:orbit', kind: 'agent', name: 'Orbit', color: you }
]

type Args = { entries: PagePresenceEntry[] }

const meta = {
  title: 'App/Presence/Page Presence Markers',
  component: PresenceMarkers,
  tags: ['autodocs'],
  args: { entries: twoAgents },
  render: (args) => ({
    components: { PresenceMarkers },
    setup: () => ({ args }),
    template:
      '<div class="flex w-56 items-center gap-2 bg-panel p-3 text-xs text-surface"><span class="flex-1">Checkout</span><PresenceMarkers v-bind="args" /></div>'
  })
} satisfies Meta<Args>

export default meta
type Story = StoryObj<typeof meta>

export const YourAgent: Story = {
  args: { entries: [{ id: 'agent:fern', kind: 'agent', name: 'Fern', color: you }] }
}

export const TwoAgents: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('img')).toHaveAccessibleName('Fern, Orbit')
  }
}

export const MoreThanFit: Story = {
  args: {
    entries: [
      ...twoAgents,
      { id: 'agent:pixel', kind: 'agent', name: 'Pixel', color: you },
      { id: 'agent:juniper', kind: 'agent', name: 'Juniper', color: you },
      { id: 'agent:wren', kind: 'agent', name: 'Wren', color: you }
    ]
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('+2')).toBeVisible()
    await expect(canvas.getByRole('img')).toHaveAccessibleName('Fern, Orbit, Pixel, Juniper, Wren')
  }
}

export const Nobody: Story = {
  args: { entries: [] },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole('img')).toBeNull()
  }
}
