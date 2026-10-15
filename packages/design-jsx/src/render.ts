import { difference, uniq } from 'es-toolkit/array'

import type { SceneGraph } from '@open-pencil/scene-graph'

import { evaluateDesignJSXTree } from './evaluate'
import { renderRoots, renderTree, componentPropNames, type RenderResult } from './renderer'
import {
  DESIGN_JSX_PARAGRAPH_PROPERTY_NAMES,
  DESIGN_JSX_SPAN_PROPERTY_NAMES,
  DESIGN_JSX_SUPPORTED_PROPERTY_NAMES,
  DESIGN_JSX_TEXT_PARAGRAPH_PROPERTY_NAMES
} from './schema'
import type { DesignJSXServices } from './services'
import { PARAGRAPH, SPAN, TEXT_CONTENT_NAMES } from './text-content'
import { isTreeNode, type TreeNode } from './tree'
import type { RenderOptions as RenderJSXOptions } from './types'

function unsupportedPropWarnings(graph: SceneGraph, tree: TreeNode): string[] {
  const warnings: string[] = []
  collectUnsupportedPropWarnings(graph, tree, warnings)
  return warnings
}

// Paragraph props describe a paragraph of a text, never a layer, unless a text sets them too.
const LAYER_PROPS = new Set<string>(
  difference(
    DESIGN_JSX_SUPPORTED_PROPERTY_NAMES,
    difference(DESIGN_JSX_PARAGRAPH_PROPERTY_NAMES, DESIGN_JSX_TEXT_PARAGRAPH_PROPERTY_NAMES)
  )
)
const SVG_ROOT_PROPS = new Set([...LAYER_PROPS, 'viewBox', 'body'])
const PARAGRAPH_PROPS = new Set<string>(['key', ...DESIGN_JSX_PARAGRAPH_PROPERTY_NAMES])
const SPAN_PROPS = new Set<string>(['key', ...DESIGN_JSX_SPAN_PROPERTY_NAMES])

function supportedProps(type: string): ReadonlySet<string> {
  if (type === 'svg') return SVG_ROOT_PROPS
  if (type === SPAN) return SPAN_PROPS
  if (type === PARAGRAPH) return PARAGRAPH_PROPS
  return LAYER_PROPS
}

function collectUnsupportedPropWarnings(
  graph: SceneGraph,
  tree: TreeNode,
  warnings: string[]
): void {
  const supported = supportedProps(tree.type)
  // An instance sets its component's properties by name, such as `State="On"` or `Title="Hi"`.
  const properties = componentPropNames(graph, tree.props)
  for (const key of Object.keys(tree.props)) {
    if (!supported.has(key) && !properties.includes(key)) {
      const element = TEXT_CONTENT_NAMES[tree.type] ?? tree.type
      warnings.push(`Unsupported prop "${key}" on <${element}> is ignored.`)
    }
  }

  // SVG descendants are parsed as markup by renderSvgNode, not as Design JSX nodes.
  if (tree.type === 'svg') return

  for (const child of tree.children) {
    if (isTreeNode(child)) collectUnsupportedPropWarnings(graph, child, warnings)
  }
}

/**
 * Render a JSX string into the scene graph.
 * Works in both Node/Bun and the browser.
 */
async function renderJSX<Artwork>(
  services: DesignJSXServices<Artwork>,
  graph: SceneGraph,
  jsxString: string,
  options?: RenderJSXOptions
): Promise<RenderResult[]> {
  const helperWarnings: string[] = []
  const tree = evaluateDesignJSXTree(jsxString, helperWarnings)

  if (!tree) {
    throw new Error('JSX must return a Figma element (Frame, Text, etc)')
  }

  const results = await renderRoots(services, graph, tree, options)
  // After rendering, so an instance's component set drawn in the same JSX names its variants.
  // A helper called in a loop reports each ignored option once.
  const warnings = uniq([...unsupportedPropWarnings(graph, tree), ...helperWarnings])
  if (warnings.length > 0) results[0].warnings = warnings
  return results
}

/**
 * A Design JSX renderer bound to an engine. Rendering needs `services` for icons, inline
 * SVG, and layout; OpenPencil's engine provides them through `@open-pencil/core/design-jsx`.
 */
export function createDesignJSXRenderer<Artwork>(services: DesignJSXServices<Artwork>) {
  return {
    /** Render a Design JSX string into the graph, one result per top-level element. */
    renderJSX: (graph: SceneGraph, jsxString: string, options?: RenderJSXOptions) =>
      renderJSX(services, graph, jsxString, options),
    /** Render a tree built with the element functions into the graph. */
    renderTree: (graph: SceneGraph, tree: TreeNode, options?: RenderJSXOptions) =>
      renderTree(services, graph, tree, options)
  }
}

export type DesignJSXRenderer = ReturnType<typeof createDesignJSXRenderer>
