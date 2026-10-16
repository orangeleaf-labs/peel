import { createCanvasJSXPreview } from '@/app/ai/preview/canvas'
import { markRunPreview, runPageId } from '@/app/ai/tools/run'
import type { EditorStore } from '@/app/editor/active-store'

/**
 * The chat run's preview of streamed `render` input: drawn on this canvas, with the run's agent
 * pointing at what it builds. It stays local; Peel has no rooms to publish it to.
 */
export function createRunPreview(store: EditorStore) {
  const preview = createCanvasJSXPreview(store, () => runPageId(store), {
    onFocus: (focus) => markRunPreview(store, focus)
  })
  return {
    start: (callId: string, signal?: AbortSignal) => preview.start(callId, signal),
    delta: (callId: string, text: string) => preview.delta(callId, text),
    finish: (callId: string) => preview.finish(callId),
    clear: () => preview.clear()
  }
}
