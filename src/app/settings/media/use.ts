import { tryOnScopeDispose } from '@vueuse/core'
import { computed, ref } from 'vue'

import {
  pexelsKeyStatus,
  setPexelsKey,
  unsplashKeyStatus,
  setUnsplashKey
} from '@/app/settings/credentials/media'

export type MediaSettingsService = 'pexels' | 'unsplash'

const stockServices = {
  pexels: { status: pexelsKeyStatus, set: setPexelsKey },
  unsplash: { status: unsplashKeyStatus, set: setUnsplashKey }
}

export function useMediaSettingsEditor(service: MediaSettingsService, services = stockServices) {
  const key = ref('')
  const removeKey = ref(false)
  const busy = ref(false)
  const saveError = ref('')
  let disposed = false
  tryOnScopeDispose(() => {
    disposed = true
    key.value = ''
  })

  const keyStatus = computed(() => (removeKey.value ? 'missing' : services[service].status.value))
  const error = computed(() => saveError.value)
  const dirty = computed(() => key.value.length > 0 || removeKey.value)

  function clearCredential() {
    if (busy.value) return
    key.value = ''
    removeKey.value = true
  }

  function isDisposed() {
    return disposed
  }

  async function save(): Promise<boolean> {
    if (busy.value || isDisposed()) return false
    busy.value = true
    saveError.value = ''
    try {
      if (key.value.trim() || removeKey.value) await services[service].set(key.value.trim())
      return !isDisposed()
    } catch (cause) {
      if (!isDisposed()) saveError.value = cause instanceof Error ? cause.message : String(cause)
      return false
    } finally {
      busy.value = false
    }
  }

  return { key, keyStatus, error, dirty, busy, clearCredential, save }
}
