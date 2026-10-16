import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, within } from 'storybook/test'

import {
  modelSettingsSnapshot,
  replaceAIModelSettings,
  type AIModelSettings
} from '@/app/ai/models'
import { AppDialogRoot } from '@/components/ui/dialog'

import AISetupFlow from './AISetupFlow.vue'

interface Args {
  entry: 'welcome' | 'guided'
  offersTour?: boolean
}

const freshInstall: AIModelSettings = {
  version: 1,
  connections: [
    {
      id: 'connection-default',
      providerID: 'anthropic',
      credentialProfileId: 'default'
    }
  ],
  models: [
    {
      id: 'model-default',
      name: 'Design model',
      connectionId: 'connection-default',
      modelID: '',
      customModelID: '',
      maxOutputTokens: 16_384,
      thinkingLevel: 'default',
      capabilities: ['tools']
    }
  ],
  assignments: { design: 'model-default', review: 'design', fast: 'design', vision: null }
}

const meta = {
  title: 'App/Settings/AI Setup/Guided Setup',
  args: { entry: 'guided' },
  parameters: {
    docs: {
      description: {
        component:
          'Skippable guided setup over the same model settings that Settings → AI edits directly. Each story starts from fresh-install settings and restores the previous ones afterwards.'
      }
    }
  },
  beforeEach: () => {
    const previous = modelSettingsSnapshot()
    replaceAIModelSettings(freshInstall)
    return () => replaceAIModelSettings(previous)
  },
  render: (args) => ({
    components: { AppDialogRoot, AISetupFlow },
    setup: () => ({ args }),
    template: '<AppDialogRoot :open="true" size="md"><AISetupFlow v-bind="args" /></AppDialogRoot>'
  })
} satisfies Meta<Args>

export default meta
type Story = StoryObj<typeof meta>

const page = () => within(document.body)

async function choose(name: string | RegExp) {
  await userEvent.click(page().getByRole('checkbox', { name }))
}

async function next() {
  await userEvent.click(page().getByRole('button', { name: 'Continue' }))
}

export const Welcome: Story = { args: { entry: 'welcome' } }

/** Offered over the demo, which is the tour, so it does not point to it. */
export const WelcomeInTour: Story = { args: { entry: 'welcome', offersTour: false } }
export const Goals: Story = {}
/** Anthropic is the only access offered, and no coding agent is. */
export const Access: Story = {
  play: async () => {
    await next()
    await expect(page().getAllByRole('checkbox')).toHaveLength(1)
    await expect(page().getByRole('checkbox', { name: 'Anthropic' })).toBeVisible()
  }
}

export const ConnectAnthropic: Story = {
  play: async () => {
    await next()
    await choose('Anthropic')
    await next()
    await expect(page().getByLabelText('API Key')).toBeVisible()
    await expect(page().getByRole('button', { name: 'Continue' })).toBeDisabled()
  }
}

export const NothingCovered: Story = {
  play: async () => {
    await next()
    await next()
    await expect(page().getByRole('button', { name: 'Continue' })).toBeDisabled()
  }
}
