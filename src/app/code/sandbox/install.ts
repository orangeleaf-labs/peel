import {
  compileDesignJSX,
  explainSiblingError,
  isolatedDesignJSXScript,
  setDesignJSXEvaluator,
  treeFromIsolatedDesignJSX,
  type DesignJSXEvaluator
} from '@open-pencil/design-jsx'

import { loadIsolatedEngine, runIsolated } from '@/app/code/sandbox/quickjs'

const notReady: DesignJSXEvaluator = () => {
  throw new Error('The Design JSX sandbox is still loading. Try again.')
}

let ready: Promise<void> | undefined

/**
 * Route every Design JSX string the editor evaluates (AI `render`, `replace`, diff tools) into
 * the isolated engine instead of `new Function`. Until the engine has loaded, evaluation
 * fails rather than falling back, so nothing ever runs with the window's privileges.
 */
export function installDesignJSXSandbox(): Promise<void> {
  ready ??= (async () => {
    setDesignJSXEvaluator(notReady)
    const engine = await loadIsolatedEngine()
    setDesignJSXEvaluator((jsx, warnings) => {
      const compiled = compileDesignJSX(jsx)
      let json: string
      try {
        json = runIsolated(engine, isolatedDesignJSXScript(compiled))
      } catch (error) {
        throw compiled.siblings ? explainSiblingError(error) : error
      }
      return treeFromIsolatedDesignJSX(json, warnings)
    })
  })()
  return ready
}
