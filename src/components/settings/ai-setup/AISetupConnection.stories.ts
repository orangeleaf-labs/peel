import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, within } from 'storybook/test'

import AISetupConnection from './AISetupConnection.vue'

interface Args {
  providerID: 'anthropic'
  hasSavedKey: boolean
}

const meta = {
  title: 'App/Settings/AI Setup/Connection',
  args: {
    providerID: 'anthropic',
    hasSavedKey: false
  },
  render: (args) => ({
    components: { AISetupConnection },
    setup: () => ({
      args,
      state: { apiKey: '', test: 'idle', reason: null }
    }),
    template:
      '<div class="w-[30rem] max-w-full"><AISetupConnection v-bind="args" :state="state" /></div>'
  })
} satisfies Meta<Args>

export default meta
type Story = StoryObj<typeof meta>

export const APIKey: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByLabelText('API Key')).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Test connection' })).toBeVisible()
  }
}
export const SavedAPIKey: Story = {
  args: { hasSavedKey: true }
}
