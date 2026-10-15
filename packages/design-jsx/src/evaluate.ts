import { mapValues } from 'es-toolkit'
import * as v from 'valibot'

import { buildComponent, type CompiledDesignJSX } from './compile'
import { designJSXHelpers } from './helpers'
import * as React from './mini-react'
import { resolveToTree, type TreeNode } from './tree'
import { designVar } from './vars'

/**
 * Turns a Design JSX string into its element tree, recording ignored helper options in
 * `warnings`. Every string the renderer, `jsxNodeFields`, and the diff tools evaluate goes
 * through the evaluator installed here.
 */
export type DesignJSXEvaluator = (jsx: string, warnings: string[]) => TreeNode | null

function evaluateWithFunction(jsx: string, warnings: string[]): TreeNode | null {
  return resolveToTree(React.createElement(buildComponent(jsx, warnings), null))
}

let evaluator: DesignJSXEvaluator = evaluateWithFunction

/**
 * Replace how Design JSX strings are evaluated, or restore the default with `null`. The
 * default runs compiled JSX with `new Function`; a host that forbids `eval`, or that must not
 * give authored code its own privileges, installs one that runs it in an isolated engine with
 * {@link isolatedDesignJSXScript} and {@link treeFromIsolatedDesignJSX}.
 */
export function setDesignJSXEvaluator(next: DesignJSXEvaluator | null): void {
  evaluator = next ?? evaluateWithFunction
}

/** Evaluate a Design JSX string with the installed evaluator. */
export function evaluateDesignJSXTree(jsx: string, warnings: string[] = []): TreeNode | null {
  return evaluator(jsx, warnings)
}

/** Key that marks a design variable in isolated output, where symbols cannot travel. */
const VARIABLE_KEY = '__openPencilVariable'
/** Key that marks a helper call in isolated output, replayed by the host. */
const HELPER_KEY = '__openPencilHelper'

const HELPER_NAMES = Object.keys(designJSXHelpers([]))

/**
 * A standalone script for an isolated JavaScript engine, such as QuickJS compiled to
 * WebAssembly. It defines nothing but plain data builders, runs the compiled JSX, and
 * completes with the element tree as a JSON string: elements are `{ type, props, children }`,
 * function components are already called, helpers are `{ __openPencilHelper, args }`, and
 * variables carry `__openPencilVariable`. The engine must expose no host objects.
 */
export function isolatedDesignJSXScript({ code }: CompiledDesignJSX): string {
  return `(() => {
  const createElement = (type, props, ...children) => {
    const flat = children.flat(Infinity)
    const merged = { ...(props ?? {}), children: flat.length > 0 ? flat : undefined }
    if (typeof type === 'function') return type(merged)
    return { type, props: merged }
  }
  const helper = (name) => (...args) => ({ ${HELPER_KEY}: name, args })
  const __helpers = Object.fromEntries(${JSON.stringify(HELPER_NAMES)}.map((name) => [name, helper(name)]))
  __helpers.__variableKey = ${JSON.stringify(VARIABLE_KEY)}
  const render = (function (React, __helpers) {
${code}
  })({ createElement }, __helpers)
  return JSON.stringify(render(), (key, value) => {
    if (typeof value === 'function') throw new TypeError('A Design JSX value cannot be a function.')
    if (typeof value === 'bigint' || typeof value === 'symbol') return undefined
    return value
  })
})()`
}

type PlainRecord = Record<string, unknown>

function isRecord(value: unknown): value is PlainRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function replayValue(value: unknown, helpers: Record<string, unknown>): unknown {
  if (Array.isArray(value)) return value.map((item) => replayValue(item, helpers))
  if (!isRecord(value)) return value
  if (typeof value[HELPER_KEY] === 'string' && Array.isArray(value.args)) {
    const name = value[HELPER_KEY]
    const helper = Object.hasOwn(helpers, name) ? helpers[name] : undefined
    if (typeof helper !== 'function') throw new TypeError(`Unknown Design JSX helper "${name}".`)
    return (helper as (...args: unknown[]) => unknown)(
      ...value.args.map((arg) => replayValue(arg, helpers))
    )
  }
  if (value[VARIABLE_KEY] === true) {
    const { [VARIABLE_KEY]: _, ...variable } = value
    return designVar({
      id: typeof variable.id === 'string' ? variable.id : undefined,
      name: typeof variable.name === 'string' ? variable.name : undefined,
      value: replayValue(variable.value, helpers) as never
    })
  }
  return mapValues(value, (entry) => replayValue(entry, helpers))
}

function replayElement(value: unknown, helpers: Record<string, unknown>): unknown {
  if (Array.isArray(value)) return value.map((item) => replayElement(item, helpers))
  if (!isRecord(value) || typeof value.type !== 'string' || !isRecord(value.props)) return value
  const { children, ...props } = value.props
  const replayedChildren = Array.isArray(children)
    ? children.map((child) => replayElement(child, helpers))
    : []
  return React.createElement(
    value.type,
    replayValue(props, helpers) as PlainRecord,
    ...(replayedChildren as React.ReactNode[])
  )
}

/**
 * The element tree from {@link isolatedDesignJSXScript}'s JSON, with helpers called and
 * variables rebuilt here, as `new Function` evaluation would have produced it.
 */
export function treeFromIsolatedDesignJSX(json: string, warnings: string[]): TreeNode | null {
  const parsed = v.parse(v.pipe(v.string(), v.parseJson()), json)
  return resolveToTree(replayElement(parsed, designJSXHelpers(warnings)))
}
