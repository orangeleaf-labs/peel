<script setup lang="ts">
import { useI18n } from '@open-pencil/vue'

import SettingsLink from '@/components/settings/layout/SettingsLink.vue'
import ProviderSettingsField from '@/components/settings/provider/ProviderSettingsField.vue'
import ProviderSettingsInput from '@/components/settings/provider/ProviderSettingsInput.vue'

const { label, modelValue, saved, placeholder, keyURL, keyURLLabel, inputId, hint, error } =
  defineProps<{
    label: string
    modelValue: string
    saved: boolean
    placeholder: string
    inputId?: string
    keyURL?: string
    keyURLLabel?: string
    hint?: string
    error?: string
  }>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  change: []
  clear: []
  blur: []
}>()

const { common } = useI18n()
</script>

<template>
  <ProviderSettingsField
    :label="label"
    :hint="hint"
    :error="error"
    :label-for="inputId"
    :clear-label="saved ? common.clear : undefined"
    data-test-id="provider-settings-clear-key"
    @clear="emit('clear')"
    @blur="emit('blur')"
  >
    <template #default="{ control }">
      <ProviderSettingsInput
        v-bind="control"
        :model-value="modelValue"
        :aria-label="label"
        type="password"
        data-test-id="provider-settings-api-key"
        :placeholder="placeholder"
        @update:model-value="emit('update:modelValue', String($event))"
        @change="emit('change')"
      />
    </template>
    <template #hint>
      <SettingsLink v-if="keyURL && keyURLLabel" :href="keyURL">
        {{ keyURLLabel }}
      </SettingsLink>
    </template>
  </ProviderSettingsField>
</template>
