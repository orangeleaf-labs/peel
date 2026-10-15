import type { QuickJSWASMModule } from 'quickjs-emscripten-core'

/**
 * Authored and model-written Design JSX runs in QuickJS compiled to WebAssembly: an engine with
 * no DOM, network, storage, or Tauri IPC, and no way to reach the editor's objects. The window
 * itself runs under a content security policy that forbids `eval`, so this is also the only
 * place such code can run at all.
 */

export type IsolatedRunLimits = {
  timeoutMs: number
  memoryBytes: number
  stackBytes: number
  /** Longest completion value accepted, in UTF-16 code units. */
  outputLength: number
}

export const ISOLATED_RUN_LIMITS: IsolatedRunLimits = {
  timeoutMs: 2_000,
  memoryBytes: 64 * 1024 * 1024,
  stackBytes: 1024 * 1024,
  outputLength: 4_000_000
}

export const ISOLATED_TIMEOUT_MESSAGE = 'Design JSX execution timed out.'

let engine: Promise<QuickJSWASMModule> | undefined

/** Load the engine once; later calls share it. */
export function loadIsolatedEngine(): Promise<QuickJSWASMModule> {
  engine ??= Promise.all([
    import('quickjs-emscripten-core'),
    import('@jitl/quickjs-singlefile-mjs-release-sync')
  ]).then(([{ newQuickJSWASMModuleFromVariant }, { default: variant }]) =>
    newQuickJSWASMModuleFromVariant(variant)
  )
  return engine
}

function errorFrom(dumped: unknown): Error {
  if (dumped !== null && typeof dumped === 'object') {
    const { name, message } = dumped as { name?: unknown; message?: unknown }
    const text = typeof message === 'string' ? message : JSON.stringify(dumped)
    if (name === 'InternalError' && text === 'interrupted')
      return new Error(ISOLATED_TIMEOUT_MESSAGE)
    if (name === 'ReferenceError') return new ReferenceError(text)
    if (name === 'TypeError') return new TypeError(text)
    if (name === 'SyntaxError') return new SyntaxError(text)
    return new Error(text)
  }
  return new Error(String(dumped))
}

/**
 * Run `script` in a fresh QuickJS runtime and return its completion value, which must be a
 * string. The runtime is disposed afterwards, so nothing survives between runs.
 */
export function runIsolated(
  quickjs: QuickJSWASMModule,
  script: string,
  limits: IsolatedRunLimits = ISOLATED_RUN_LIMITS
): string {
  const runtime = quickjs.newRuntime()
  runtime.setMemoryLimit(limits.memoryBytes)
  runtime.setMaxStackSize(limits.stackBytes)
  const deadline = performance.now() + limits.timeoutMs
  runtime.setInterruptHandler(() => performance.now() > deadline)
  const context = runtime.newContext()
  try {
    const result = context.evalCode(script)
    if (result.error) {
      const dumped: unknown = context.dump(result.error)
      result.error.dispose()
      throw errorFrom(dumped)
    }
    const value: unknown = context.dump(result.value)
    result.value.dispose()
    if (typeof value !== 'string') throw new Error('Design JSX produced no output.')
    if (value.length > limits.outputLength) throw new Error('Design JSX output is too large.')
    return value
  } finally {
    context.dispose()
    runtime.dispose()
  }
}
