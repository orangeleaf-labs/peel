import { i18n } from '#vue/i18n/create'

export const mediaMessageDefaults = {
  vectorization: 'Image vectorization',
  vectorizationDescription:
    'Send image layers to Recraft or fal.ai and return editable vectors. Provider charges may apply.',
  vectorizeProvider: 'Vectorization service'
} as const

export const mediaMessages = i18n('media', mediaMessageDefaults)
