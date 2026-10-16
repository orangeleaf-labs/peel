import { describe, expect, test } from 'bun:test'

import { ALL_TOOLS, toolChangesDocument, type ToolDef } from '@open-pencil/core/tools'

import { settingsPatchPaths, toolWriteRequest } from '@/app/automation/write-approval'

import { expectDefined } from '#tests/helpers/assert'

function tool(name: string): ToolDef {
  return expectDefined(
    ALL_TOOLS.find((def) => def.name === name),
    name
  )
}

const chat = { writesOutputPath: false }
const automation = { writesOutputPath: true }

describe('toolWriteRequest', () => {
  test('document edits and reads never ask, from the chat or from automation', () => {
    for (const def of ALL_TOOLS) {
      if (def.capabilities.includes('filesystem:write')) continue
      if (def.capabilities.includes('settings:write')) continue
      if (def.capabilities.includes('code:execute')) continue
      expect(toolWriteRequest(def, {}, chat)).toBeNull()
      expect(toolWriteRequest(def, {}, automation)).toBeNull()
    }
    const documentTools = ALL_TOOLS.filter(toolChangesDocument).map((def) => def.name)
    expect(documentTools).toContain('render')
    expect(documentTools).toContain('set_fill')
  })

  test('an export that only returns its image to the model is not a write', () => {
    expect(toolWriteRequest(tool('export_image'), { format: 'PNG' }, automation)).toBeNull()
    // The chat hands every result to the model; it never writes a `path`.
    expect(toolWriteRequest(tool('export_image'), { path: 'out.png' }, chat)).toBeNull()
  })

  test('an export the MCP server writes to a path names the tool, the file and the format', () => {
    expect(
      toolWriteRequest(
        tool('export_image'),
        { path: 'shots/card.webp', format: 'WEBP' },
        automation
      )
    ).toEqual({ tool: 'export_image', kind: 'export', target: 'shots/card.webp', format: 'WEBP' })
    expect(toolWriteRequest(tool('export_svg'), { path: 'card.svg' }, automation)).toEqual({
      tool: 'export_svg',
      kind: 'export',
      target: 'card.svg',
      format: 'SVG'
    })
    expect(toolWriteRequest(tool('get_jsx'), { path: 'Card.tsx' }, automation)?.format).toBe('JSX')
  })

  test('a PDF export is returned, never written, so its path does not ask', () => {
    expect(toolWriteRequest(tool('export_pdf'), { path: 'card.pdf' }, automation)).toBeNull()
  })

  test('a script asks in every interface, showing its start', () => {
    const code = `figma.currentPage.children.length\n${'x'.repeat(400)}`
    for (const options of [chat, automation]) {
      const request = expectDefined(toolWriteRequest(tool('eval'), { code }, options), 'request')
      expect(request.kind).toBe('code')
      expect(request.tool).toBe('eval')
      expect(request.target.startsWith('figma.currentPage.children.length x')).toBe(true)
      expect(request.target.length).toBeLessThanOrEqual(240)
    }
  })

  test('a vector path argument is geometry, not a file', () => {
    for (const name of ['create_vector', 'path_set']) {
      expect(toolWriteRequest(tool(name), { path: 'M0 0 L10 10' }, automation)).toBeNull()
    }
  })

  test('tools that declare a write outside the document ask in every interface', () => {
    const fileWriter = { name: 'save_copy', capabilities: ['filesystem:write'] } as const
    const settingsWriter = { name: 'set_theme', capabilities: ['settings:write'] } as const
    expect(toolWriteRequest(fileWriter, { path: '/tmp/a.fig' }, chat)).toEqual({
      tool: 'save_copy',
      kind: 'write',
      target: '/tmp/a.fig'
    })
    expect(toolWriteRequest(settingsWriter, {}, automation)).toEqual({
      tool: 'set_theme',
      kind: 'settings',
      target: ''
    })
  })
})

test('settingsPatchPaths lists each setting a patch changes', () => {
  expect(
    settingsPatchPaths({
      appearance: { theme: 'light' },
      editing: { snapping: { pixelGrid: false, objects: true } },
      designCheck: { disabledRules: ['a'] }
    })
  ).toEqual([
    'appearance.theme',
    'editing.snapping.pixelGrid',
    'editing.snapping.objects',
    'designCheck.disabledRules'
  ])
  expect(settingsPatchPaths({})).toEqual([])
})
