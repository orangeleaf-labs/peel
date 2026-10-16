import { expect, test } from '@playwright/test'

const story = (id: string) => `/iframe.html?id=${id}&viewMode=story`

test('an avatar stack collapses the people that do not fit into +N', async ({ page }) => {
  await page.goto(story('app-presence-avatar-stack--more-than-fit'))
  await expect(page.getByRole('img', { name: 'Dana, Ana, Ben' })).toContainText('+1')
})

test('the follow frame names the followed agent and offers to stop', async ({ page }) => {
  await page.goto(story('app-presence-follow-frame--following-an-agent'))
  await expect(page.getByRole('status')).toHaveText(/Following Fern/)
  await expect(page.getByRole('button', { name: 'Stop following' })).toBeVisible()
})
