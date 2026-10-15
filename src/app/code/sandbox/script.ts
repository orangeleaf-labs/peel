import type { DesignJSXValidationLimits } from '@/app/code/sandbox/types'

/**
 * The runtime a Design JSX program runs in, as plain JavaScript for the isolated engine. It
 * builds inert element data, replaces helpers with descriptors the host replays, and checks
 * the output against `limits` before it leaves the engine.
 */
const runtimeSource = String.raw`
  const utf8Length = (text) => {
    let bytes = 0
    for (const char of text) {
      const point = char.codePointAt(0)
      bytes += point < 0x80 ? 1 : point < 0x800 ? 2 : point < 0x10000 ? 3 : 4
    }
    return bytes
  }
  const normalizeChildren = (children) => children.flat(Infinity).filter((child) => child != null && child !== false)
  const __fragment = ''
  const __h = (type, props, ...children) => {
    const { __source, __self, ...normalizedProps } = props == null ? {} : props
    const normalizedChildren = normalizeChildren(children)
    if (typeof type === 'function') return type({ ...normalizedProps, children: normalizedChildren })
    if (type === __fragment) return normalizedChildren
    const element = { type, props: normalizedProps, children: normalizedChildren }
    if (__source && typeof __source.lineNumber === 'number') element.source = [String(__source.fileName), __source.lineNumber]
    return element
  }
  const helper = (name) => (...args) => ({ __openPencilHelper: name, args })
  const helperRuntime = (name) => {
    if (name === 'defineVars') return (vars) => Object.fromEntries(Object.entries(vars).map(([key, value]) => [key, { __openPencilHelper: 'designVar', args: [value] }]))
    return helper(name)
  }
  // A dotted element such as Button.Root is a member of its namespace, as JSX reads the tag.
  const tags = {}
  for (const [name, type] of Object.entries(elements)) {
    const [space, member] = name.split('.')
    if (member === undefined) tags[name] = type
    else (tags[space] ??= {})[member] = type
  }
  const names = Object.keys(tags)
  const helpers = Object.fromEntries(helperNames.map((name) => [name, helperRuntime(name)]))
  const validate = (value, depth = 0, state = { elements: 0, bytes: 0 }) => {
    if (depth > limits.depth) throw new Error('Design JSX output is too deeply nested.')
    if (value === null) {
      state.bytes += 4
      if (state.bytes > limits.outputBytes) throw new Error('Design JSX output is too large.')
      return state
    }
    if (typeof value === 'boolean') {
      state.bytes += value ? 4 : 5
      if (state.bytes > limits.outputBytes) throw new Error('Design JSX output is too large.')
      return state
    }
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) throw new Error('Design JSX output contains an invalid number.')
      state.bytes += 8
      if (state.bytes > limits.outputBytes) throw new Error('Design JSX output is too large.')
      return state
    }
    if (typeof value === 'string') {
      if (value.length > limits.stringLength) throw new Error('Design JSX output contains a string that is too long.')
      state.bytes += utf8Length(value)
      if (state.bytes > limits.outputBytes) throw new Error('Design JSX output is too large.')
      return state
    }
    if (Array.isArray(value)) {
      state.bytes += 2 + Math.max(0, value.length - 1)
      if (state.bytes > limits.outputBytes) throw new Error('Design JSX output is too large.')
      if (value.length > limits.arrayLength) throw new Error('Design JSX output contains an array that is too long.')
      for (const item of value) validate(item, depth + 1, state)
      return state
    }
    if (typeof value !== 'object') throw new Error('Design JSX output contains an unsupported value.')
    const keys = Object.keys(value)
    state.bytes += 2 + Math.max(0, keys.length - 1)
    if (state.bytes > limits.outputBytes) throw new Error('Design JSX output is too large.')
    if (keys.length > limits.objectKeys) throw new Error('Design JSX output contains too many object properties.')
    if ('type' in value && 'props' in value && 'children' in value && ++state.elements > limits.elements) throw new Error('Design JSX output has too many elements.')
    for (const key of keys) {
      if (key === '__proto__' || key === 'prototype' || key === 'constructor') throw new Error('Design JSX output contains a blocked property.')
      state.bytes += key.length
      if (state.bytes > limits.outputBytes) throw new Error('Design JSX output is too large.')
      validate(value[key], depth + 1, state)
    }
    return state
  }
`

export type ProgramScriptOptions = {
  elements: Record<string, string>
  helpers: string[]
  limits: DesignJSXValidationLimits
}

/**
 * A script whose completion value is the program's output as JSON. `code` is a transformed
 * Design JSX program body; it sees only the element tags, the helper descriptors, `__h`, and
 * `__fragment`, because the engine that runs the script exposes no host objects.
 */
export function programScript(code: string, { elements, helpers, limits }: ProgramScriptOptions) {
  return `(() => {
  const elements = ${JSON.stringify(elements)}
  const helperNames = ${JSON.stringify(helpers)}
  const limits = ${JSON.stringify(limits)}
${runtimeSource}
  const run = new Function(...['__h', '__fragment', ...names, ...helperNames], ${JSON.stringify(code)})
  const value = run(__h, __fragment, ...names.map((name) => tags[name]), ...helperNames.map((name) => helpers[name]))
  validate(value)
  return JSON.stringify(value)
})()`
}
