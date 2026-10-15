import {
  ALL_TOOLS,
  CORE_TOOLS,
  isToolExposed,
  toolChangesDocument,
  type ToolDef
} from '@open-pencil/core/tools'

import type { ToolAccessEntry } from '@/app/automation/tool-access/types'

/** Preserve the compact shipped tool set as defaults, not as an availability restriction. */
const defaultNames = new Set([
  ...CORE_TOOLS.map((tool) => tool.name),
  'get_components',
  'list_libraries',
  'insert_library_component',
  // Scripts cannot discover comments, so without these the model fakes them with layers.
  'get_comments',
  'add_comment',
  'reply_to_comment',
  'resolve_comment',
  // Design JSX references variables but cannot create them.
  'list_variables',
  'create_collection',
  'create_variable',
  'set_variable',
  'bind_variable',
  'lint',
  'lint_fix',
  // Lets the model look at what it built.
  'export_image',
  'list_pages',
  'create_page'
])

/**
 * Chat never runs model-written scripts: a tool that executes code is neither offered nor
 * configurable, whatever its exposure says or a saved override asks.
 */
function isChatTool(tool: ToolDef): boolean {
  return (
    isToolExposed(tool, 'ai') &&
    tool.availability !== 'eval' &&
    !tool.capabilities.includes('code:execute')
  )
}

export const aiToolDefinitions = ALL_TOOLS.filter(isChatTool)

export const configurableAITools: ToolAccessEntry[] = aiToolDefinitions.map((tool) => ({
  name: tool.name,
  description: tool.description,
  effect: toolChangesDocument(tool) ? 'write' : 'read'
}))

export function isAIToolEnabled(name: string, overrides: Readonly<Record<string, boolean>>) {
  return overrides[name] ?? defaultNames.has(name)
}

export function enabledAIToolDefinitions(overrides: Readonly<Record<string, boolean>>) {
  return aiToolDefinitions.filter((tool) => isAIToolEnabled(tool.name, overrides))
}
