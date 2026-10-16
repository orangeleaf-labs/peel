import { computed, shallowRef } from 'vue'

import { WRITE_APPROVAL_TIMEOUT_MS } from '@/constants'

import { writeDeniedMessage, type WriteRequest } from './requests'

export interface WriteApprovalOptions {
  /**
   * Whoever asked, such as a chat reply or an agent chat, so its requests can be withdrawn when it
   * stops. Compared by identity.
   */
  owner?: unknown
  /**
   * When the request is denied whatever the dialog shows, as `Date.now()` time. Automation calls
   * set it from when the app received them, so an Allow never lands after the caller gave up.
   * Without one, the request gets `WRITE_APPROVAL_TIMEOUT_MS` once it reaches the dialog.
   */
  deadline?: number
}

interface PendingApproval {
  request: WriteRequest
  owner: unknown
  deadline: number | undefined
  resolve: (allowed: boolean) => void
  timer: ReturnType<typeof setTimeout> | undefined
}

/**
 * Agent calls waiting for the user to allow a write outside the document, oldest first. Each is
 * asked on its own: nothing is remembered between calls, and no answer in time counts as Deny.
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

/** Asks the user; resolves true only on Allow in time. */
export function requestWriteApproval(
  request: WriteRequest,
  { owner, deadline }: WriteApprovalOptions = {}
): Promise<boolean> {
  return new Promise((resolve) => {
    const entry: PendingApproval = { request, owner, deadline, resolve, timer: undefined }
    // A deadline holds wherever the request waits in the queue.
    if (deadline !== undefined) {
      entry.timer = setTimeout(() => settle(entry, false), Math.max(0, deadline - Date.now()))
    }
    queue.value = [...queue.value, entry]
    startHeadTimer()
  })
}

/** The user's answer to a request; one already answered, withdrawn or past its deadline is left alone. */
export function answerWriteApproval(request: WriteRequest, allowed: boolean): void {
  const entry = queue.value.find((pending) => pending.request === request)
  if (!entry) return
  const late = entry.deadline !== undefined && Date.now() >= entry.deadline
  settle(entry, allowed && !late)
}

/**
 * Denies the requests `owner` made, or every waiting request without one, so a stopped reply
 * leaves no dialog in front of the writes queued behind it.
 */
export function denyWriteApprovals(owner?: unknown): void {
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
export async function approveWrite(
  request: WriteRequest,
  options?: WriteApprovalOptions
): Promise<void> {
  if (!(await requestWriteApproval(request, options))) throw new WriteDeniedError(request)
}
