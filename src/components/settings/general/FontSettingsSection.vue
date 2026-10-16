<script setup lang="ts">
import { useFontMessages } from '@open-pencil/vue'

import { onlineFontsEnabled } from '@/app/editor/fonts'
import SettingsGroup from '@/components/settings/layout/SettingsGroup.vue'
import SettingsRow from '@/components/settings/layout/SettingsRow.vue'
import SettingsSection from '@/components/settings/layout/SettingsSection.vue'
import AppSwitch from '@/components/ui/toggle/AppSwitch.vue'

const fonts = useFontMessages()
</script>

<template>
  <SettingsSection>
    <template #title>{{ fonts.onlineFonts }}</template>
    <SettingsGroup>
      <SettingsRow :label="fonts.remoteFonts" :description="fonts.remoteFontsDescription">
        <AppSwitch
          v-model="onlineFontsEnabled"
          :label="fonts.remoteFonts"
          data-test-id="settings-remote-fonts"
        />
      </SettingsRow>
    </SettingsGroup>
  </SettingsSection>
</template>
