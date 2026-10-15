import type { Page } from '@playwright/test'

/** What the stand-in Vision model reports for every attached image. */
const VISION_FINDINGS = 'A centered portrait on a light background.'

/**
 * Answers the Vision model's request for attached images, which goes to the Anthropic API directly
 * rather than through the chat transport, so image messages never reach the network.
 */
export async function routeVisionModel(page: Page): Promise<void> {
  await page.route('https://api.anthropic.com/v1/messages', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'msg_vision_test',
        type: 'message',
        role: 'assistant',
        model: 'claude-test-vision',
        content: [{ type: 'text', text: VISION_FINDINGS }],
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: 1, output_tokens: 1 }
      })
    })
  )
}
