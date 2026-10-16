import { describe, expect, test } from 'bun:test'

import { FEATURE_KINDS } from '#docs-config/theme/landing/content/features'
import { posterParts, posterPath } from '#docs-config/theme/landing/posters'

const TARGET = {
  fingerprint: '0123456789abcdef',
  locale: 'ru',
  theme: 'dark',
  layout: 'phone'
} as const

describe('landing poster paths', () => {
  test('name the fingerprint, locale, theme, layout, stage, and part', () => {
    expect(posterPath(TARGET, 'design', 'panel')).toBe(
      'landing-posters/0123456789abcdef/ru/dark-phone/design-panel.webp'
    )
  })

  test('split every stage into canvas and panel', () => {
    expect(posterParts()).toEqual(['canvas', 'panel'])
  })

  test('are unique across every stage and part of a page', () => {
    const paths = FEATURE_KINDS.flatMap((kind) =>
      posterParts().map((part) => posterPath(TARGET, kind, part))
    )
    expect(new Set(paths).size).toBe(paths.length)
  })
})
