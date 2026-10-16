import { afterEach, expect, test } from 'bun:test'

import type { Channel } from '@tauri-apps/api/core'

import { installCanvasBridge, lookupAgents } from '@/app/ai/agents/native'
import { MCP_INSTALL_TARGET } from '@/app/automation/mcp/failure'
import { createDeferred } from '@/app/runtime/deferred'

import { clearTauriMocks, mockTauriIPC } from '#tests/helpers/tauri/mocks'

afterEach(clearTauriMocks)

test('validates native discovery responses', async () => {
  await mockTauriIPC((command) => {
    expect(command).toBe('agent_lookup')
    return {
      executables: { 'openpencil-mcp-http': '/bin/openpencil-mcp-http', npm: null },
      versions: { '@open-pencil/mcp': '0.15.1' },
      searchPath: '/bin'
    }
  })
  const lookup = await lookupAgents()
  expect(lookup.executables['openpencil-mcp-http']).toBe('/bin/openpencil-mcp-http')
  expect(lookup.versions['@open-pencil/mcp']).toBe('0.15.1')
  await mockTauriIPC(() => ({ executables: { npm: true }, versions: {}, searchPath: '/bin' }))
  await expect(lookupAgents()).rejects.toThrow()
})

test.each([0, 1])('installs the MCP server and handles exit code %i', async (code) => {
  const commands: string[] = []
  await mockTauriIPC((command, args) => {
    commands.push(command)
    expect(command).toBe('plugin:shell|spawn')
    const spawn = args as {
      program: string
      args: string[]
      options: { env: { PATH: string } }
      onEvent: Channel
    }
    expect(spawn.program).toBe('npm')
    expect(spawn.args).toEqual([
      'install',
      '--global',
      MCP_INSTALL_TARGET,
      '--registry=https://registry.npmjs.org'
    ])
    expect(spawn.options.env.PATH).toBe('/agents/bin')
    queueMicrotask(() =>
      spawn.onEvent.onmessage({ event: 'Terminated', payload: { code, signal: null } })
    )
    return 42
  })
  const installation = installCanvasBridge('/agents/bin')
  if (code === 0) await installation
  else await expect(installation).rejects.toThrow('Installation failed.')
  expect(commands).toEqual(['plugin:shell|spawn'])
})

test('cleans up an installer that reports an error before its process handle arrives', async () => {
  const spawned = createDeferred<number>()
  const killed = createDeferred<undefined>()
  await mockTauriIPC((command, args) => {
    if (command === 'plugin:shell|kill') {
      expect(args).toMatchObject({ pid: 42 })
      killed.resolve(undefined)
      return
    }
    expect(command).toBe('plugin:shell|spawn')
    const { onEvent } = args as { onEvent: Channel }
    queueMicrotask(() => onEvent.onmessage({ event: 'Error', payload: 'private npm details' }))
    return spawned.promise
  })
  await expect(installCanvasBridge('/bin')).rejects.toThrow('Installation failed.')
  spawned.resolve(42)
  await killed.promise
})
