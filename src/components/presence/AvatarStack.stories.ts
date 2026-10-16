import type { Meta, StoryObj } from '@storybook/vue3-vite'

import AvatarStack from './AvatarStack.vue'
import { people } from './examples/people'
import type { PresencePersonRow } from './rows'

type Args = {
  people: PresencePersonRow[]
  max: number
  size: 'sm' | 'md'
  label: string
}

const meta = {
  title: 'App/Presence/Avatar Stack',
  component: AvatarStack,
  tags: ['autodocs'],
  args: { people, max: 3, size: 'sm', label: 'Dana, Ana, Ben' },
  render: (args) => ({
    components: { AvatarStack },
    setup: () => ({ args }),
    template: '<div class="bg-panel p-4"><AvatarStack v-bind="args" /></div>'
  })
} satisfies Meta<Args>

export default meta
type Story = StoryObj<typeof meta>

export const People: Story = {}

export const Large: Story = {
  args: { size: 'md' }
}

export const MoreThanFit: Story = {
  args: { max: 2 }
}

export const Alone: Story = {
  args: { people: people.slice(0, 1), label: 'Dana' }
}
