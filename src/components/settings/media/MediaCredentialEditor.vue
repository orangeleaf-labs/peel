<script setup lang="ts">
import { computed } from 'vue'

import {
  useCommonMessages,
  useCredentialMessages,
  useMediaMessages,
  useSettingsMessages
} from '@open-pencil/vue'

import { useMediaSettingsEditor } from '@/app/settings/media/use'
import { useSettingsFormGuard } from '@/app/settings/navigation/use'
import SettingsPage from '@/components/settings/layout/SettingsPage.vue'
import SettingsSaveFeedback from '@/components/settings/layout/SettingsSaveFeedback.vue'
import SettingsSection from '@/components/settings/layout/SettingsSection.vue'
import ProviderSettingsKeyField from '@/components/settings/provider/ProviderSettingsKeyField.vue'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppSelect from '@/components/ui/select/AppSelect.vue'

const emit = defineEmits<{ done: [] }>()
const editor = useMediaSettingsEditor()
const { key, providerID, keyStatus, error, dirty, busy, clearCredential } = editor
useSettingsFormGuard({ dirty, busy, cancel: () => emit('done') })
const common = useCommonMessages()
const credentials = useCredentialMessages()
const media = useMediaMessages()
const settings = useSettingsMessages()
const provider = computed(() => editor.vector.provider.value)
const providerOptions = editor.vector.providerOptions
const placeholder = computed(() => {
  if (keyStatus.value === 'configured') return credentials.value.savedReplace
  return provider.value?.keyPlaceholder ?? ''
})
async function save() {
  if (await editor.save()) emit('done')
}
</script>

<template>
  <form class="flex min-h-0 min-w-0 flex-1 flex-col" :aria-busy="busy" @submit.prevent="save">
    <SettingsPage>
      <SettingsSection class="gap-5">
        <template #title>{{ media.vectorization }}</template>
        <fieldset :disabled="busy" class="flex w-full min-w-0 max-w-md flex-col gap-5">
          <label class="flex flex-col gap-1.5 text-xs text-surface">
            {{ media.vectorizeProvider }}
            <AppSelect
              v-model="providerID"
              :options="providerOptions"
              :label="media.vectorizeProvider"
              :disabled="busy"
            />
          </label>
          <ProviderSettingsKeyField
            v-model="key"
            :label="credentials.apiKey"
            :saved="keyStatus === 'configured'"
            :hint="
              keyStatus === 'configured'
                ? settings.savedCredentialHint
                : settings.optionalCredentialHint
            "
            :placeholder="placeholder"
            :key-u-r-l="provider?.keyURL"
            :key-u-r-l-label="credentials.getAPIKey"
            @clear="clearCredential"
          />
        </fieldset>
        <SettingsSaveFeedback :error="error" />
      </SettingsSection>
      <template #footer>
        <AppButton :disabled="busy" @click="emit('done')">{{ common.cancel }}</AppButton>
        <AppButton type="submit" color="primary" variant="solid" :loading="busy">{{
          common.save
        }}</AppButton>
      </template>
    </SettingsPage>
  </form>
</template>
