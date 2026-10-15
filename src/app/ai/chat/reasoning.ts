import type { LanguageModelCallOptions } from 'ai'

import type { ThinkingLevel } from '@/app/ai/models/types'

type JSONValue = null | boolean | number | string | JSONValue[] | { [key: string]: JSONValue }
export type AIProviderOptions = Record<string, { [key: string]: JSONValue }>

export type ReasoningCallSettings = {
  reasoning?: LanguageModelCallOptions['reasoning']
}

/** The Anthropic provider maps the standard `reasoning` level to its own thinking options. */
export function reasoningCallSettings(level: ThinkingLevel): ReasoningCallSettings {
  if (level === 'default') return {}
  return { reasoning: level === 'off' ? 'none' : level }
}
