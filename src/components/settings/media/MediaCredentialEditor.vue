<script setup lang="ts">
import { computed } from 'vue'

import { useCommonMessages, useCredentialMessages, useSettingsMessages } from '@open-pencil/vue'

import { useMediaSettingsEditor, type MediaSettingsService } from '@/app/settings/media/use'
import { useSettingsFormGuard } from '@/app/settings/navigation/use'
import SettingsPage from '@/components/settings/layout/SettingsPage.vue'
import SettingsSaveFeedback from '@/components/settings/layout/SettingsSaveFeedback.vue'
import SettingsSection from '@/components/settings/layout/SettingsSection.vue'
import ProviderSettingsKeyField from '@/components/settings/provider/ProviderSettingsKeyField.vue'
import AppButton from '@/components/ui/button/AppButton.vue'

const { service } = defineProps<{ service: MediaSettingsService }>()
const emit = defineEmits<{ done: [] }>()
const editor = useMediaSettingsEditor(service)
const { key, keyStatus, error, dirty, busy, clearCredential } = editor
useSettingsFormGuard({ dirty, busy, cancel: () => emit('done') })
const common = useCommonMessages()
const credentials = useCredentialMessages()
const settings = useSettingsMessages()
const title = service === 'pexels' ? 'Pexels' : 'Unsplash'
const keyLabel = computed(() =>
  service === 'unsplash' ? credentials.value.accessKey : credentials.value.apiKey
)
const keyURL =
  service === 'pexels' ? 'https://www.pexels.com/api/' : 'https://unsplash.com/oauth/applications'
const placeholder = computed(() =>
  keyStatus.value === 'configured' ? credentials.value.savedReplace : ''
)
async function save() {
  if (await editor.save()) emit('done')
}
</script>

<template>
  <form class="flex min-h-0 min-w-0 flex-1 flex-col" :aria-busy="busy" @submit.prevent="save">
    <SettingsPage>
      <SettingsSection class="gap-5">
        <template #title>{{ title }}</template>
        <fieldset :disabled="busy" class="flex w-full min-w-0 max-w-md flex-col gap-5">
          <ProviderSettingsKeyField
            v-model="key"
            :label="keyLabel"
            :saved="keyStatus === 'configured'"
            :hint="
              keyStatus === 'configured'
                ? settings.savedCredentialHint
                : settings.optionalCredentialHint
            "
            kind="api"
            :placeholder="placeholder"
            :key-u-r-l="keyURL"
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
