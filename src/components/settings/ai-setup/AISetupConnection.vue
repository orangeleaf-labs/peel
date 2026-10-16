<script setup lang="ts">
import { tv } from 'tailwind-variants'
import { computed } from 'vue'

import { ACP_AGENTS, AI_PROVIDERS } from '@open-pencil/core/constants'
import { useI18n } from '@open-pencil/vue'

import type { AgentSetupState, PiSetupState } from '@/app/ai/agents/setup'
import { modelProviderName } from '@/app/ai/models/provider-name'
import type {
  OnboardingConnectionPatch,
  OnboardingConnectionState
} from '@/app/ai/models/settings/onboarding/connections'
import { isOnboardingAgent, type OnboardingAccess } from '@/app/ai/models/settings/onboarding/plan'
import AgentSetup from '@/components/settings/agents/AgentSetup.vue'
import PiSetup from '@/components/settings/agents/PiSetup.vue'
import ProviderConnectionTestButton from '@/components/settings/provider/ProviderConnectionTestButton.vue'
import ProviderLogo from '@/components/settings/provider/ProviderLogo.vue'
import ProviderSettingsKeyField from '@/components/settings/provider/ProviderSettingsKeyField.vue'
import theme from '@/theme/settings/ai-setup/flow'

const {
  providerID,
  state,
  hasSavedKey = false,
  agentSetup,
  piSetup,
  disabled = false
} = defineProps<{
  providerID: OnboardingAccess
  state: OnboardingConnectionState
  /** A key saved for the connection that matches what is entered now. */
  hasSavedKey?: boolean
  /** Whether a coding agent and the MCP server it needs are installed. */
  agentSetup?: AgentSetupState
  /** Whether Pi's companion and the MCP server are installed, and Pi's default model. */
  piSetup?: PiSetupState
  disabled?: boolean
}>()
const emit = defineEmits<{
  update: [patch: OnboardingConnectionPatch]
  test: []
  checkAgent: []
  installAgent: []
  installBridge: []
}>()
const { ai, credentials } = useI18n()
const styles = tv(theme)()

const name = computed(() => modelProviderName(providerID))
const agent = computed(() =>
  isOnboardingAgent(providerID)
    ? ACP_AGENTS.find((candidate) => `acp:${candidate.id}` === providerID)
    : undefined
)
const provider = computed(() => AI_PROVIDERS.find((candidate) => candidate.id === providerID))
const keyHint = computed(() => (hasSavedKey ? ai.value.aiSetupSavedKeyHint : undefined))
</script>

<template>
  <section :class="styles.connection()" :data-provider="providerID">
    <h3 :class="styles.connectionHeading()">
      <ProviderLogo :provider="providerID" />
      {{ name }}
    </h3>

    <AgentSetup
      v-if="agent && agentSetup"
      :agent="agent"
      :setup="agentSetup"
      @check="emit('checkAgent')"
      @install-agent="emit('installAgent')"
      @install-bridge="emit('installBridge')"
    />
    <PiSetup
      v-else-if="piSetup"
      :setup="piSetup"
      @check="emit('checkAgent')"
      @install-companion="emit('installAgent')"
      @install-bridge="emit('installBridge')"
    />

    <template v-else>
      <ProviderSettingsKeyField
        :model-value="state.apiKey"
        :label="ai.apiKey"
        :saved="false"
        :hint="keyHint"
        :placeholder="hasSavedKey ? credentials.savedReplace : (provider?.keyPlaceholder ?? '')"
        :key-u-r-l="provider?.keyURL"
        :key-u-r-l-label="credentials.getAPIKey"
        @update:model-value="emit('update', { apiKey: $event })"
      />
      <ProviderConnectionTestButton
        :status="state.test"
        :reason="state.reason"
        :disabled="disabled"
        @test="emit('test')"
      />
    </template>
  </section>
</template>
