import { computed } from 'vue'

import { useActiveEditorStoreRef } from '@/app/editor/active-store'
import { useLocalIdentity } from '@/app/identity/use'
import { follow as followAgent, presenceOf, renameAgent } from '@/app/presence/registry'
import type { FollowTarget } from '@/app/presence/types'

import { selfPresenceRow } from './rows'

/**
 * You and every agent you run in the active tab, with following and renaming them. Presence is
 * kept per tab's store, so this reads the active tab's own store rather than the editor proxy.
 */
export function useSelfPresence() {
  const identity = useLocalIdentity()
  const tabStore = useActiveEditorStoreRef()

  const row = computed(() => {
    const store = tabStore.value
    return selfPresenceRow(
      {
        name: identity.name.value,
        color: identity.color,
        agents: store ? presenceOf(store).agents.value : []
      },
      (pageId) => store?.graph.getNode(pageId)?.name
    )
  })
  const following = computed(() =>
    tabStore.value ? presenceOf(tabStore.value).following.value : null
  )

  function follow(target: FollowTarget | null) {
    if (tabStore.value) followAgent(tabStore.value, target)
  }

  function rename(agentId: string, name: string) {
    if (tabStore.value) renameAgent(tabStore.value, agentId, name)
  }

  return { row, following, follow, rename }
}
