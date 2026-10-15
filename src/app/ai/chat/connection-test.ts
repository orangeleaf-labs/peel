import { generateText } from 'ai'

import { isInsufficientCreditError, providerErrorStatus } from '@/app/ai/chat/failure'
import { createLanguageModel, resolveLanguageModelID, type ModelConfig } from '@/app/ai/chat/model'
import { isTauri } from '@/app/tauri/env'

export type ProviderConnectionTestResult =
  | { ok: true }
  | { ok: false; reason: ProviderConnectionTestFailureReason }

export type ProviderConnectionTestFailureReason =
  | 'missing-api-key'
  | 'missing-model'
  | 'auth'
  | 'insufficient-credit'
  | 'model-not-found'
  | 'browser-network'
  | 'network'
  | 'unknown'

function validateConfig(config: ModelConfig): ProviderConnectionTestFailureReason | null {
  if (!config.apiKey.trim()) return 'missing-api-key'
  if (!resolveLanguageModelID(config).trim()) return 'missing-model'
  return null
}

function errorText(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`
  return String(error)
}

function classifyStatus(
  status: number | null,
  text: string
): ProviderConnectionTestFailureReason | null {
  if (status === 401 || status === 403) return 'auth'
  if (status === 404) return 'model-not-found'
  if (status !== 400 && status !== 405) return null
  return text.includes('model') ? 'model-not-found' : null
}

function classifyMessage(text: string): ProviderConnectionTestFailureReason | null {
  if (
    text.includes('api key') ||
    text.includes('authentication') ||
    text.includes('unauthorized')
  ) {
    return 'auth'
  }
  if (text.includes('model') && (text.includes('not found') || text.includes('does not exist'))) {
    return 'model-not-found'
  }
  if (
    text.includes('failed to fetch') ||
    text.includes('networkerror') ||
    text.includes('load failed')
  ) {
    return isTauri() ? 'network' : 'browser-network'
  }
  if (text.includes('connection') || text.includes('network') || text.includes('timeout')) {
    return 'network'
  }
  return null
}

function classifyError(error: unknown): ProviderConnectionTestFailureReason {
  if (isInsufficientCreditError(error)) return 'insufficient-credit'
  const text = errorText(error).toLowerCase()
  return classifyStatus(providerErrorStatus(error), text) ?? classifyMessage(text) ?? 'unknown'
}

export async function testProviderConnection(
  config: ModelConfig
): Promise<ProviderConnectionTestResult> {
  const invalidReason = validateConfig(config)
  if (invalidReason) return { ok: false, reason: invalidReason }

  try {
    await generateText({
      model: createLanguageModel(config),
      prompt: 'Reply with OK.',
      maxOutputTokens: 1,
      abortSignal: AbortSignal.timeout(15_000)
    })
    return { ok: true }
  } catch (error) {
    return { ok: false, reason: classifyError(error) }
  }
}
