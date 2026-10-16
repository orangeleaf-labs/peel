<script setup lang="ts">
import { computed } from 'vue'

import { AI_PROVIDERS, type AIProviderID } from '@open-pencil/core/constants'

import AppSelect from '@/components/ui/select/AppSelect.vue'
import type { AppSelectGroup } from '@/components/ui/select/select'

interface ProviderSelectProps {
  ui?: {
    trigger?: string
    content?: string
    item?: string
    label?: string
    separator?: string
  }
}

const { ui } = defineProps<ProviderSelectProps>()

const providerID = defineModel<AIProviderID>({ required: true })
const displayName = computed(
  () => (AI_PROVIDERS.find((provider) => provider.id === providerID.value) ?? AI_PROVIDERS[0]).name
)

const groups = computed<AppSelectGroup<string>[]>(() => [
  {
    options: [...AI_PROVIDERS]
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((provider) => ({ value: provider.id, label: provider.name }))
  }
])
</script>

<template>
  <AppSelect v-model="providerID" :groups="groups" :placeholder="displayName" :ui="ui" />
</template>
