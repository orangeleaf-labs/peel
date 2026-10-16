import { describe, expect, test } from 'bun:test'

import { S3_STORAGE_PROVIDER } from '@/app/integrations/storage/providers'
import {
  StorageEndpointNotApprovedError,
  approveStorageEndpoint
} from '@/app/integrations/storage/s3/approval'

function services(answer: boolean, desktop = true) {
  const requested: string[] = []
  return {
    requested,
    services: {
      desktop: () => desktop,
      request: async (endpoint: string) => {
        requested.push(endpoint)
        return answer
      }
    }
  }
}

describe('approveStorageEndpoint', () => {
  test('asks the desktop shell and resolves once the user allows the endpoint', async () => {
    const f = services(true)
    await approveStorageEndpoint('https://s3.example.com', f.services)
    expect(f.requested).toEqual(['https://s3.example.com'])
  })

  test('rejects with guidance when the user declines', async () => {
    const f = services(false)
    const result = approveStorageEndpoint('https://s3.example.com', f.services)
    await expect(result).rejects.toBeInstanceOf(StorageEndpointNotApprovedError)
    await expect(result).rejects.toThrow('s3.example.com')
  })

  test('surfaces an endpoint the desktop shell refuses outright', async () => {
    const result = approveStorageEndpoint('http://127.0.0.1:9000', {
      desktop: () => true,
      request: () => Promise.reject(new Error('Blocked request: only HTTPS URLs are allowed'))
    })
    await expect(result).rejects.toThrow('only HTTPS')
  })

  test('asks nothing in a browser or for an empty endpoint', async () => {
    const browser = services(false, false)
    await approveStorageEndpoint('https://s3.example.com', browser.services)
    const empty = services(false)
    await approveStorageEndpoint('  ', empty.services)
    expect(browser.requested).toEqual([])
    expect(empty.requested).toEqual([])
  })

  test('the S3 provider approves its endpoint preference', () => {
    expect(S3_STORAGE_PROVIDER.approveEndpoint).toBeFunction()
  })
})
