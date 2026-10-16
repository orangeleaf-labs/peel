<script setup lang="ts">
import type { Component } from 'vue'
import { computed } from 'vue'
import IconAnthropic from '~icons/ai/anthropic'
import IconServer from '~icons/lucide/server'

/** A model provider. */
const { provider } = defineProps<{ provider: string }>()

const LOGOS: Record<string, Component> = {
  anthropic: IconAnthropic
}

const logo = computed(() => LOGOS[provider] ?? IconServer)
</script>

<template>
  <component :is="logo" class="size-4 shrink-0" aria-hidden="true" data-slot="provider-logo" />
</template>
