import type { Page } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'
import { expect, test } from '#tests/helpers/chat/fixture'
import { ChatHarness } from '#tests/helpers/chat/harness'

test('Design profile selector exposes provider and capabilities', async ({
  configuredChat: chat
}) => {
  await chat.profileTrigger.click()

  await expect(chat.page.getByText('Design agent', { exact: true })).toBeVisible()
  await expect(chat.page.getByRole('option', { name: /Claude Sonnet/ })).toContainText('Anthropic')
  await expect(chat.page.getByLabel('Supports image input')).toBeVisible()
  await expect(chat.page.getByRole('button', { name: 'Manage models and roles…' })).toBeVisible()
})

test('the model picker offers only the built-in Claude models', async ({
  configuredChat: chat
}) => {
  await chat.page.getByTestId('provider-settings-trigger').click()
  await chat.page.locator('[data-model-id]').first().click()
  await chat.page.getByLabel('Model ID').click()
  // The list is built in, so it is complete as soon as it opens.
  await expect(chat.page.getByRole('option', { name: /Claude Opus 5\.5/ })).toBeVisible()
  await expect(chat.page.getByRole('option', { name: 'Custom model…' })).toHaveCount(0)
  for (const name of await chat.page.getByRole('option').allTextContents()) {
    expect(name).toMatch(/Claude/)
  }
})

test('Get API key links to the provider key page', async ({ configuredChat: chat }) => {
  await chat.page.getByTestId('provider-settings-trigger').click()
  await chat.page.locator('[data-model-id]').first().click()

  await expect(chat.page.getByRole('link', { name: 'Get API key' })).toHaveAttribute(
    'href',
    'https://console.anthropic.com/settings/keys'
  )
})

/** The Anthropic API refusing every key but `validKey`, and answering that one with a stream. */
async function routeAnthropicKey(page: Page, validKey: string): Promise<string[]> {
  const keys: string[] = []
  await page.route('https://api.anthropic.com/v1/messages', (route) => {
    const key = route.request().headers()['x-api-key'] ?? ''
    keys.push(key)
    if (key !== validKey) {
      return route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          type: 'error',
          error: { type: 'authentication_error', message: 'invalid x-api-key' }
        })
      })
    }
    const event = (type: string, data: object) =>
      `event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`
    return route.fulfill({
      contentType: 'text/event-stream',
      body:
        event('message_start', {
          message: {
            id: 'msg_key_test',
            type: 'message',
            role: 'assistant',
            model: 'claude-sonnet-5-5',
            content: [],
            stop_reason: null,
            stop_sequence: null,
            usage: { input_tokens: 1, output_tokens: 1 }
          }
        }) +
        event('content_block_start', { index: 0, content_block: { type: 'text', text: '' } }) +
        event('content_block_delta', {
          index: 0,
          delta: { type: 'text_delta', text: 'Hello again' }
        }) +
        event('content_block_stop', { index: 0 }) +
        event('message_delta', {
          delta: { stop_reason: 'end_turn', stop_sequence: null },
          usage: { output_tokens: 2 }
        }) +
        event('message_stop', {})
    })
  })
  return keys
}

test('a key replaced in Settings is used when asking again', async ({ page }) => {
  const keys = await routeAnthropicKey(page, 'sk-ant-valid')
  const chat = new ChatHarness(page)
  await chat.open()
  await new CanvasHelper(page).waitForInit()
  await chat.configureAnthropic('sk-ant-expired')

  await chat.submit('Say hello')
  const toast = page.locator('[data-slot="toast"]')
  await toast.getByRole('button', { name: 'Open settings' }).click()
  await page.locator('[data-model-id]').first().click()
  await chat.apiKeyInput.fill('sk-ant-valid')
  await page.getByRole('button', { name: 'Save model' }).click()
  await page.getByTestId('app-settings-done').click()

  await chat.assistantMessage().getByTestId('chat-regenerate').click()
  await expect(chat.assistantMessage()).toContainText('Hello again')
  expect(keys).toEqual(['sk-ant-expired', 'sk-ant-valid'])
  // The failure's notice goes once the request is asked again.
  await expect(toast).toHaveCount(0)
})
