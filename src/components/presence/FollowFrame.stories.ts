import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, fn, userEvent, within } from 'storybook/test'

import type { FollowedLabel } from '@/app/presence/registry'

import FollowFrame from './FollowFrame.vue'

const fern = { r: 0.3, g: 0.7, b: 0.45, a: 1 }

type Args = { followed: FollowedLabel; onStop: () => void }

const meta = {
  title: 'App/Presence/Follow Frame',
  component: FollowFrame,
  args: { followed: { kind: 'agent', name: 'Fern', color: fern }, onStop: fn() },
  render: (args) => ({
    components: { FollowFrame },
    setup: () => ({ args }),
    template: '<div class="relative h-64 w-[480px] bg-canvas"><FollowFrame v-bind="args" /></div>'
  })
} satisfies Meta<Args>

export default meta
type Story = StoryObj<Meta<Args>>

export const FollowingAnAgent: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('status')).toHaveTextContent('Following Fern')
    await userEvent.click(canvas.getByRole('button', { name: 'Stop following' }))
    await expect(args.onStop).toHaveBeenCalledOnce()
  }
}
