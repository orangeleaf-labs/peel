import { AI_PROVIDERS, type AIProviderID } from '@open-pencil/core/constants'

import { appCredentialStore } from '@/app/settings/credentials/app'
import { credentialKey, credentialRef } from '@/app/settings/credentials/reference'
import { browserCredentialStorage } from '@/app/settings/credentials/storage'
import type { CredentialRef, CredentialStore } from '@/app/settings/credentials/types'

const STORAGE_PREFIX = 'open-pencil:'
const MIGRATION_VERSION_KEY = `${STORAGE_PREFIX}credential-migration`
const MIGRATION_VERSION = '1'
const AI_KEY_PREFIX = `${STORAGE_PREFIX}ai-key:`
/** Plaintext keys for providers and integrations Peel removed: deleted, never migrated, so no secret outlives them. */
const REMOVED_PROVIDER_KEYS = [
  `${STORAGE_PREFIX}openrouter-api-key`,
  `${STORAGE_PREFIX}pexels-api-key`,
  `${STORAGE_PREFIX}unsplash-access-key`
]

export function providerCredentialRef(
  providerId: AIProviderID,
  profileId = 'default'
): CredentialRef {
  if (providerId.startsWith('acp:')) {
    throw new Error('ACP agents do not use API-key credentials')
  }
  const integrationId = providerId === 'harness:pi' ? 'harness-pi' : providerId
  return credentialRef(integrationId, 'api-key', profileId)
}

type LegacyCredential = {
  storageKey: string
  reference: CredentialRef
}

type LegacyScan = {
  credentials: LegacyCredential[]
  removedProviderKeys: string[]
}

function scanLegacyCredentials(storage: Storage): LegacyScan {
  const credentials: LegacyCredential[] = []
  const removedProviderKeys = REMOVED_PROVIDER_KEYS.filter((key) => storage.getItem(key) !== null)

  for (let index = 0; index < storage.length; index++) {
    const storageKey = storage.key(index)
    if (!storageKey?.startsWith(AI_KEY_PREFIX)) continue
    const legacyProviderId = storageKey.slice(AI_KEY_PREFIX.length)
    const providerId = AI_PROVIDERS.find((provider) => provider.id === legacyProviderId)?.id
    if (providerId) credentials.push({ storageKey, reference: providerCredentialRef(providerId) })
    else removedProviderKeys.push(storageKey)
  }

  return { credentials, removedProviderKeys }
}

export function hasLegacyCredential(
  reference: CredentialRef,
  storage = browserCredentialStorage()
): boolean {
  if (!storage || storage.getItem(MIGRATION_VERSION_KEY) === MIGRATION_VERSION) return false
  return scanLegacyCredentials(storage).credentials.some(
    (entry) =>
      credentialKey(entry.reference) === credentialKey(reference) &&
      Boolean(storage.getItem(entry.storageKey)?.trim())
  )
}

export async function migrateLegacyCredentials(
  storage: Storage,
  store: CredentialStore
): Promise<boolean> {
  const { credentials, removedProviderKeys } = scanLegacyCredentials(storage)
  for (const storageKey of removedProviderKeys) storage.removeItem(storageKey)
  if (storage.getItem(MIGRATION_VERSION_KEY) === MIGRATION_VERSION) return true
  if ((await store.availability()) !== 'available') return false

  for (const { storageKey, reference } of credentials) {
    const legacyValue = storage.getItem(storageKey)?.trim()
    if (!legacyValue) continue

    const existing = await store.read(reference)
    if (existing === null) await store.write(reference, legacyValue)
    if ((await store.read(reference)) === null) return false
    storage.removeItem(storageKey)
  }

  storage.setItem(MIGRATION_VERSION_KEY, MIGRATION_VERSION)
  return true
}

const migrationsInFlight = new WeakMap<Storage, Promise<boolean>>()
let migrationQueue: Promise<void> = Promise.resolve()

/** Migrations share one destination store, so distinct sources must not interleave. */
function enqueueMigration(storage: Storage): Promise<boolean> {
  const migration = migrationQueue.then(() => migrateLegacyCredentials(storage, appCredentialStore))
  migrationQueue = migration.then(
    () => undefined,
    () => undefined
  )
  return migration
}

export async function initializeCredentialMigration(
  storage = browserCredentialStorage()
): Promise<boolean> {
  if (!storage) return true
  let migration = migrationsInFlight.get(storage)
  if (!migration) {
    migration = enqueueMigration(storage).finally(() => {
      migrationsInFlight.delete(storage)
    })
    migrationsInFlight.set(storage, migration)
  }
  return migration
}
