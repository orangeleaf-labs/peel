<script setup lang="ts">
import { tv } from 'tailwind-variants'
import { computed } from 'vue'

import { AI_PROVIDERS } from '@open-pencil/core/constants'
import { useI18n } from '@open-pencil/vue'

import { modelProviderName } from '@/app/ai/models/provider-name'
import type {
  OnboardingConnectionPatch,
  OnboardingConnectionState
} from '@/app/ai/models/settings/onboarding/connections'
import type { OnboardingAccess } from '@/app/ai/models/settings/onboarding/plan'
import ProviderConnectionTestButton from '@/components/settings/provider/ProviderConnectionTestButton.vue'
import ProviderLogo from '@/components/settings/provider/ProviderLogo.vue'
import ProviderSettingsKeyField from '@/components/settings/provider/ProviderSettingsKeyField.vue'
import theme from '@/theme/settings/ai-setup/flow'

const {
  providerID,
  state,
  hasSavedKey = false,
  disabled = false
} = defineProps<{
  providerID: OnboardingAccess
  state: OnboardingConnectionState
  /** A key saved for the connection that matches what is entered now. */
  hasSavedKey?: boolean
  disabled?: boolean
}>()
const emit = defineEmits<{
  update: [patch: OnboardingConnectionPatch]
  test: []
}>()
const { ai, credentials } = useI18n()
const styles = tv(theme)()

const name = computed(() => modelProviderName(providerID))
const provider = computed(() => AI_PROVIDERS.find((candidate) => candidate.id === providerID))
const keyHint = computed(() => (hasSavedKey ? ai.value.aiSetupSavedKeyHint : undefined))
</script>

<template>
  <section :class="styles.connection()" :data-provider="providerID">
    <h3 :class="styles.connectionHeading()">
      <ProviderLogo :provider="providerID" />
      {{ name }}
    </h3>

    <ProviderSettingsKeyField
      :model-value="state.apiKey"
      :label="ai.apiKey"
      :saved="false"
      :hint="keyHint"
      kind="api"
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
  </section>
</template>
