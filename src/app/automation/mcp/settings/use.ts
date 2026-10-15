import { onMounted } from 'vue'

import { mcpRootDirectory } from '@/app/automation/mcp/preferences'
import { refreshMCPRuntime, restartMCPRuntime } from '@/app/automation/mcp/runtime'
import { isTauri } from '@/app/tauri/env'

/**
 * Lets the user pick the folder MCP file tools work in. A Rust command, not the dialog plugin's
 * `open`: the MCP server works in this folder, the WebView never does, and `open` would add the
 * folder to the fs scope for good.
 */
export async function chooseMCPRootDirectory(): Promise<void> {
  if (!isTauri()) return
  const { invoke } = await import('@tauri-apps/api/core')
  const directory = await invoke<string | null>('pick_mcp_root_folder')
  if (directory) mcpRootDirectory.value = directory
}

export function useMCPSettings() {
  onMounted(() => {
    void refreshMCPRuntime()
  })

  function restart(): void {
    void restartMCPRuntime()
  }

  return { restart, chooseRootDirectory: chooseMCPRootDirectory }
}
