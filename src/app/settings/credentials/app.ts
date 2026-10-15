import { ref } from 'vue'

import { IS_TAURI } from '@open-pencil/core/constants'

import { BrowserCredentialStore } from '@/app/settings/credentials/browser'
import { MemoryCredentialStore } from '@/app/settings/credentials/memory'
import { NativeCredentialStore } from '@/app/settings/credentials/native'
import { createCredentialServices } from '@/app/settings/credentials/services'
import {
  browserRemembersCredentials,
  hasLegacyCredentialStorage,
  setBrowserRemembersCredentials
} from '@/app/settings/credentials/storage'
import { SwitchableCredentialStore } from '@/app/settings/credentials/switchable'
import type { CredentialRef, CredentialStore } from '@/app/settings/credentials/types'

const legacyCredentialsPresent = hasLegacyCredentialStorage()
if (legacyCredentialsPresent) setBrowserRemembersCredentials(true)

export const browserCredentialsRemembered = ref(
  !IS_TAURI && (browserRemembersCredentials() || legacyCredentialsPresent)
)

/**
 * The store secrets start in: the desktop app always uses the system credential store
 * (Keychain on macOS, Credential Manager on Windows), with no browser or plaintext fallback.
 */
export function initialCredentialStore(options: {
  desktop: boolean
  remembered: boolean
}): CredentialStore {
  if (options.desktop) return new NativeCredentialStore()
  if (options.remembered) return new BrowserCredentialStore()
  return new MemoryCredentialStore()
}

export const appCredentialStore = new SwitchableCredentialStore(
  initialCredentialStore({ desktop: IS_TAURI, remembered: browserCredentialsRemembered.value })
)
export const appCredentialServices = createCredentialServices(appCredentialStore)

export async function setBrowserCredentialPersistence(
  remembered: boolean,
  references: CredentialRef[]
): Promise<void> {
  if (IS_TAURI) return

  const next = remembered ? new BrowserCredentialStore() : new MemoryCredentialStore()
  await appCredentialStore.switchTo(next, references, { clearPrevious: !remembered })

  browserCredentialsRemembered.value = remembered
  setBrowserRemembersCredentials(remembered)
}
