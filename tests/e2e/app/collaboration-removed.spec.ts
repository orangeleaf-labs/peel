import { expect, test, type Page } from '@playwright/test'

import type AppRouter from '@/router'

/** A well-formed upstream room ID: 32 lowercase base36 characters. */
const ROOM_ID = 'abcdefghijklmnopqrstuvwxyz012345'

/** Collects WebSocket connections that leave this machine. */
function recordRemoteSockets(page: Page): string[] {
  const urls: string[] = []
  page.on('websocket', (socket) => {
    const { hostname } = new URL(socket.url())
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') urls.push(socket.url())
  })
  return urls
}

async function expectNoCollaborationControls(page: Page) {
  await expect(page.getByRole('button', { name: /share|join room|voice call/i })).toHaveCount(0)
  await expect(page.getByRole('textbox', { name: /room link/i })).toHaveCount(0)
}

test('the editor offers no way to share, join a room, or call', async ({ page }) => {
  const remote = recordRemoteSockets(page)
  await page.goto('/?test')
  await expect(page.getByTestId('editor-root')).toBeVisible()
  await expectNoCollaborationControls(page)
  expect(remote).toEqual([])
})

test('the home view offers no way to join a room', async ({ page }) => {
  await page.goto('/?recent-files')
  await expect(page.getByTestId('recent-files-home')).toBeVisible()
  await expectNoCollaborationControls(page)
})

test('a share link matches no route, opens no room, and connects nowhere', async ({ page }) => {
  const remote = recordRemoteSockets(page)
  await page.goto(`/share/${ROOM_ID}?test`)
  const { matched, paths } = await page.evaluate(async () => {
    const routerURL = '/src/router.ts'
    const router: { default: typeof AppRouter } = await import(routerURL)
    await router.default.isReady()
    return {
      matched: router.default.currentRoute.value.matched.length,
      paths: router.default.getRoutes().map((route) => route.path)
    }
  })
  expect(matched).toBe(0)
  expect(paths.length).toBeGreaterThan(0)
  expect(paths.filter((path) => path.startsWith('/share'))).toEqual([])
  await expect(page.getByTestId('editor-root')).toHaveCount(0)
  expect(remote).toEqual([])
})
