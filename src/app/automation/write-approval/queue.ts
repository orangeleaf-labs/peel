import { computed, shallowRef } from 'vue'

import { WRITE_APPROVAL_TIMEOUT_MS } from '@/constants'

import { writeDeniedMessage, type WriteRequest } from './requests'

interface PendingApproval {
  request: WriteRequest
  resolve: (allowed: boolean) => void
  timer: ReturnType<typeof setTimeout>
}

/**
 * Agent calls waiting for the user to allow a write outside the document, oldest first. Each is
 * asked on its own: nothing is remembered between calls, and no answer within
 * `WRITE_APPROVAL_TIMEOUT_MS` counts as Deny.
 */
const queue = shallowRef<PendingApproval[]>([])

/** The request the dialog shows, or null when nothing waits. */
export const currentWriteApproval = computed(() => queue.value.at(0)?.request ?? null)

function settle(entry: PendingApproval, allowed: boolean) {
  clearTimeout(entry.timer)
  queue.value = queue.value.filter((pending) => pending !== entry)
  entry.resolve(allowed)
}

/** Asks the user; resolves true only on Allow. */
export function requestWriteApproval(request: WriteRequest): Promise<boolean> {
  return new Promise((resolve) => {
    const entry: PendingApproval = {
      request,
      resolve,
      timer: setTimeout(() => settle(entry, false), WRITE_APPROVAL_TIMEOUT_MS)
    }
    queue.value = [...queue.value, entry]
  })
}

/** The user's answer to a request; a request already answered or timed out is left alone. */
export function answerWriteApproval(request: WriteRequest, allowed: boolean): void {
  const entry = queue.value.find((pending) => pending.request === request)
  if (entry) settle(entry, allowed)
}

export class WriteDeniedError extends Error {
  constructor(request: WriteRequest) {
    super(writeDeniedMessage(request))
    this.name = 'WriteDeniedError'
  }
}

/** Waits for the user to allow the write; throws `WriteDeniedError` otherwise. */
export async function approveWrite(request: WriteRequest): Promise<void> {
  if (!(await requestWriteApproval(request))) throw new WriteDeniedError(request)
}
