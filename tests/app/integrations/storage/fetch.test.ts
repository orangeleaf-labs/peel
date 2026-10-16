import { afterEach, expect, test } from 'bun:test'

import { isLikelyCORSOrNetworkError } from '@/app/integrations/storage/s3/cors'
import { storageFetch } from '@/app/integrations/storage/s3/fetch'

import { clearTauriMocks, mockTauriIPC } from '#tests/helpers/tauri/mocks'

afterEach(clearTauriMocks)

test('a storage endpoint the desktop proxy refused says custom endpoints are not allowed yet', async () => {
  // Tauri rejects invoke() with the command's serialized error, not an Error.
  await mockTauriIPC(() => {
    const refusal = Promise.withResolvers<never>()
    refusal.reject({
      network: false,
      blocked: true,
      message: 'Blocked request: s3.example.com is not an allowed host'
    })
    return refusal.promise
  })

  const error = await storageFetch('https://s3.example.com/bucket/key').catch(
    (reason: unknown) => reason
  )

  expect(error).toBeInstanceOf(Error)
  expect(error).toHaveProperty('message', expect.stringContaining('s3.example.com'))
  expect(error).toHaveProperty(
    'message',
    expect.stringContaining('Custom storage endpoints are not allowed')
  )
  // Not shown as a CORS or network problem, which a bucket setting could fix.
  expect(isLikelyCORSOrNetworkError(error)).toBe(false)
})
