import { afterAll, beforeAll, describe, expect, test } from 'bun:test'

import { FigmaAPI } from '@open-pencil/core/figma-api'
import { ALL_TOOLS } from '@open-pencil/core/tools'
import {
  buildComponent,
  createElement,
  evaluateDesignJSXTree,
  resolveToTree,
  setDesignJSXEvaluator
} from '@open-pencil/design-jsx'
import { SceneGraph } from '@open-pencil/scene-graph'

import { evaluateDesignJSX } from '@/app/code/sandbox/evaluate'
import { installDesignJSXSandbox } from '@/app/code/sandbox/install'

import { expectDefined } from '#tests/helpers/assert'

beforeAll(installDesignJSXSandbox)
afterAll(() => setDesignJSXEvaluator(null))

/** What `new Function` evaluation, the renderer's default outside the app, makes of `jsx`. */
function evaluateWithFunction(jsx: string, warnings: string[] = []) {
  return resolveToTree(createElement(buildComponent(jsx, warnings), null))
}

describe('model-written Design JSX in the isolated engine', () => {
  test.each([
    '<Frame w={320} fill={solid("#fff")}><Text>Hello</Text></Frame>',
    '<Frame flex="row" gap={8}>{[1, 2, 3].map((n) => <Rect key={n} w={n * 10} h={10} />)}</Frame>',
    '<View effects={[dropShadow({ x: 0, y: 4, blur: 8, color: "#0003" })]} fill={linearGradient([["#f00", 0], ["#00f", 1]])} />',
    '<Frame fill={designVar("brand", "#ff5500")}><Text color={defineVars({ ink: "Ink" }).ink}>A</Text></Frame>',
    '<Switch.Root modelValue="On"><Switch.Thumb /></Switch.Root>',
    '<Rect name="One" />\n<Ellipse name="Two" />',
    '{(() => { const Card = ({ title }) => <Frame><Text>{title}</Text></Frame>; return <Card title="Hi" /> })()}'
  ])('builds the same tree as direct evaluation: %s', (jsx) => {
    const isolatedWarnings: string[] = []
    const directWarnings: string[] = []
    expect(evaluateDesignJSXTree(jsx, isolatedWarnings)).toEqual(
      evaluateWithFunction(jsx, directWarnings)
    )
    expect(isolatedWarnings).toEqual(directWarnings)
  })

  test('reports helper options it ignores, as direct evaluation does', () => {
    const warnings: string[] = []
    evaluateDesignJSXTree('<Frame fill={solid("#fff", { nonsense: 1 })} />', warnings)
    expect(warnings.length).toBeGreaterThan(0)
  })

  test('sees no host objects: window, fetch, timers, or Tauri IPC', () => {
    const tree = evaluateDesignJSXTree(
      '<Text>{[typeof window, typeof globalThis.fetch, typeof setTimeout, typeof globalThis.__TAURI_INTERNALS__, typeof XMLHttpRequest].join(",")}</Text>'
    )
    expect(tree?.children).toEqual(['undefined,undefined,undefined,undefined,undefined'])
  })

  test('stops a runaway loop instead of hanging the editor', () => {
    const started = performance.now()
    expect(() => evaluateDesignJSXTree('{(() => { while (true) {} })()}')).toThrow(
      'Design JSX execution timed out.'
    )
    expect(performance.now() - started).toBeLessThan(10_000)
  })

  test('the AI render tool builds layers through the isolated engine', async () => {
    const render = expectDefined(ALL_TOOLS.find((tool) => tool.name === 'render'))
    const graph = new SceneGraph()
    const figma = new FigmaAPI(graph)
    const result = (await render.execute(figma, {
      jsx: '<Frame name="Card" w={200} h={100} fill={solid("#ff0000")}><Text>{typeof fetch}</Text></Frame>'
    })) as { id: string }
    const card = expectDefined(graph.getNode(result.id))
    expect(card.name).toBe('Card')
    const text = expectDefined(graph.getNode(expectDefined(card.childIds[0])))
    expect(text.text).toBe('undefined')
  })
})

describe('authored Design JSX programs in the Code panel', () => {
  test('evaluates a program into inert data', async () => {
    expect(
      await evaluateDesignJSX('<Frame w={320} fill={solid("#fff")}><Text>Hello</Text></Frame>')
    ).toEqual({
      ok: true,
      roots: [
        {
          type: 'frame',
          props: { w: 320, fill: { __openPencilHelper: 'solid', args: ['#fff'] } },
          children: [{ type: 'text', props: {}, children: ['Hello'], source: ['expression', 1] }],
          source: ['expression', 1]
        }
      ],
      lineOffsets: { statements: 0, expression: 0 }
    })
  })

  test('cannot reach the network or the window', async () => {
    const fetched = await evaluateDesignJSX('<Frame>{fetch("https://probe.invalid")}</Frame>')
    expect(fetched.ok).toBe(false)
    const windowed = await evaluateDesignJSX('<Frame>{String(window.document)}</Frame>')
    expect(windowed.ok).toBe(false)
  })

  test('times out an infinite loop and enforces output limits', async () => {
    expect(await evaluateDesignJSX('(() => { while (true) {} })()', { timeoutMs: 100 })).toEqual({
      ok: false,
      error: 'Design JSX execution timed out.'
    })
    expect(await evaluateDesignJSX('<Text>{"x".repeat(100)}</Text>', { outputBytes: 20 })).toEqual({
      ok: false,
      error: 'Design JSX output is too large.'
    })
  })
})
