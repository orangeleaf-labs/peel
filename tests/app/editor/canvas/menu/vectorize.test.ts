import { describe, expect, test } from 'bun:test'

import { ref } from 'vue'

import { createCanvasMenuActions } from '@/app/editor/canvas/menu/actions'
import { useCanvasContextMenu } from '@/app/editor/canvas/menu/context'
import { createEditorStore } from '@/app/editor/session/create'
import { appCredentialRefs } from '@/app/settings/credentials/persistence'

const LABELS = {
  copyPasteAs: 'Copy/Paste as',
  copyAsText: 'Copy as text',
  copyAsSVG: 'Copy as SVG',
  copyAsPNG: 'Copy as PNG',
  copyAsJSX: 'Copy as JSX',
  copyNodeId: 'Copy node ID',
  copyXPath: 'Copy XPath'
}

/** A store whose only selected layer is an image rectangle, which once offered vectorization. */
function storeWithSelectedImage() {
  const store = createEditorStore()
  store.graph.images.set('photo', new Uint8Array([1, 2, 3]))
  const image = store.graph.createNode('RECTANGLE', store.state.currentPageId, {
    width: 100,
    height: 100,
    fills: [
      {
        type: 'IMAGE',
        visible: true,
        opacity: 1,
        color: { r: 0, g: 0, b: 0, a: 1 },
        imageHash: 'photo',
        imageScaleMode: 'FILL'
      }
    ]
  })
  store.select([image.id])
  return { store, selectedIds: ref(new Set([image.id])) }
}

describe('image vectorization services', () => {
  test('the canvas menu offers no Recraft or fal.ai vectorization for an image layer', () => {
    const { store, selectedIds } = storeWithSelectedImage()
    const actions = createCanvasMenuActions(store, selectedIds)
    const entries = useCanvasContextMenu(ref([]), ref(true), store, actions, ref(LABELS)).value

    expect(Object.keys(actions).filter((key) => /vector/i.test(key))).toEqual([])
    // Labels and test IDs of every entry and submenu entry, as the menu would render them.
    const rendered = JSON.stringify(entries)
    expect(rendered).not.toMatch(/vector|recraft|fal\.ai/i)
    expect(rendered).toContain('Copy as SVG')
  })

  test('no credential is kept for a Recraft or fal.ai key', () => {
    const integrations = appCredentialRefs().map((reference) => reference.integrationId)
    expect(integrations.filter((id) => /vectorize|recraft|fal/i.test(id))).toEqual([])
  })
})
