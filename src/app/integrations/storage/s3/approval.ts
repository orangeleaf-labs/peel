import { isTauri } from '@/app/tauri/env'

/** What approving an endpoint needs; the defaults reach the desktop shell. */
export interface StorageEndpointApprovalServices {
  desktop: () => boolean
  /** Resolves whether the user let the desktop app connect to the endpoint. */
  request: (endpoint: string) => Promise<boolean>
}

async function requestNativeApproval(endpoint: string): Promise<boolean> {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<boolean>('approve_storage_endpoint', { endpoint })
}

const defaultServices: StorageEndpointApprovalServices = {
  desktop: isTauri,
  request: requestNativeApproval
}

export class StorageEndpointNotApprovedError extends Error {
  constructor(endpoint: string) {
    super(
      `Cloud storage was not allowed to connect to ${endpoint}. ` +
        'Save the storage settings again and choose Allow to use this endpoint.'
    )
    this.name = 'StorageEndpointNotApprovedError'
  }
}

/**
 * Before the first request to a storage endpoint, asks the user in a native dialog to let the
 * desktop app connect to it; the desktop proxy refuses hosts nobody approved. Already approved
 * endpoints resolve without asking. Browsers reach storage through `fetch`, bound by CORS and the
 * page's CSP, so there is nothing to approve there.
 */
export async function approveStorageEndpoint(
  endpoint: string | undefined,
  services: StorageEndpointApprovalServices = defaultServices
): Promise<void> {
  const value = endpoint?.trim() ?? ''
  if (!services.desktop() || value === '') return
  if (!(await services.request(value))) throw new StorageEndpointNotApprovedError(value)
}
