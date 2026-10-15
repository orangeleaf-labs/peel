import { expect, test } from 'bun:test'

import {
  answerWriteApproval,
  approveWrite,
  currentWriteApproval,
  requestWriteApproval,
  WriteDeniedError
} from '@/app/automation/write-approval'

import { answerNextWriteApproval } from '#tests/helpers/write-approval'

const save = { tool: 'save_file', kind: 'save', target: '/tmp/a.fig' } as const
const settings = { tool: 'update_settings', kind: 'settings', target: 'appearance.theme' } as const

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
