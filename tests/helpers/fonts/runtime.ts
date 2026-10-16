import type { Page } from '@playwright/test'

const FONT_MODULE_RESOURCE_CAPACITY = 4096

/** Preserve the loaded font module URL even when the dev module graph exceeds the browser's default buffer. */
export async function trackFontModuleResources(page: Page): Promise<void> {
  await page.addInitScript(
    (capacity) => performance.setResourceTimingBufferSize(capacity),
    FONT_MODULE_RESOURCE_CAPACITY
  )
}

/**
 * Turn remote fonts on before the app loads, keeping the other stored preferences; they are off
 * by default (`fonts.remote` in `src/app/settings/preferences/store.ts`).
 */
export async function allowRemoteFonts(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const key = 'open-pencil:preferences:v1'
    // oxlint-disable-next-line open-pencil/no-direct-storage-access -- Seed the stored preference before the app reads it.
    const storage = localStorage
    const stored: unknown = JSON.parse(storage.getItem(key) ?? '{}')
    const preferences = typeof stored === 'object' && stored !== null ? stored : {}
    storage.setItem(key, JSON.stringify({ ...preferences, fonts: { remote: true } }))
  })
}
