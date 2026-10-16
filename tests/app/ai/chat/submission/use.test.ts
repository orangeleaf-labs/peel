import { describe, expect, mock, spyOn, test } from 'bun:test'

import type { Chat } from '@ai-sdk/vue'
import type { UIMessage } from 'ai'
import { ref, shallowRef } from 'vue'

import { useChatSubmission } from '@/app/ai/chat/submission/use'
import type { EditorStore } from '@/app/editor/active-store'

import { asDouble } from '#tests/helpers/doubles'

const messages = ref({
  openSettings: 'Open settings',
  requestFailed: 'Request failed',
  visionUnavailable: 'Vision unavailable'
})

function submission(ensureChat: () => Promise<Chat<UIMessage> | null>) {
  const reportError = mock(() => undefined)
  const chat = useChatSubmission({
    chat: shallowRef<Chat<UIMessage> | null>(null),
    ensureChat,
    clearFailure: () => undefined,
    getEditor: () => ({}) as EditorStore,
    messages,
    reportError,
    openModelSettings: () => undefined
  })
  return { chat, reportError }
}

const message = { modelText: 'Draw a card', displayText: 'Draw a card', images: [], nodes: [] }

describe('useChatSubmission', () => {
  test('reports an unsent message so the composer can keep it', async () => {
    const { chat } = submission(async () => null)
    expect(await chat.submit(message)).toBe(false)
  })

  test('reports a chat that could not start as a failed request', async () => {
    const { chat, reportError } = submission(async () => {
      throw new Error('private transport details')
    })
    expect(await chat.submit(message)).toBe(false)
    expect(reportError).toHaveBeenCalledWith('Request failed')
  })

  test('keeps the previews of an unsent message for the composer to take back', async () => {
    const revoke = spyOn(URL, 'revokeObjectURL')
    try {
      const { chat } = submission(async () => null)
      const image = { file: new File(['png'], 'card.png'), previewURL: 'blob:card' }
      expect(await chat.submit({ ...message, images: [image] })).toBe(false)
      expect(revoke).not.toHaveBeenCalled()
    } finally {
      revoke.mockRestore()
    }
  })

  test('hands back a message that failed before reaching the chat', async () => {
    const target = fakeChat()
    const { chat } = submission(async () => target)
    // The editor stand-in cannot snapshot the referenced layer, which fails before sending.
    const node = { id: '1:2', name: 'Card', type: 'FRAME' as const }
    expect(await chat.submit({ ...message, nodes: [node] })).toBe(false)
    expect(target.messages).toEqual([])
  })

  test('takes back a message whose images could not be prepared', async () => {
    const revoke = spyOn(URL, 'revokeObjectURL')
    try {
      const target = fakeChat()
      const { chat } = submission(async () => target)
      const image = { file: new File(['not an image'], 'card.png'), previewURL: 'blob:card' }
      expect(await chat.submit({ ...message, images: [image] })).toBe(false)
      expect(target.messages).toEqual([])
      expect(revoke).not.toHaveBeenCalled()
    } finally {
      revoke.mockRestore()
    }
  })
})

function fakeChat(sendMessage: () => Promise<void> = async () => undefined): Chat<UIMessage> {
  return asDouble<Chat<UIMessage>>({ messages: [], status: 'ready', sendMessage })
}
