<script setup lang="ts">
import { webmcpMode } from '@/app/automation/webmcp/preferences'
import { webmcpRuntime } from '@/app/automation/webmcp/runtime'
import { isTauri } from '@/app/tauri/env'
import SettingsPage from '@/components/settings/layout/SettingsPage.vue'

import MCPSettingsPanel from './MCPSettingsPanel.vue'
import WebMCPSettingsPanel from './WebMCPSettingsPanel.vue'
</script>

<template>
  <div class="flex min-h-0 min-w-0 flex-1 flex-col" data-test-id="settings-mcp-panel">
    <SettingsPage>
      <div class="flex flex-col gap-6">
        <MCPSettingsPanel />
        <!-- WebMCP serves agents built into a browser; the desktop webview has neither the API nor an agent. -->
        <WebMCPSettingsPanel v-if="!isTauri()" v-model="webmcpMode" :state="webmcpRuntime" />
      </div>
    </SettingsPage>
  </div>
</template>
