import { describe, expect, test, mock } from 'bun:test'

import { createAgentDiscovery } from '@/app/ai/agents/discovery'
import type { AgentLookup } from '@/app/ai/agents/native'
import { createDeferred } from '@/app/runtime/deferred'

// An installed MCP server reports the version of the app under test, as a matching one does.
function lookup(...commands: string[]): AgentLookup {
  return {
    searchPath: '/test/bin',
    versions: commands.includes('openpencil-mcp-http') ? { '@open-pencil/mcp': '0.0.0' } : {},
    executables: Object.fromEntries(commands.map((command) => [command, `/test/bin/${command}`]))
  }
}

describe('MCP server discovery', () => {
  test('installs the canvas companion once, discovers it, and restarts the bridge', async () => {
    let installed = false
    const pending = createDeferred<undefined>()
    const installBridge = mock(async () => {
      await pending.promise
      installed = true
    })
    const restartBridge = mock(async () => undefined)
    const discovery = createAgentDiscovery({
      enabled: true,
      lookup: async () => lookup('npm', ...(installed ? ['openpencil-mcp-http'] : [])),
      installBridge,
      restartBridge
    })
    await discovery.refresh()
    expect(installBridge).not.toHaveBeenCalled()
    const setup = discovery.setupCanvasBridge()
    await discovery.setupCanvasBridge()
    expect(installBridge).toHaveBeenCalledTimes(1)
    pending.resolve(undefined)
    await setup
    expect(discovery.canvasBridgeAvailable.value).toBe(true)
    expect(restartBridge).toHaveBeenCalledTimes(1)
    expect(discovery.error.value).toBeNull()
  })

  test('updates a server installed with Bun through Bun, even without npm', async () => {
    let version = '0.15.1'
    const installBridge = mock(async () => {
      version = '0.0.0-test'
    })
    const discovery = createAgentDiscovery({
      enabled: true,
      lookup: async () => ({
        searchPath: '/home/test/.bun/bin',
        versions: { '@open-pencil/mcp': version },
        executables: {
          bun: '/home/test/.bun/bin/bun',
          'openpencil-mcp-http': '/home/test/.bun/bin/openpencil-mcp-http'
        }
      }),
      installBridge,
      restartBridge: async () => undefined
    })
    await discovery.refresh()
    expect(discovery.canvasBridgeOutdated.value).toBe(true)
    await discovery.setupCanvasBridge()
    // npm would install beside the Bun copy, which stays first on PATH.
    expect(installBridge).toHaveBeenCalledWith('/home/test/.bun/bin', 'bun')
    expect(discovery.error.value).toBeNull()
  })

  test('installs a new server with Bun when npm would need administrator rights', async () => {
    const installBridge = mock(async () => undefined)
    const discovery = createAgentDiscovery({
      enabled: true,
      lookup: async () => ({ ...lookup('npm', 'bun'), npmGlobalWritable: false }),
      installBridge,
      restartBridge: async () => undefined
    })
    await discovery.refresh()
    expect(discovery.canvasBridgeNeedsAdmin.value).toBe(false)
    await discovery.setupCanvasBridge()
    expect(installBridge).toHaveBeenCalledWith('/test/bin', 'bun')
  })

  test('never runs an npm install that needs administrator rights', async () => {
    const installBridge = mock(async () => undefined)
    const discovery = createAgentDiscovery({
      enabled: true,
      lookup: async () => ({ ...lookup('npm'), npmGlobalWritable: false }),
      installBridge,
      restartBridge: async () => undefined
    })
    await discovery.refresh()
    expect(discovery.canvasBridgeNeedsAdmin.value).toBe(true)
    // Outside Windows the command an administrator runs goes through sudo.
    expect(discovery.canvasBridgeCommand.value).toStartWith('sudo npm i -g @open-pencil/mcp@')
    await discovery.setupCanvasBridge()
    expect(installBridge).not.toHaveBeenCalled()
    expect(discovery.error.value).toBe('npm-admin')
  })

  test('retries bridge startup without reinstalling a successfully installed companion', async () => {
    const installBridge = mock(async () => undefined)
    const restartBridge = mock(async (): Promise<void> => {
      throw new Error('Cannot start')
    })
    const discovery = createAgentDiscovery({
      enabled: true,
      lookup: async () => lookup('openpencil-mcp-http'),
      installBridge,
      restartBridge
    })
    await discovery.refresh()
    await discovery.setupCanvasBridge()
    expect(discovery.error.value).toBe('canvas-start')
    restartBridge.mockImplementation(async () => undefined)
    await discovery.setupCanvasBridge()
    expect(installBridge).not.toHaveBeenCalled()
    expect(discovery.error.value).toBeNull()
  })

  test('browser discovery performs no native operations', async () => {
    const scan = mock(async () => lookup('npm'))
    const installBridge = mock(async () => undefined)
    const discovery = createAgentDiscovery({ enabled: false, lookup: scan, installBridge })
    await discovery.refresh()
    await discovery.setupCanvasBridge()
    expect(scan).not.toHaveBeenCalled()
    expect(installBridge).not.toHaveBeenCalled()
    expect(discovery.checked.value).toBe(false)
  })

  test('deduplicates concurrent scans and notices removals on refresh', async () => {
    const pending = createDeferred<AgentLookup>()
    const scan = mock(() => pending.promise)
    const discovery = createAgentDiscovery({ enabled: true, lookup: scan })
    const first = discovery.refresh()
    const second = discovery.refresh()
    expect(scan).toHaveBeenCalledTimes(1)
    pending.resolve(lookup('openpencil-mcp-http'))
    await Promise.all([first, second])
    expect(discovery.canvasBridgeAvailable.value).toBe(true)
    scan.mockImplementation(async () => lookup())
    await discovery.refresh()
    expect(discovery.canvasBridgeAvailable.value).toBe(false)
  })

  test('needs npm and reports a failed install without raw errors', async () => {
    const withoutNpm = createAgentDiscovery({
      enabled: true,
      lookup: async () => lookup(),
      installBridge: async () => undefined
    })
    await withoutNpm.refresh()
    await withoutNpm.setupCanvasBridge()
    expect(withoutNpm.error.value).toBe('npm')
    const failing = createAgentDiscovery({
      enabled: true,
      lookup: async () => lookup('npm'),
      installBridge: async () => {
        throw new Error('private npm details')
      }
    })
    await failing.refresh()
    await failing.setupCanvasBridge()
    expect(failing.error.value).toBe('canvas-install')
    expect(failing.installing.value).toBeNull()
  })

  test('a failed scan preserves the last successful discovery and allows retry', async () => {
    const scan = mock(async () => lookup('openpencil-mcp-http'))
    const discovery = createAgentDiscovery({ enabled: true, lookup: scan })
    await discovery.refresh()
    scan.mockImplementation(async () => {
      throw new Error('unavailable')
    })
    await discovery.refresh()
    expect(discovery.error.value).toBe('lookup')
    expect(discovery.scanning.value).toBe(false)
    expect(discovery.canvasBridgeAvailable.value).toBe(true)
    scan.mockImplementation(async () => lookup('openpencil-mcp-http'))
    await discovery.refresh()
    expect(discovery.error.value).toBeNull()
  })

  test('never updates a Bun copy through npm, which would leave it first on the path', async () => {
    const installBridge = mock(async () => undefined)
    const restartBridge = mock(async () => undefined)
    const discovery = createAgentDiscovery({
      enabled: true,
      lookup: async () => ({
        searchPath: '/test/bin',
        executables: { npm: '/test/bin/npm', 'openpencil-mcp-http': '/home/me/.bun/bin/mcp' },
        versions: { '@open-pencil/mcp': '0.12.0' }
      }),
      installBridge,
      restartBridge
    })
    await discovery.refresh()
    // The app cannot find Bun, but the person's terminal may; the command keeps Bun.
    expect(discovery.canvasBridgeCommand.value).toStartWith('bun add -g @open-pencil/mcp@')
    expect(discovery.canvasBridgeInstallable.value).toBe(false)
    await discovery.setupCanvasBridge()
    expect(installBridge).not.toHaveBeenCalled()
    expect(restartBridge).not.toHaveBeenCalled()
    expect(discovery.error.value).toBe('canvas-install')
  })
})
