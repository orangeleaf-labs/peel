import type { FetchFunction } from '@/app/http/types'

/** Remote fonts stay off until the user turns them on; a new key, so no earlier default counts. */
export const REMOTE_FONTS_STORAGE_KEY = 'peel:remote-fonts-enabled'

/**
 * Hands requests to `fetcher` only while the user allows remote fonts, so nothing reaches a font
 * provider while they are off, whichever provider settings are in effect.
 */
export function optInFontFetch(enabled: () => boolean, fetcher: FetchFunction): FetchFunction {
  return (input, init) =>
    enabled() ? fetcher(input, init) : Promise.reject(new Error('Remote fonts are turned off'))
}
