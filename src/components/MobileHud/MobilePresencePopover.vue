<script setup lang="ts">
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { computed } from 'vue'

import { useCommonMessages } from '@open-pencil/vue'

import HudButton from '@/components/mobile-hud/HudButton.vue'
import PersonAvatar from '@/components/presence/PersonAvatar.vue'
import PresenceList from '@/components/presence/PresenceList.vue'
import { useSelfPresence } from '@/components/presence/useSelfPresence'
import { presencePopover } from '@/theme/mobile/presence-popover'

/** While you run agents, your avatar opens them all, to follow or rename. */
const common = useCommonMessages()
const { row, following, follow, rename } = useSelfPresence()
const styles = presencePopover()
const label = computed(() => `${row.value.name || common.value.you} (${common.value.youSuffix})`)
</script>

<template>
  <PopoverRoot v-if="row.agents.length > 0">
    <PopoverTrigger as-child>
      <HudButton :label="label" data-test-id="mobile-presence" :class="styles.trigger()">
        <PersonAvatar
          :name="row.name || common.you"
          :color="row.color"
          :agent-count="row.agents.length"
        />
      </HudButton>
    </PopoverTrigger>
    <PopoverPortal>
      <PopoverContent
        :modal="false"
        :side-offset="8"
        side="bottom"
        align="center"
        :class="styles.content()"
        @open-auto-focus.prevent
      >
        <PresenceList :rows="[row]" :following="following" @follow="follow" @rename="rename" />
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
