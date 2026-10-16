import { describe, expect, test } from 'bun:test'

import { MemoryCredentialStore } from '@/app/settings/credentials/memory'
import {
  hasLegacyCredential,
  initializeCredentialMigration,
  migrateLegacyCredentials,
  providerCredentialRef
} from '@/app/settings/credentials/migration'
import type {
  CredentialRef,
  CredentialStore,
  CredentialStoreAvailability
} from '@/app/settings/credentials/types'

class TestStorage implements Storage {
  readonly #values = new Map<string, string>()

  get length(): number {
    return this.#values.size
  }

  clear(): void {
    this.#values.clear()
  }

  getItem(key: string): string | null {
    return this.#values.get(key) ?? null
  }

  key(index: number): string | null {
    return [...this.#values.keys()][index] ?? null
  }

  removeItem(key: string): void {
    this.#values.delete(key)
  }

  setItem(key: string, value: string): void {
    this.#values.set(key, value)
  }
}

class UnavailableCredentialStore implements CredentialStore {
  readonly backend = 'memory' as const
  readonly #delegate = new MemoryCredentialStore()

  async availability(): Promise<CredentialStoreAvailability> {
    return 'unavailable'
  }

  status(reference: CredentialRef) {
    return this.#delegate.status(reference)
  }

  read(reference: CredentialRef) {
    return this.#delegate.read(reference)
  }

  write(reference: CredentialRef, value: string) {
    return this.#delegate.write(reference, value)
  }

  remove(reference: CredentialRef) {
    return this.#delegate.remove(reference)
  }
}

class CountingStorage extends TestStorage {
  scans = 0

  override key(index: number): string | null {
    this.scans++
    return super.key(index)
  }
}

describe('legacy credential migration', () => {
  test('recognizes pending credentials without migrating or removing them', () => {
    const storage = new TestStorage()
    storage.setItem('open-pencil:ai-key:anthropic', 'pending-key')
    expect(hasLegacyCredential(providerCredentialRef('anthropic'), storage)).toBe(true)
    expect(
      hasLegacyCredential(providerCredentialRef('anthropic', 'another-profile'), storage)
    ).toBe(false)
    expect(storage.getItem('open-pencil:ai-key:anthropic')).toBe('pending-key')
    storage.setItem('open-pencil:credential-migration', '1')
    expect(hasLegacyCredential(providerCredentialRef('anthropic'), storage)).toBe(false)
  })

  test('concurrent migrations share one in-flight run', async () => {
    const storage = new CountingStorage()
    storage.setItem('open-pencil:openrouter-api-key', 'legacy-openrouter-key')

    await Promise.all([
      initializeCredentialMigration(storage),
      initializeCredentialMigration(storage)
    ])

    expect(storage.scans).toBe(storage.length)
    expect(storage.getItem('open-pencil:openrouter-api-key')).toBeNull()
  })

  test('concurrent migrations of distinct sources both complete', async () => {
    const legacyStorage = new TestStorage()
    const providerStorage = new TestStorage()
    legacyStorage.setItem('open-pencil:openrouter-api-key', 'legacy-openrouter-key')
    providerStorage.setItem('open-pencil:ai-key:anthropic', 'legacy-anthropic-key')

    const results = await Promise.all([
      initializeCredentialMigration(legacyStorage),
      initializeCredentialMigration(providerStorage)
    ])

    expect(results).toEqual([true, true])
    expect(legacyStorage.getItem('open-pencil:openrouter-api-key')).toBeNull()
    expect(providerStorage.getItem('open-pencil:ai-key:anthropic')).toBeNull()
  })

  test('verifies encrypted destinations before removing plaintext keys', async () => {
    const storage = new TestStorage()
    const store = new MemoryCredentialStore()
    storage.setItem('open-pencil:ai-key:anthropic', 'anthropic-key')

    expect(await migrateLegacyCredentials(storage, store)).toBeTrue()
    expect(await store.read(providerCredentialRef('anthropic'))).toBe('anthropic-key')
    expect(storage.getItem('open-pencil:ai-key:anthropic')).toBeNull()
  })

  test('deletes plaintext keys for removed providers without migrating them', async () => {
    for (const migrated of [false, true]) {
      const storage = new TestStorage()
      const store = new MemoryCredentialStore()
      if (migrated) storage.setItem('open-pencil:credential-migration', '1')
      storage.setItem('open-pencil:openrouter-api-key', 'openrouter-key')
      storage.setItem('open-pencil:ai-key:openai', 'openai-key')
      storage.setItem('open-pencil:ai-key:anthropic', 'anthropic-key')

      expect(await migrateLegacyCredentials(storage, store)).toBeTrue()
      expect(storage.getItem('open-pencil:openrouter-api-key')).toBeNull()
      expect(storage.getItem('open-pencil:ai-key:openai')).toBeNull()
      expect(await store.read(providerCredentialRef('anthropic'))).toBe(
        migrated ? null : 'anthropic-key'
      )
    }
  })

  test('retains plaintext when the destination is unavailable', async () => {
    const storage = new TestStorage()
    storage.setItem('open-pencil:ai-key:anthropic', 'keep-me')

    expect(await migrateLegacyCredentials(storage, new UnavailableCredentialStore())).toBeFalse()
    expect(storage.getItem('open-pencil:ai-key:anthropic')).toBe('keep-me')
  })

  test('clearing after migration removes a legacy-only credential for good', async () => {
    const storage = new TestStorage()
    const store = new MemoryCredentialStore()
    storage.setItem('open-pencil:ai-key:anthropic', 'legacy-anthropic-key')

    expect(await migrateLegacyCredentials(storage, store)).toBeTrue()
    await store.remove(providerCredentialRef('anthropic'))

    expect(hasLegacyCredential(providerCredentialRef('anthropic'), storage)).toBeFalse()
    expect(await store.read(providerCredentialRef('anthropic'))).toBeNull()
  })
})
