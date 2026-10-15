import { transform } from 'sucrase'

import { REKA_ELEMENTS } from './behaviours'
import { designJSXHelpers } from './helpers'
import * as React from './mini-react'

/** `const Switch = { Root: 'Switch.Root', … }`: each Reka namespace as element types. */
const REKA_ALIASES = Object.entries(REKA_ELEMENTS)
  .map(
    ([namespace, parts]) =>
      `const ${namespace} = ${JSON.stringify(
        Object.fromEntries(Object.keys(parts).map((part) => [part, `${namespace}.${part}`]))
      )}`
  )
  .join('\n')

function stripHTMLComments(jsxString: string): string {
  return jsxString.replace(/<!--[\s\S]*?-->/g, '')
}

/** A Design JSX string compiled to a function body taking `React` and `__helpers`. */
export interface CompiledDesignJSX {
  /** Returns a `__render` function whose result is the element tree. */
  code: string
  /** The source was several sibling elements, wrapped in a fragment to compile. */
  siblings: boolean
}

const PRELUDE = `
    const __h = React.createElement
    const __frag = ''
    const Frame = 'frame', Text = 'text', Rectangle = 'rectangle', Ellipse = 'ellipse'
    const Line = 'line', Star = 'star', Polygon = 'polygon', Vector = 'vector'
    const Group = 'group', Section = 'section', View = 'frame', Rect = 'rectangle'
    const Component = 'component', ComponentSet = 'component-set', Instance = 'instance'
    const Span = 'text-span', Paragraph = 'text-paragraph'
    const Icon = 'icon'
    const svg = 'svg'
    ${REKA_ALIASES}
    const dropShadow = __helpers.dropShadow
    const innerShadow = __helpers.innerShadow
    const layerBlur = __helpers.layerBlur
    const backgroundBlur = __helpers.backgroundBlur
    const foregroundBlur = __helpers.foregroundBlur
    const solid = __helpers.solid
    const shader = __helpers.shader
    const gradient = __helpers.gradient
    const linearGradient = __helpers.linearGradient
    const radialGradient = __helpers.radialGradient
    const angularGradient = __helpers.angularGradient
    const diamondGradient = __helpers.diamondGradient
    // An isolated engine names variables with a string key, since symbols do not cross it.
    const __varSymbol = __helpers.__variableKey ?? Symbol.for('open-pencil.variable')
    const designVar = (def, value) => typeof def === 'string'
      ? ({ [__varSymbol]: true, id: def, name: def, value })
      : ({ [__varSymbol]: true, id: def.id, name: def.name ?? def.id ?? '', value: def.value })
    const defineVars = (vars) => Object.fromEntries(
      Object.entries(vars).map(([key, def]) => [key, designVar(def)])
    )
`

const TRANSFORM_OPTIONS = {
  transforms: ['typescript', 'jsx'] as Array<'typescript' | 'jsx'>,
  jsxPragma: '__h',
  jsxFragmentPragma: '__frag',
  production: true
}

/**
 * Compile a JSX string with sucrase, without running it. Any JavaScript engine can run the
 * result: `new Function('React', '__helpers', code)` here, or an isolated engine in a host
 * whose content security policy forbids `eval`.
 */
export function compileDesignJSX(jsxString: string): CompiledDesignJSX {
  const trimmed = stripHTMLComments(jsxString).trim()
  try {
    const { code } = transform(
      `${PRELUDE}\nreturn function __render() { return ${trimmed} }`,
      TRANSFORM_OPTIONS
    )
    return { code, siblings: false }
  } catch {
    const { code } = transform(
      `${PRELUDE}\nreturn function __render() { return <>${trimmed}</> }`,
      TRANSFORM_OPTIONS
    )
    return { code, siblings: true }
  }
}

/**
 * Siblings are wrapped in a fragment, where a statement such as `const` is only text, so a
 * name it meant to declare is undefined where the JSX uses it. An undefined name can also
 * be a plain mistake, so the hint says when it applies.
 */
export function explainSiblingError(error: unknown): unknown {
  if (!(error instanceof ReferenceError)) return error
  return new Error(
    `${error.message}. If a statement before the JSX, such as \`const\`, declares it, ` +
      'that statement does not run: a JSX string is one expression. Compute values inside ' +
      'it instead, for example ' +
      '`{(() => { const days = […]; return days.map((day) => <Text>{day}</Text>) })()}`.',
    { cause: error }
  )
}

/**
 * Build a component function from a JSX string using sucrase.
 * Works in both Node/Bun and the browser (no native bindings).
 */
export function buildComponent(jsxString: string, warnings: string[] = []): React.ComponentType {
  const { code, siblings } = compileDesignJSX(jsxString)
  // eslint-disable-next-line typescript-eslint/no-implied-eval -- sucrase output must be evaluated at runtime
  const component = new Function('React', '__helpers', code)(
    React,
    designJSXHelpers(warnings)
  ) as React.ComponentType
  if (!siblings) return component
  return (props) => {
    try {
      return component(props)
    } catch (error) {
      throw explainSiblingError(error)
    }
  }
}
