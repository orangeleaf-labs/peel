/**
 * How long the app waits for the user to allow an automation call that writes outside the
 * document, from when the app receives the call. Past it the call is denied whatever the dialog
 * shows, so an Allow can never land after the caller gave up. It stays below the 60 s request
 * timeout MCP SDK clients use by default, with room for the hops in between and the server's 10 s wait for the app to connect.
 */
export const AUTOMATION_APPROVAL_DEADLINE_MS = 45_000
/** The MCP SDK's default client request timeout (`DEFAULT_REQUEST_TIMEOUT_MSEC`). */
export const MCP_CLIENT_DEFAULT_REQUEST_TIMEOUT_MS = 60_000
/**
 * How long the MCP server and the CLI wait for the app to answer a command that may ask for
 * approval; it outlasts `AUTOMATION_APPROVAL_DEADLINE_MS`, so the caller hears the outcome.
 */
export const AUTOMATION_APPROVAL_RPC_TIMEOUT_MS = 90_000
/** Automation commands that may ask the user before they write outside the document. */
export const AUTOMATION_APPROVAL_COMMANDS: ReadonlySet<string> = new Set([
  'save_file',
  'close_file',
  'new_document',
  'update_settings',
  'eval',
  'tool'
])

/** How long a caller waits for an automation command: longer when it may ask the user. */
export function automationRPCTimeout(command: unknown, defaultMs: number): number {
  return typeof command === 'string' && AUTOMATION_APPROVAL_COMMANDS.has(command)
    ? Math.max(defaultMs, AUTOMATION_APPROVAL_RPC_TIMEOUT_MS)
    : defaultMs
}
