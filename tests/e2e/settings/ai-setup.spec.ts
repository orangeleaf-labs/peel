import { expect, test, type Page } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'POST, OPTIONS'
}

async function openGuidedSetup(page: Page) {
  await page.goto('/?test')
  await new CanvasHelper(page).waitForInit()
  await page.getByTestId('app-settings-trigger').click()
  await page.getByTestId('settings-section-ai').click()
  await page.getByTestId('settings-run-ai-setup').click()
  const setup = page.getByTestId('ai-setup-dialog')
  await expect(setup.getByRole('heading', { name: 'What should AI help with?' })).toBeVisible()
  return setup
}

/** Answers the connection test like the Anthropic Messages API, recording each request's host. */
async function serveAnthropic(page: Page) {
  const hosts: string[] = []
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    if (url.hostname !== 'api.anthropic.com') return route.fallback()
    hosts.push(url.hostname)
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS_HEADERS })
      return
    }
    await route.fulfill({
      headers: CORS_HEADERS,
      json: {
        id: 'msg_ai_setup',
        type: 'message',
        role: 'assistant',
        model: 'claude-sonnet-5-5',
        content: [{ type: 'text', text: 'ok' }],
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: 1, output_tokens: 1 }
      }
    })
  })
  return hosts
}

test('guided setup opens from AI settings and hands off to advanced settings', async ({ page }) => {
  const setup = await openGuidedSetup(page)
  await setup.getByRole('button', { name: 'Advanced settings' }).click()
  await expect(setup).toHaveCount(0)
  await expect(page.getByTestId('settings-add-model')).toBeVisible()
})

test('guided setup connects an Anthropic API key and saves the recommended models', async ({
  page
}) => {
  const hosts = await serveAnthropic(page)
  const setup = await openGuidedSetup(page)
  const next = setup.getByRole('button', { name: 'Continue' })
  await next.click()
  // Anthropic is the only API account setup offers.
  const section = setup.locator('section', { hasText: 'API accounts' })
  await expect(section.getByRole('checkbox')).toHaveCount(1)
  await section.getByRole('checkbox', { name: 'Anthropic' }).click()
  await next.click()

  await expect(setup.getByRole('heading', { name: 'Connect your AI' })).toBeVisible()
  await expect(next).toBeDisabled()
  await setup.getByLabel('API Key').fill('sk-ant-e2e-key')
  await setup.getByRole('button', { name: 'Test connection' }).click()
  await expect(next).toBeEnabled()
  expect(hosts.length).toBeGreaterThan(0)
  await next.click()

  // Role choices read "<model> · <provider>"; the catalog decides which models those are.
  const design = setup.getByRole('combobox', { name: 'Design agent' })
  const fast = setup.getByRole('combobox', { name: 'Fast tasks' })
  const designModel = (await design.textContent())?.split(' · ')[0]?.trim() ?? ''
  const recommendedFast = (await fast.textContent())?.trim() ?? ''
  expect(recommendedFast).not.toMatch(/Same as Design/)
  await fast.click()
  await page.getByRole('option', { name: 'Same as Design' }).click()
  await expect(fast).toHaveText(/Same as Design/)
  await setup.getByRole('button', { name: 'Use recommended setup' }).click()
  await expect(fast).toHaveText(recommendedFast)
  const fastModel = recommendedFast.split(' · ')[0]?.trim() ?? ''
  await setup.getByRole('button', { name: 'Finish setup' }).click()
  await expect(setup.getByRole('heading', { name: 'AI is ready' })).toBeVisible()
  await setup.getByRole('button', { name: 'Done' }).click()

  const models = page.getByTestId('settings-model-list')
  for (const name of [designModel, fastModel]) {
    const model = models.locator('[data-model-id]', { hasText: name })
    // The saved key shows without reopening Settings.
    await expect(model.getByText('Connected', { exact: true })).toBeVisible()
  }
  await expect(models.getByText('Design model', { exact: true })).toHaveCount(0)
  expect(new Set(hosts)).toEqual(new Set(['api.anthropic.com']))
})
