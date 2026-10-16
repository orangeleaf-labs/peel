import { tryOnScopeDispose } from '@vueuse/core'
import { computed, ref, watch } from 'vue'

import { vectorizeProviderID } from '@/app/editor/vectorize'
import { useVectorizeSettings } from '@/app/editor/vectorize/settings/use'

export type MediaSettingsService = 'vectorize'

/** Edits the vectorization provider and its key; the only media service with settings. */
export function useMediaSettingsEditor() {
  const key = ref('')
  const providerID = ref(vectorizeProviderID.value)
  const initialProvider = providerID.value
  const removeKey = ref(false)
  const busy = ref(false)
  const saveError = ref('')
  const vector = useVectorizeSettings(key, providerID)
  let disposed = false
  tryOnScopeDispose(() => {
    disposed = true
    key.value = ''
  })
  watch(
    providerID,
    () => {
      removeKey.value = false
    },
    { flush: 'sync' }
  )

  const keyStatus = computed(() => {
    if (removeKey.value) return 'missing'
    return vector.keyStatus.value
  })
  const error = computed(() => saveError.value || vector.error.value || '')
  const dirty = computed(
    () => key.value.length > 0 || removeKey.value || providerID.value !== initialProvider
  )

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
      const saved =
        removeKey.value && !key.value.trim()
          ? await vector.clearCredential()
          : await vector.saveCredential()
      if (!saved || isDisposed()) return false
      vectorizeProviderID.value = providerID.value
      return !isDisposed()
    } catch (cause) {
      if (!isDisposed()) saveError.value = cause instanceof Error ? cause.message : String(cause)
      return false
    } finally {
      busy.value = false
    }
  }

  return { key, providerID, vector, keyStatus, error, dirty, busy, clearCredential, save }
}
