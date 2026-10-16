import type { Ref } from 'vue'

import { VisionModelUnavailableError } from '@/app/ai/attachment/image/analyze'

export interface SubmissionMessages {
  openSettings: string
  requestFailed: string
  visionUnavailable: string
}

export interface SubmissionErrorOptions {
  messages: Ref<SubmissionMessages>
  reportError: (message: string, action?: { label: string; run: () => void }) => void
  openModelSettings: () => void
}

/** Explains why a message could not be sent, with the fix when there is one. */
export function reportSubmissionError(options: SubmissionErrorOptions, error: unknown): void {
  console.error('Chat error:', error)
  if (error instanceof VisionModelUnavailableError) {
    options.reportError(options.messages.value.visionUnavailable, {
      label: options.messages.value.openSettings,
      run: options.openModelSettings
    })
    return
  }
  options.reportError(options.messages.value.requestFailed)
}
