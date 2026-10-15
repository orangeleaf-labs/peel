import * as v from 'valibot'

import {
  DESIGN_JSX_ELEMENTS,
  DESIGN_JSX_HELPERS,
  transformDesignJSXProgram,
  type DesignJSXProgram
} from '@open-pencil/design-jsx'

import { loadIsolatedEngine, runIsolated, ISOLATED_RUN_LIMITS } from '@/app/code/sandbox/quickjs'
import { programScript } from '@/app/code/sandbox/script'
import {
  DESIGN_JSX_DEFAULT_TIMEOUT_MS,
  DESIGN_JSX_MAX_SOURCE_BYTES,
  resolveDesignJSXValidationLimits,
  type DesignJSXSandboxLimits,
  type DesignJSXSandboxResult
} from '@/app/code/sandbox/types'
import { validateDesignJSXOutput } from '@/app/code/sandbox/validate'

const ELEMENTS = Object.fromEntries(
  DESIGN_JSX_ELEMENTS.map(({ name, runtimeType }) => [name, runtimeType])
)
const HELPERS = DESIGN_JSX_HELPERS.map(({ name }) => name)

function sourceByteLength(source: string): number {
  return new TextEncoder().encode(source).byteLength
}

function failure(error: unknown): DesignJSXSandboxResult {
  return { ok: false, error: error instanceof Error ? error.message : String(error) }
}

/** Run an authored Design JSX program in the isolated engine and return its checked output. */
export async function evaluateDesignJSX(
  source: string,
  limits: DesignJSXSandboxLimits = {}
): Promise<DesignJSXSandboxResult> {
  const sourceBytes = limits.sourceBytes ?? DESIGN_JSX_MAX_SOURCE_BYTES
  if (sourceByteLength(source) > sourceBytes) {
    return { ok: false, error: 'Design JSX source is too large.' }
  }

  let program: DesignJSXProgram
  try {
    program = transformDesignJSXProgram(source)
  } catch (error) {
    return failure(error)
  }

  const validationLimits = resolveDesignJSXValidationLimits(limits)
  try {
    const engine = await loadIsolatedEngine()
    const json = runIsolated(
      engine,
      programScript(program.code, {
        elements: ELEMENTS,
        helpers: HELPERS,
        limits: validationLimits
      }),
      { ...ISOLATED_RUN_LIMITS, timeoutMs: limits.timeoutMs ?? DESIGN_JSX_DEFAULT_TIMEOUT_MS }
    )
    const value = v.parse(v.pipe(v.string(), v.parseJson()), json)
    const roots = validateDesignJSXOutput(value, validationLimits)
    return { ok: true, roots, lineOffsets: program.lineOffsets }
  } catch (error) {
    return failure(error)
  }
}
