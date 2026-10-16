import { createGlobalState, useLocalStorage } from '@vueuse/core'
import { computed } from 'vue'

import type { Color } from '@open-pencil/scene-graph/primitives'
import { randomIndex } from '@open-pencil/scene-graph/random'

import { generateGuestName } from '@/app/identity/guest-name'
import { PEER_COLORS } from '@/constants'

/** Kept under the upstream key so a name set before collaboration was removed still applies. */
export const LOCAL_NAME_STORAGE_KEY = 'op-collab-name'

/**
 * Who this person is in this app: one name, kept across sessions, that authors their comments
 * and is `figma.currentUser`, and one color for this session. Until they set a name they are a
 * generated one, such as "Teal Fox".
 */
export const useLocalIdentity = createGlobalState(() => {
  const storedName = useLocalStorage(LOCAL_NAME_STORAGE_KEY, '')
  const guestName = generateGuestName()
  const color: Color = PEER_COLORS[randomIndex(PEER_COLORS.length)] ?? PEER_COLORS[0]
  const name = computed(() => storedName.value.trim() || guestName)
  const hasChosenName = computed(() => storedName.value.trim().length > 0)

  function setName(next: string) {
    storedName.value = next.trim()
  }

  return { name, color, hasChosenName, setName }
})
