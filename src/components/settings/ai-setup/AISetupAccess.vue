<script setup lang="ts">
import { tv } from 'tailwind-variants'

import { useI18n } from '@open-pencil/vue'

import { modelProviderName } from '@/app/ai/models/provider-name'
import {
  ONBOARDING_API_PROVIDERS,
  type OnboardingAccess
} from '@/app/ai/models/settings/onboarding/plan'
import ProviderLogo from '@/components/settings/provider/ProviderLogo.vue'
import AppCheckboxCard from '@/components/ui/toggle/AppCheckboxCard.vue'
import theme from '@/theme/settings/ai-setup/flow'

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
