<script setup lang="ts">
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'

import { useCommonMessages } from '@open-pencil/vue'

import { selfPresence } from '@/theme/collaboration/self-presence'

import PersonAvatar from './PersonAvatar.vue'
import PresenceList from './PresenceList.vue'
import { useSelfPresence } from './useSelfPresence'

/** Your avatar, with how many agents you run; it opens them all, to follow or rename. */
const common = useCommonMessages()
const { row, following, follow, rename } = useSelfPresence()
const ui = selfPresence()
</script>

<template>
  <PopoverRoot>
    <PopoverTrigger as-child>
      <button
        type="button"
        data-test-id="presence-self-avatar"
        :aria-label="`${row.name || common.you} (${common.youSuffix})`"
        :class="ui.trigger()"
      >
        <PersonAvatar
          :name="row.name || common.you"
          :color="row.color"
          :agent-count="row.agents.length"
          interactive
        />
      </button>
    </PopoverTrigger>
    <PopoverPortal>
      <PopoverContent
        data-test-id="presence-self-menu"
        :class="ui.card()"
        :side-offset="8"
        align="end"
      >
        <PresenceList :rows="[row]" :following="following" @follow="follow" @rename="rename" />
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
