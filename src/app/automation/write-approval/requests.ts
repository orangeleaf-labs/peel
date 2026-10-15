import type { ToolCapability, ToolDef } from '@open-pencil/core/tools'

/** What an agent's call would change outside the open document, as the user is asked about it. */
export type WriteKind = 'save' | 'export' | 'settings' | 'write'

export interface WriteRequest {
  /** The tool or automation command, as the agent named it. */
  tool: string
  kind: WriteKind
  /** The file path, the document name, or the settings the call changes; empty when unknown. */
  target: string
  /** The exported format, for an export. */
  format?: string
}

/**
 * Tools whose `path` argument is an output file. The app returns their data and the MCP server
 * writes it to `path` (`packages/mcp/src/tool/output.ts`), so the app asks before it answers.
 */
const FILE_OUTPUT_FORMATS: Readonly<
  Partial<Record<string, (args: Record<string, unknown>) => string>>
> = {
  export_svg: () => 'SVG',
  export_pdf: () => 'PDF',
  export_image: (args) => (typeof args.format === 'string' ? args.format.toUpperCase() : 'PNG'),
  get_jsx: () => 'JSX'
}

const OUTSIDE_WRITE_CAPABILITIES: ReadonlySet<ToolCapability> = new Set([
  'filesystem:write',
  'settings:write'
])

export interface ToolWriteOptions {
  /**
   * The caller writes a tool's result to its `path` argument. True for automation (MCP), whose
   * server writes the file; false for the built-in chat, which only hands the result to the model.
   */
  writesOutputPath: boolean
}

/** The write a tool call would make outside the document, or null for document and read tools. */
export function toolWriteRequest(
  def: Pick<ToolDef, 'name' | 'capabilities'>,
  args: Record<string, unknown>,
  { writesOutputPath }: ToolWriteOptions
): WriteRequest | null {
  const path = typeof args.path === 'string' ? args.path : ''
  const format = FILE_OUTPUT_FORMATS[def.name]
  if (writesOutputPath && format && path) {
    return { tool: def.name, kind: 'export', target: path, format: format(args) }
  }
  if (!def.capabilities.some((capability) => OUTSIDE_WRITE_CAPABILITIES.has(capability))) {
    return null
  }
  if (def.capabilities.includes('filesystem:write')) {
    return { tool: def.name, kind: 'write', target: path }
  }
  return { tool: def.name, kind: 'settings', target: '' }
}

/** Dot paths of the leaves a settings patch sets, such as `appearance.theme`. */
export function settingsPatchPaths(patch: unknown, prefix = ''): string[] {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return prefix ? [prefix] : []
  const entries = Object.entries(patch)
  if (entries.length === 0) return prefix ? [prefix] : []
  return entries.flatMap(([key, value]) =>
    settingsPatchPaths(value, prefix ? `${prefix}.${key}` : key)
  )
}

/** What the agent hears when the user says no; nothing was written. */
export function writeDeniedMessage(request: WriteRequest): string {
  const target = request.target ? ` (${request.target})` : ''
  return `The user did not allow "${request.tool}" to write outside the document${target}; nothing was changed.`
}
