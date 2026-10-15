<script setup lang="ts">
import { tv } from 'tailwind-variants'

import { useI18n } from '@open-pencil/vue'

import { modelProviderName } from '@/app/ai/models/provider-name'
import {
  ONBOARDING_AGENTS,
  ONBOARDING_API_PROVIDERS,
  type OnboardingAccess
} from '@/app/ai/models/settings/onboarding/plan'
import SettingsLink from '@/components/settings/layout/SettingsLink.vue'
import ProviderLogo from '@/components/settings/provider/ProviderLogo.vue'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'
import AppCheckboxCard from '@/components/ui/toggle/AppCheckboxCard.vue'
import { DESKTOP_DOWNLOAD_URL } from '@/constants'
import theme from '@/theme/settings/ai-setup/flow'

const { agentsAvailable } = defineProps<{ agentsAvailable: boolean }>()
const access = defineModel<OnboardingAccess[]>({ required: true })
const { ai } = useI18n()
const styles = tv(theme)()

function toggle(providerID: OnboardingAccess, checked: boolean): void {
  access.value = checked
    ? [...access.value, providerID]
    : access.value.filter((candidate) => candidate !== providerID)
}
</script>

<template>
  <section :class="styles.group()">
    <h3 :class="styles.groupHeading()">{{ ai.aiSetupAccessAgents }}</h3>
    <template v-if="agentsAvailable">
      <p :class="styles.help()">{{ ai.aiSetupAccessAgentsDescription }}</p>
      <AppCheckboxCard
        v-for="agent in ONBOARDING_AGENTS"
        :key="agent"
        :label="modelProviderName(agent)"
        :model-value="access.includes(agent)"
        @update:model-value="toggle(agent, $event)"
      >
        <template #icon><ProviderLogo :provider="agent" /></template>
      </AppCheckboxCard>
    </template>
    <AppAlert v-else :heading="ai.aiSetupAccessAgentsDesktop">
      <template #actions>
        <SettingsLink :href="DESKTOP_DOWNLOAD_URL">{{ ai.aiSetupGetDesktop }}</SettingsLink>
      </template>
    </AppAlert>
  </section>
  <section :class="styles.group()">
    <h3 :class="styles.groupHeading()">{{ ai.aiSetupAccessAPI }}</h3>
    <AppCheckboxCard
      v-for="provider in ONBOARDING_API_PROVIDERS"
      :key="provider"
      :label="modelProviderName(provider)"
      :model-value="access.includes(provider)"
      @update:model-value="toggle(provider, $event)"
    >
      <template #icon><ProviderLogo :provider="provider" /></template>
    </AppCheckboxCard>
  </section>
</template>
