import { params } from '@nanostores/i18n'

import { i18n } from '#vue/i18n/create'

export const automationMessageDefaults = {
  toolAccessDescription:
    'Configure design tools independently for built-in AI and the local MCP server.',
  toolAccessTarget: 'Configure tool access for',
  builtInAI: 'Built-in AI',
  localMCP: 'Local MCP',
  restoreToolDefaults: 'Restore defaults',
  aiToolAccessDescription: 'Choose tools for the built-in AI.',
  mcpToolAccessDescription:
    'Choose tools advertised by the local server to connected agents and clients.',
  aiToolsNotice:
    'Changes apply to your next message. Tool switches are not a sandbox: enabled script tools can still perform other design operations.',
  mcpFailureNotInstalled: 'MCP server is not installed',
  mcpFailureNotInstalledHint:
    'To keep the OpenPencil download small, the MCP server is installed separately.',
  mcpFailureOutdated: 'MCP server does not match this version of OpenPencil',
  mcpFailureOutdatedHint: params(
    'The installed MCP server is {running}, and this version of OpenPencil needs {version}. The server is installed separately to keep the download small, so it does not update with the app.'
  ),
  mcpInstallByHand: 'Install it from a terminal, or copy a prompt that asks your agent to do it.',
  mcpCopyAgentPrompt: 'Copy prompt for your agent',
  mcpUpdating: 'Updating…',
  mcpFailurePermission: 'OpenPencil cannot start the MCP server',
  mcpFailurePermissionHint:
    'The system denied the command. Reinstall OpenPencil with its shell permissions, or start the server manually.',
  mcpFailureExited: 'MCP server stopped during startup',
  mcpFailureExitedHint: 'The process exited before it became ready.',
  mcpFailureTimeout: 'MCP server did not respond in time',
  mcpFailureTimeoutHint: 'It did not become ready within the startup timeout.',
  mcpFailureRejected: 'MCP server rejected the local connection',
  mcpFailureRejectedHint: 'Restart the MCP server to issue a new token.',
  mcpFailureMalformed: 'MCP server returned an unexpected response',
  mcpFailureMalformedHint:
    'Restart it. If this keeps happening, copy the details and report the problem.',
  mcpFailureUnreachable: 'MCP server is not reachable',
  mcpFailureUnreachableHint: params(
    'Nothing answers at {endpoint}. Restart the server; if another app uses this address, close it first.'
  ),
  mcpFailureUnknown: 'MCP server could not start',
  mcpFailureUnknownHint: 'Start it again, or check the diagnostic details below.',
  mcpFailureDetails: 'Details',
  mcpFailureCopy: 'Copy details',
  localServer: 'Local server',
  localServerDesktopOnly:
    'The local MCP server runs with the OpenPencil desktop app. In the browser, use WebMCP below.',
  webmcpDescription:
    'Let browser agents use this document directly, without a local MCP server or bearer token. Local server settings do not apply here.',
  browserAccess: 'Browser agent access',
  accessOff: 'Off',
  accessInspect: 'Inspect',
  accessEdit: 'Edit',
  accessOffDescription: 'No tools are exposed to browser agents.',
  accessInspectDescription: 'Agents can inspect the document but cannot change it.',
  accessEditDescription:
    'Agents can also edit existing properties, text, and variable values. Edits are undoable; creating or deleting content, scripts, and file access are excluded.',
  webmcpFailed: 'WebMCP could not start',
  webmcpUnsupported:
    'This browser does not expose WebMCP. Use a supported Chrome version and enable WebMCP testing, then relaunch the browser.',
  noMatchingTools: 'No tools match your search.',
  description: 'Monitor and restart the local MCP server used by agents and automation.',
  status: 'Status',
  port: 'Port',
  address: 'Address',
  version: 'Version',
  authentication: 'Require authentication',
  authenticationDescription:
    'Protect the localhost MCP endpoint with a bearer token. Disable only on a trusted machine. Restart the server to apply changes.',
  selectionScope: 'Share only the selection',
  selectionScopeDescription:
    'Let MCP clients read only the layers you select, with get_selection, get_node, get_page_tree, describe, and export_image, and no other tools. Restart the server to apply changes.',
  rootDirectory: 'MCP root directory',
  rootDirectoryDefault: 'Server default directory',
  chooseRootDirectory: 'Choose folder',
  useDefaultRoot: 'Use default',
  rootDirectoryDescription:
    'File tools are limited to this folder. Restart the MCP server to apply changes.',
  tools: 'Available tools',
  toolsEnabled: params('{enabled} of {total} enabled'),
  enableAllTools: 'Enable all',
  searchTools: 'Search tools',
  readOnlyTools: 'Read-only tools',
  sideEffectTools: 'Tools with side effects',
  toolsRestartNotice:
    'Restart the MCP server, then reconnect stdio clients, to apply tool availability changes.',
  externalRestartNotice:
    'This server is managed by another process. Restart that process to apply changes.',
  restart: 'Restart MCP server',
  externallyManaged: 'Managed externally',
  starting: 'Starting…',
  statusIdle: 'Not initialized',
  statusStarting: 'Starting',
  statusRunning: 'Running',
  statusStopped: 'Stopped',
  statusError: 'Error',
  writeApprovalTitle: 'Allow a write outside the document?',
  writeApprovalSave: params('An agent wants to save a document with {tool} to {target}.'),
  writeApprovalExport: params('An agent wants to export {format} with {tool} to {target}.'),
  writeApprovalSettings: params('An agent wants to change app settings with {tool}: {target}.'),
  writeApprovalWrite: params('An agent wants to write a file with {tool}: {target}.'),
  writeApprovalCode: params(
    'An agent wants to run a script with the app’s permissions using {tool}: {target}'
  ),
  writeApprovalUnknownTarget: params('An agent wants to write outside the document with {tool}.'),
  writeApprovalDenyHint: 'If you deny, the agent gets an error and nothing is written.',
  writeApprovalAllow: 'Allow',
  writeApprovalDeny: 'Deny'
} as const

export const automationMessages = i18n('automation', automationMessageDefaults)
