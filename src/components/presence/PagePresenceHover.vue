<script setup lang="ts">
import { HoverCardContent, HoverCardPortal, HoverCardRoot, HoverCardTrigger } from 'reka-ui'
import { computed } from 'vue'

import { useCollaborationMessages } from '@open-pencil/vue'

import { useActiveEditorStoreRef } from '@/app/editor/active-store'
import { useLocalIdentity } from '@/app/identity/use'
import { follow, presenceOf } from '@/app/presence/registry'
import type { FollowTarget } from '@/app/presence/types'
import { pagePresence } from '@/theme/collaboration/page-presence'

import AvatarStack from './AvatarStack.vue'
import PresenceList from './PresenceList.vue'
import { pagePresenceRows } from './rows'

/**
 * Wraps a page in a page list: hovering it shows which of your agents work on that page and what
 * they are doing there, and lets you follow them.
 */
const { pageId } = defineProps<{ pageId: string }>()

const identity = useLocalIdentity()
const messages = useCollaborationMessages()
const tabStore = useActiveEditorStoreRef()
const ui = pagePresence()

const people = computed(() => {
  const store = tabStore.value
  if (!store) return []
  return pagePresenceRows(
    { name: identity.name.value, color: identity.color, agents: presenceOf(store).agents.value },
    pageId
  )
})
const following = computed(() =>
  tabStore.value ? presenceOf(tabStore.value).following.value : null
)

function followTarget(target: FollowTarget | null) {
  if (tabStore.value) follow(tabStore.value, target)
}
</script>

<template>
  <HoverCardRoot v-if="people.length > 0" :open-delay="350" :close-delay="150">
    <HoverCardTrigger as-child>
      <slot />
    </HoverCardTrigger>
    <HoverCardPortal>
      <HoverCardContent
        data-test-id="page-presence-card"
        :class="ui.card()"
        side="right"
        align="start"
        :side-offset="8"
      >
        <div :class="ui.header()">
          <AvatarStack :people="people" size="md" />
          <span :class="ui.title()">{{ messages.onThisPage }}</span>
        </div>
        <PresenceList :rows="people" :following="following" @follow="followTarget" />
      </HoverCardContent>
    </HoverCardPortal>
  </HoverCardRoot>
  <slot v-else />
</template>
