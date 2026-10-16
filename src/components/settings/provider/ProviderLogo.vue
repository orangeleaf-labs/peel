<script setup lang="ts">
import type { Component } from 'vue'
import { computed } from 'vue'
import IconAnthropic from '~icons/ai/anthropic'
import IconClaudeCode from '~icons/ai/claudecode'
import IconCodex from '~icons/ai/codex'
import IconGeminiCLI from '~icons/ai/geminicli'
import IconBot from '~icons/lucide/bot'
import IconServer from '~icons/lucide/server'

/** A provider or agent. */
const { provider } = defineProps<{ provider: string }>()

const LOGOS: Record<string, Component> = {
  anthropic: IconAnthropic,
  'acp:claude-code': IconClaudeCode,
  'acp:codex': IconCodex,
  'acp:gemini-cli': IconGeminiCLI,
  'harness:pi': IconBot
}

const logo = computed(() => LOGOS[provider] ?? IconServer)
</script>

<template>
  <component :is="logo" class="size-4 shrink-0" aria-hidden="true" data-slot="provider-logo" />
</template>
