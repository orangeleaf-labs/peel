import { computed, shallowRef } from 'vue'

import { WRITE_APPROVAL_TIMEOUT_MS } from '@/constants'

import { writeDeniedMessage, type WriteRequest } from './requests'

interface PendingApproval {
  request: WriteRequest
  /** Whoever asked, such as a chat reply, so its requests can be withdrawn when it stops. */
  owner: object | undefined
  resolve: (allowed: boolean) => void
  /** Set once the request is on screen, so each one gets the whole timeout in front of the user. */
  timer: ReturnType<typeof setTimeout> | undefined
}

/**
 * Agent calls waiting for the user to allow a write outside the document, oldest first. Each is
 * asked on its own: nothing is remembered between calls, and no answer within
 * `WRITE_APPROVAL_TIMEOUT_MS` of a request reaching the dialog counts as Deny.
 */
const queue = shallowRef<PendingApproval[]>([])

/** The request the dialog shows, or null when nothing waits. */
export const currentWriteApproval = computed(() => queue.value.at(0)?.request ?? null)

/** Starts the timeout of the request the dialog shows, once it gets there. */
function startHeadTimer() {
  const head = queue.value.at(0)
  if (!head || head.timer !== undefined) return
  head.timer = setTimeout(() => settle(head, false), WRITE_APPROVAL_TIMEOUT_MS)
}

function settle(entry: PendingApproval, allowed: boolean) {
  clearTimeout(entry.timer)
  queue.value = queue.value.filter((pending) => pending !== entry)
  entry.resolve(allowed)
  startHeadTimer()
}

/** Asks the user; resolves true only on Allow. */
export function requestWriteApproval(request: WriteRequest, owner?: object): Promise<boolean> {
  return new Promise((resolve) => {
    const entry: PendingApproval = {
      request,
      owner,
      resolve,
      timer: undefined
    }
    queue.value = [...queue.value, entry]
    startHeadTimer()
  })
}

/** The user's answer to a request; a request already answered or timed out is left alone. */
export function answerWriteApproval(request: WriteRequest, allowed: boolean): void {
  const entry = queue.value.find((pending) => pending.request === request)
  if (entry) settle(entry, allowed)
}

/**
 * Denies the requests `owner` made, or every waiting request without one, so a stopped reply
 * leaves no dialog in front of the writes queued behind it.
 */
export function denyWriteApprovals(owner?: object): void {
  for (const entry of queue.value) {
    if (owner === undefined || entry.owner === owner) settle(entry, false)
  }
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
