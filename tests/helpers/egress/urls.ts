/**
 * The authority of an absolute HTTP(S) or WebSocket URL, up to its path, query, fragment, or a
 * template placeholder (`${`), so `https://${host}` yields an empty authority.
 */
export const URL_AUTHORITY = /\b(?:https?|wss?):\/\/([^\s/?#'"`<>()[\]{}\\,;|$]*)/gi

/** A host name, IPv4 address, or wildcard origin pattern such as `*.example.com`. */
const HOST_NAME = /^[a-z0-9*]([a-z0-9*.-]*[a-z0-9])?$/

/** The host a URL names, or null for a templated or elided one such as `https://${host}`. */
export function hostOf(authority: string): string | null {
  const host = (authority.split('@').at(-1) ?? '').replace(/:[^:]*$/, '').toLowerCase()
  const name = host.replace(/\.$/, '')
  return HOST_NAME.test(name) ? name : null
}

/** Every host named by an absolute URL in `text`. */
export function urlHostsIn(text: string): string[] {
  return [...text.matchAll(URL_AUTHORITY)].flatMap(([, authority]) => {
    const host = hostOf(authority)
    return host ? [host] : []
  })
}
