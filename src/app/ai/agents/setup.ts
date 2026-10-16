import { computed, toValue, watch, type MaybeRefOrGetter } from 'vue'

import { MCP_INSTALL_COMMAND } from '@/app/automation/mcp/failure'

import { agentDiscovery, type DiscoveryError } from './discovery'

type AgentDiscovery = typeof agentDiscovery

/** What setup knows about OpenPencil's MCP server, for Settings → MCP. */
export interface MCPServerSetupState {
  /** False where the app cannot install companions, so only manual instructions apply. */
  supported: boolean
  /** A check has finished, so a later one keeps showing its results. */
  checked: boolean
  /** OpenPencil's MCP server, through which agents reach the canvas. */
  bridge: boolean
  /** The installed MCP server does not match this app's version. */
  bridgeOutdated: boolean
  /** Installs or updates the MCP server by hand. */
  bridgeCommand: string
  /** npm, which one-click installation runs. */
  npm: boolean
  /** Installing the MCP server needs administrator rights; absent means no. */
  bridgeNeedsAdmin?: boolean
  /**
   * One click can install or update the MCP server with the package manager that would run,
   * which may be Bun without npm; absent means npm decides.
   */
  bridgeInstallable?: boolean
  installingBridge: boolean
  error: DiscoveryError | null
}

/** An OpenPencil companion as setup presents it, with the one-click fix that applies. */
export interface CompanionCheck {
  /** Installed and matching this app. */
  ready: boolean
  outdated: boolean
  installing: boolean
  /** Absent once ready, and where one-click installation cannot run or needs administrator rights. */
  action: 'install' | 'update' | null
}

/** Why setup cannot finish on its own, in the order the person should address it. */
export type SetupProblem =
  | 'needs-npm'
  | 'needs-admin'
  | 'install-failed'
  | 'mcp-start-failed'
  | 'lookup-failed'

function companionCheck(
  installed: boolean,
  outdated: boolean,
  installing: boolean,
  npm: boolean
): CompanionCheck {
  const ready = installed && !outdated
  if (ready || !npm) return { ready, outdated, installing, action: null }
  return { ready, outdated, installing, action: outdated ? 'update' : 'install' }
}

/** One-click availability: what discovery reports, or npm without administrator rights. */
function oneClickInstallable(
  installable: boolean | undefined,
  npm: boolean,
  admin: boolean
): boolean {
  return installable ?? (npm && !admin)
}

function setupProblem(
  error: DiscoveryError | null,
  needsNpm: boolean,
  needsAdmin: boolean
): SetupProblem | null {
  if (error === 'npm' || needsNpm) return 'needs-npm'
  if (error === 'npm-admin' || needsAdmin) return 'needs-admin'
  if (error === 'canvas-install') return 'install-failed'
  if (error === 'canvas-start') return 'mcp-start-failed'
  if (error === 'lookup') return 'lookup-failed'
  return null
}

/** The MCP server's setup: the one-click fix, and the command for when one click cannot help. */
export interface MCPServerSetupView {
  bridge: CompanionCheck
  problem: SetupProblem | null
  /** Installs the server by hand, by the person or their agent, when one click cannot. */
  manualCommand: string | null
}

export function mcpServerSetupView(setup: MCPServerSetupState): MCPServerSetupView {
  const admin = setup.bridgeNeedsAdmin === true
  const installable =
    setup.supported && oneClickInstallable(setup.bridgeInstallable, setup.npm, admin)
  const bridge = companionCheck(
    setup.bridge,
    setup.bridgeOutdated,
    setup.installingBridge,
    installable
  )
  const oneClick = installable && setup.error !== 'canvas-install'
  let manualCommand: string | null = null
  if (!setup.supported) manualCommand = MCP_INSTALL_COMMAND
  else if (setup.checked && !bridge.ready && !oneClick) manualCommand = setup.bridgeCommand
  return {
    bridge,
    // Where the app cannot install at all, npm and install problems are not the person's to fix.
    problem: setup.supported
      ? setupProblem(
          setup.error,
          setup.checked && !setup.npm && !bridge.ready && !installable && !admin,
          setup.checked && admin && !bridge.ready
        )
      : null,
    manualCommand
  }
}

function mcpServerSetup(discovery: AgentDiscovery): MCPServerSetupState {
  return {
    supported: discovery.supported,
    checked: discovery.checked.value,
    bridge: discovery.canvasBridgeAvailable.value,
    bridgeOutdated: discovery.canvasBridgeOutdated.value,
    bridgeCommand: discovery.canvasBridgeCommand.value,
    npm: discovery.npmAvailable.value,
    bridgeNeedsAdmin: discovery.canvasBridgeNeedsAdmin.value,
    bridgeInstallable: discovery.canvasBridgeInstallable.value,
    installingBridge: discovery.installing.value === 'canvas',
    error: discovery.error.value
  }
}

/**
 * The MCP server's setup while `active`, checked each time it becomes active, so Settings → MCP
 * can install or update the server with one click.
 */
export function useMCPServerSetup(
  active: MaybeRefOrGetter<boolean>,
  discovery: AgentDiscovery = agentDiscovery
) {
  watch(
    () => toValue(active),
    (on) => {
      if (on) void discovery.refresh(true)
    },
    { immediate: true }
  )
  return {
    state: computed(() => mcpServerSetup(discovery)),
    install: () => discovery.setupCanvasBridge(),
    check: () => discovery.refresh(true)
  }
}
