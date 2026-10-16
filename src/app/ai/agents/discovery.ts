import { computed, ref, shallowRef } from 'vue'

import { IS_TAURI } from '@open-pencil/core/constants'

import { MCP_EXECUTABLE, MCP_INSTALL_TARGET, MCP_PACKAGE_NAME } from '@/app/automation/mcp/failure'
import { detectUserAgent } from '@/app/tauri/command'

import {
  companionPackageManager,
  globalInstallCommand,
  isOutdatedCompanion,
  type PackageManager
} from './companions'
import { installCanvasBridge, lookupAgents, type AgentLookup } from './native'

/** What went wrong in the last lookup or installation. */
export type DiscoveryError =
  | 'lookup'
  | 'npm'
  | 'canvas-install'
  | 'canvas-start'
  /** npm's global folder needs administrator rights, which the app never asks for. */
  | 'npm-admin'

/**
 * Finds OpenPencil's MCP server companion on this computer and installs or updates it, so
 * agents the person runs themselves can reach the canvas.
 */
export function createAgentDiscovery(options: {
  enabled: boolean
  lookup: () => Promise<AgentLookup>
  installBridge?: (searchPath: string, manager: PackageManager) => Promise<void>
  restartBridge?: () => Promise<void>
}) {
  const snapshot = shallowRef<AgentLookup | null>(null)
  const scanning = ref(false)
  const installing = ref<'canvas' | null>(null)
  const error = ref<DiscoveryError | null>(null)
  let pending: Promise<void> | null = null
  const npmAvailable = computed(() => Boolean(snapshot.value?.executables.npm))
  /** A lookup has finished, so a later rescan can keep showing its results. */
  const checked = computed(() => snapshot.value !== null)
  // Checks read through functions so they see the snapshot of a rescan that just finished.
  function hasBridge(): boolean {
    return Boolean(snapshot.value?.executables[MCP_EXECUTABLE])
  }
  /** An installed MCP server whose version does not match the app. */
  function bridgeOutdated(): boolean {
    return hasBridge() && isOutdatedCompanion(snapshot.value?.versions[MCP_PACKAGE_NAME])
  }
  function canInstallWith(manager: PackageManager): boolean {
    return Boolean(snapshot.value?.executables[manager])
  }
  /** npm installs global packages where this user cannot write, so only an administrator can. */
  function npmNeedsAdmin(): boolean {
    return snapshot.value?.npmGlobalWritable === false
  }
  /**
   * The package manager that installed the server updates it, so the new copy replaces the
   * old one on PATH; another manager would install beside it and leave the old copy first.
   * A new install uses npm, or Bun when npm would need administrator rights.
   */
  function manager(): PackageManager {
    const path = snapshot.value?.executables[MCP_EXECUTABLE]
    if (path) return companionPackageManager(path)
    return npmNeedsAdmin() && canInstallWith('bun') ? 'bun' : 'npm'
  }
  /** Installing the server would need administrator rights. */
  function needsAdmin(): boolean {
    return manager() === 'npm' && npmNeedsAdmin()
  }
  const canvasBridgeAvailable = computed(hasBridge)
  const canvasBridgeOutdated = computed(bridgeOutdated)
  /** The command to install or update the server by hand, for the package manager that has it. */
  const canvasBridgeCommand = computed(() =>
    // Run by hand in the person's own terminal, which may find a manager the app cannot.
    globalInstallCommand(MCP_INSTALL_TARGET, manager(), {
      admin: needsAdmin(),
      windows: detectUserAgent().includes('Windows')
    })
  )
  const canvasBridgeNeedsAdmin = computed(needsAdmin)
  /** One click can install or update it, with the package manager that would run. */
  const canvasBridgeInstallable = computed(() => canInstallWith(manager()) && !needsAdmin())

  function refresh(force = false): Promise<void> {
    if (!options.enabled) return Promise.resolve()
    if (pending) return force ? pending.then(() => refresh()) : pending
    scanning.value = true
    error.value = null
    pending = options
      .lookup()
      .then((result) => {
        snapshot.value = result
        return undefined
      })
      .catch(() => {
        error.value = 'lookup'
      })
      .finally(() => {
        scanning.value = false
        pending = null
      })
    return pending
  }

  async function setupCanvasBridge(): Promise<void> {
    if (!options.enabled || installing.value || !snapshot.value) return
    let installed = hasBridge() && !bridgeOutdated()
    const packageManager = manager()
    if (!installed && !canInstallWith(packageManager)) {
      // A Bun copy the app cannot update leaves only the command run by hand.
      error.value = packageManager === 'npm' ? 'npm' : 'canvas-install'
      return
    }
    if (!installed && needsAdmin()) {
      error.value = 'npm-admin'
      return
    }
    installing.value = 'canvas'
    error.value = null
    try {
      if (!installed) {
        if (!options.installBridge) throw new Error('Canvas bridge setup is unavailable.')
        await options.installBridge(snapshot.value.searchPath, packageManager)
        await refresh(true)
        if (!hasBridge() || bridgeOutdated())
          throw new Error('A matching MCP server was not found.')
        installed = true
      }
      await options.restartBridge?.()
    } catch {
      error.value = installed ? 'canvas-start' : 'canvas-install'
    } finally {
      installing.value = null
    }
  }

  return {
    supported: options.enabled,
    scanning,
    checked,
    installing,
    error,
    npmAvailable,
    canvasBridgeAvailable,
    canvasBridgeOutdated,
    canvasBridgeCommand,
    canvasBridgeNeedsAdmin,
    canvasBridgeInstallable,
    setupCanvasBridge,
    refresh
  }
}

export const agentDiscovery = createAgentDiscovery({
  enabled: IS_TAURI,
  lookup: lookupAgents,
  installBridge: installCanvasBridge,
  async restartBridge() {
    const { restartMCPRuntime } = await import('@/app/automation/mcp/runtime')
    const result = await restartMCPRuntime()
    if (!result.ok) throw result.error
  }
})
