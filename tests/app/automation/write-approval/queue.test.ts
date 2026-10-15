import { afterEach, expect, jest, test } from 'bun:test'

import {
  answerWriteApproval,
  approveWrite,
  currentWriteApproval,
  denyWriteApprovals,
  requestWriteApproval,
  WriteDeniedError
} from '@/app/automation/write-approval'
import { WRITE_APPROVAL_TIMEOUT_MS } from '@/constants'

import { answerNextWriteApproval } from '#tests/helpers/write-approval'

const save = { tool: 'save_file', kind: 'save', target: '/tmp/a.fig' } as const
const settings = { tool: 'update_settings', kind: 'settings', target: 'appearance.theme' } as const

afterEach(() => {
  // A request a failed test left waiting must not stand in front of the next test's.
  denyWriteApprovals()
})

test('requests wait for an answer, one at a time, oldest first', async () => {
  const first = requestWriteApproval(save)
  const second = requestWriteApproval(settings)
  expect(currentWriteApproval.value).toBe(save)

  // An answer to a request that is not waiting changes nothing.
  answerWriteApproval({ ...save }, true)
  expect(currentWriteApproval.value).toBe(save)

  answerWriteApproval(save, true)
  expect(await first).toBe(true)
  expect(currentWriteApproval.value).toBe(settings)
  answerWriteApproval(settings, false)
  expect(await second).toBe(false)
  expect(currentWriteApproval.value).toBeNull()
})

test('approveWrite throws on Deny, naming the tool and target', async () => {
  const denied = approveWrite(save)
  await answerNextWriteApproval(false)
  const error = await denied.catch((caught: unknown) => caught)
  expect(error).toBeInstanceOf(WriteDeniedError)
  expect(String(error)).toContain('save_file')
  expect(String(error)).toContain('/tmp/a.fig')
  expect(String(error)).toContain('nothing was changed')

  const allowed = approveWrite(save)
  await answerNextWriteApproval(true)
  expect(await allowed).toBeUndefined()
})

test('a request no one answers is denied once the timeout passes', async () => {
  jest.useFakeTimers()
  try {
    const pending = requestWriteApproval(save)
    jest.advanceTimersByTime(WRITE_APPROVAL_TIMEOUT_MS - 1)
    expect(currentWriteApproval.value).toBe(save)
    jest.advanceTimersByTime(1)
    expect(await pending).toBe(false)
    expect(currentWriteApproval.value).toBeNull()
  } finally {
    jest.useRealTimers()
  }
})

test('denyWriteApprovals withdraws only the requests its owner made', async () => {
  const reply = {}
  const fromReply = requestWriteApproval(save, { owner: reply })
  const fromAutomation = requestWriteApproval(settings)
  denyWriteApprovals(reply)
  expect(await fromReply).toBe(false)
  expect(currentWriteApproval.value).toBe(settings)

  denyWriteApprovals()
  expect(await fromAutomation).toBe(false)
  expect(currentWriteApproval.value).toBeNull()
})

test('a queued request gets the whole timeout once it reaches the dialog', async () => {
  jest.useFakeTimers()
  try {
    const first = requestWriteApproval(save)
    const second = requestWriteApproval(settings)
    jest.advanceTimersByTime(WRITE_APPROVAL_TIMEOUT_MS - 1)
    answerWriteApproval(save, true)
    expect(await first).toBe(true)

    // Waiting behind the first request did not use up the second one's time.
    expect(currentWriteApproval.value).toBe(settings)
    jest.advanceTimersByTime(WRITE_APPROVAL_TIMEOUT_MS - 1)
    expect(currentWriteApproval.value).toBe(settings)
    jest.advanceTimersByTime(1)
    expect(await second).toBe(false)
    expect(currentWriteApproval.value).toBeNull()
  } finally {
    jest.useRealTimers()
  }
})

test('a deadline denies a request wherever it waits, and a later Allow changes nothing', async () => {
  jest.useFakeTimers()
  try {
    const first = requestWriteApproval(settings)
    const queued = requestWriteApproval(save, { deadline: Date.now() + 1_000 })
    jest.advanceTimersByTime(1_000)
    // Still behind the first request, and already denied.
    expect(await queued).toBe(false)
    answerWriteApproval(save, true)
    expect(currentWriteApproval.value).toBe(settings)
    answerWriteApproval(settings, true)
    expect(await first).toBe(true)
  } finally {
    jest.useRealTimers()
  }
})

test('an Allow that arrives at the deadline, before its timer runs, is a Deny', async () => {
  const late = requestWriteApproval(save, { deadline: Date.now() - 1 })
  answerWriteApproval(save, true)
  expect(await late).toBe(false)
})

test('a request with a deadline does not take the dialog timeout as well', async () => {
  jest.useFakeTimers()
  try {
    const pending = requestWriteApproval(save, {
      deadline: Date.now() + 2 * WRITE_APPROVAL_TIMEOUT_MS
    })
    jest.advanceTimersByTime(WRITE_APPROVAL_TIMEOUT_MS)
    expect(currentWriteApproval.value).toBe(save)
    answerWriteApproval(save, true)
    expect(await pending).toBe(true)
  } finally {
    jest.useRealTimers()
  }
})
