import type { Page } from '@playwright/test'

const FONT_MODULE_RESOURCE_CAPACITY = 4096

/** Preserve the loaded font module URL even when the dev module graph exceeds the browser's default buffer. */
export async function trackFontModuleResources(page: Page): Promise<void> {
  await page.addInitScript(
    (capacity) => performance.setResourceTimingBufferSize(capacity),
    FONT_MODULE_RESOURCE_CAPACITY
  )
}

/** Turn remote fonts on before the app loads; they are off by default (`src/app/editor/fonts/remote.ts`). */
export async function allowRemoteFonts(page: Page): Promise<void> {
  await page.addInitScript(() => localStorage.setItem('peel:remote-fonts-enabled', 'true'))
}
