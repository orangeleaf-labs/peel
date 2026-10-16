import { afterEach, describe, expect, test } from 'bun:test'
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, realpath, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { registerTools, type MCPAgentSession } from '../src/tool/registration'

type MCPServer = Parameters<typeof registerTools>[0]

/** The stand-in implements only `registerTool`, so it is widened to the server type once, here. */
function asServer(double: object): MCPServer {
  return double as MCPServer
}

type Handler = (args: Record<string, unknown>) => Promise<unknown>

/** Registers the tools against a stand-in server and records what each call forwards to the app. */
function setup(mcpRoot: string | null, agentSession?: MCPAgentSession) {
  const handlers = new Map<string, Handler>()
  const forwarded: Array<Record<string, unknown>> = []
  const server = asServer({
    registerTool: (name: string, _options: unknown, handler: Handler) => {
      handlers.set(name, handler)
    },
    server: { getClientVersion: () => undefined }
  })
  registerTools(server, {
    policy: { scope: 'document', allowEval: false, disabledTools: [] },
    mcpRoot,
    agentSession,
    sendRPC: async (body) => {
      forwarded.push(body)
      return { ok: true, result: { svg: '<svg/>', base64: 'AA==', mimeType: 'application/pdf' } }
    }
  })
  async function call(name: string, args: Record<string, unknown>) {
    const handler = handlers.get(name)
    if (!handler) throw new Error(`${name} is not registered`)
    await handler(args)
    const body = forwarded.at(-1)
    const rpcArgs = body?.args as { args?: Record<string, unknown> } | undefined
    return rpcArgs?.args ?? {}
  }
  return { call, forwarded }
}

let root = ''

afterEach(async () => {
  if (root) await rm(root, { recursive: true, force: true })
  root = ''
})

describe('an export written to a path', () => {
  test('names the real file in the root to the app, which asks the user about it', async () => {
    root = join(await realpath(tmpdir()), `op-export-${randomUUID()}`)
    await mkdir(root, { recursive: true })
    const { call } = setup(root)

    const args = await call('export_svg', { path: 'shots/card.svg' })
    expect(args.path).toBe(join(root, 'shots/card.svg'))
    expect(await readFile(join(root, 'shots/card.svg'), 'utf8')).toBe('<svg/>')
  })

  test('without a root the path is not written, so the app is not asked about it', async () => {
    const { call } = setup(null)
    expect(await call('export_svg', { path: 'card.svg' })).not.toHaveProperty('path')
  })

  test('a PDF export, which this server never writes, keeps its arguments as sent', async () => {
    root = join(await realpath(tmpdir()), `op-export-${randomUUID()}`)
    await mkdir(root, { recursive: true })
    const { call } = setup(root)
    expect(await call('export_pdf', { path: 'card.pdf' })).toEqual({ path: 'card.pdf' })
  })
})

describe('a call that may ask the user', () => {
  test.each([
    ['save_file', {}],
    ['new_document', {}],
    ['close_file', { unsaved: 'save' }],
    ['update_settings', { settings: { autoSave: true } }]
  ])('%s names the agent session, so stopping that chat withdraws its dialog', async (name, args) => {
    root = join(await realpath(tmpdir()), `op-agent-${randomUUID()}`)
    await mkdir(root, { recursive: true })
    const { call, forwarded } = setup(root, { id: 'session-1', kind: 'acp' })
    await call(name, args)
    const body = forwarded.at(-1)
    expect(body?.command).toBe(name)
    expect(body?.args).toMatchObject({ agent: { session: 'session-1', kind: 'acp' } })
  })
})
