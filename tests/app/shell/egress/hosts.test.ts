import { describe, expect, test } from 'bun:test'
import { readFile } from 'node:fs/promises'

import * as v from 'valibot'

import { ALLOWED_HOSTS } from '#tests/helpers/egress/hosts'
import { shippedFiles } from '#tests/helpers/egress/shipped'
import { hostOf, urlHostsIn } from '#tests/helpers/egress/urls'
import { repoPath } from '#tests/helpers/paths'

const HOW_TO_ADD =
  'add the host to tests/helpers/egress/hosts.ts with its kind and reason, and list a network host in EGRESS.md'

/** Test files, stories, and fixtures name hosts that never ship. */
const NOT_SHIPPED = /(^|\/)(tests?|fixtures|__fixtures__)\/|\.(test|spec|stories)\.[cm]?[jt]sx?$/

/**
 * Rust unit tests share the file with the code; only what precedes them ships. This assumes the
 * first `#[cfg(test)]` is the trailing `mod tests`, as in every file under `desktop/src`.
 */
function shippedText(file: string, text: string): string {
  return file.endsWith('.rs') ? text.split('#[cfg(test)]')[0] : text
}

async function hardCodedHosts(): Promise<Map<string, string[]>> {
  const found = new Map<string, string[]>()
  for (const file of await shippedFiles()) {
    if (NOT_SHIPPED.test(file)) continue
    const text = shippedText(file, await readFile(repoPath(file), 'utf8'))
    for (const host of urlHostsIn(text)) found.set(host, [...(found.get(host) ?? []), file])
  }
  return found
}

const TauriConfig = v.object({
  app: v.object({ security: v.object({ csp: v.object({ 'connect-src': v.string() }) }) }),
  plugins: v.object({ updater: v.object({ endpoints: v.array(v.string()) }) })
})

async function tauriConfig() {
  const text = await readFile(repoPath('desktop/tauri.conf.json'), 'utf8')
  return v.parse(v.pipe(v.string(), v.parseJson(), TauriConfig), text)
}

/** Hosts in the `ALLOWED_*` lists of `desktop/src/egress.rs`, before its unit tests. */
async function proxyHosts(): Promise<string[]> {
  const source = shippedText('egress.rs', await readFile(repoPath('desktop/src/egress.rs'), 'utf8'))
  const lists = [...source.matchAll(/const ALLOWED_\w+:[^=]*=\s*&\[([\s\S]*?)\n\];/g)]
  return lists.flatMap(([, body]) =>
    [...body.matchAll(/"([^"]+)"/g)]
      .map(([, value]) => value)
      .filter((value) => !value.startsWith('/'))
  )
}

function urlHosts(values: string[]): string[] {
  return values.flatMap((value) => {
    const [, authority] = /^[a-z]+:\/\/([^/]+)/.exec(value) ?? []
    const host = authority ? hostOf(authority) : null
    return host ? [host] : []
  })
}

async function egressDocument(): Promise<string> {
  return readFile(repoPath('EGRESS.md'), 'utf8')
}

function unlistedNetworkHosts(hosts: string[], egress: string): string[] {
  return hosts.flatMap((host) => {
    const entry = ALLOWED_HOSTS[host]
    if (entry?.kind !== 'network') return [`${host}: not a network host in hosts.ts`]
    return egress.includes(`\`${host}\``) ? [] : [`${host}: missing from EGRESS.md`]
  })
}

describe('URL host extraction', () => {
  test.each([
    ['a literal URL', "fetch('https://evil.example/collect')", ['evil.example']],
    [
      'a host followed by a template path',
      `fetch(\`https://api.evil.example\${path}\`)`,
      ['api.evil.example']
    ],
    ['a host followed by a template port', `\`http://127.0.0.1:\${port}/mcp\``, ['127.0.0.1']],
    ['a templated host', `fetch(\`https://\${host}/x\`)`, []],
    ['a WebSocket URL', "new WebSocket('wss://socket.example.org/live')", ['socket.example.org']],
    ['an upper-case scheme', "'HTTPS://Loud.Example.COM/'", ['loud.example.com']]
  ])('finds %s', (_, text, hosts) => {
    expect(urlHostsIn(text)).toEqual(hosts)
  })
})

describe('hard-coded external hosts', () => {
  test('every host a shipped file names is allow-listed', async () => {
    const found = await hardCodedHosts()
    expect(found.size).toBeGreaterThan(10)
    const unlisted = [...found]
      .filter(([host]) => !(host in ALLOWED_HOSTS))
      .map(([host, files]) => `${host} in ${files.join(', ')}: ${HOW_TO_ADD}`)
    expect(unlisted).toEqual([])
  })

  test('every link and identifier entry is still named by a shipped file', async () => {
    const found = await hardCodedHosts()
    const stale = Object.entries(ALLOWED_HOSTS)
      .filter(([host, entry]) => entry.kind !== 'network' && !found.has(host))
      .map(([host]) => `${host}: no shipped file names it; remove it from hosts.ts`)
    expect(stale).toEqual([])
  })

  test('every network host is documented in EGRESS.md', async () => {
    const egress = await egressDocument()
    const network = Object.entries(ALLOWED_HOSTS)
      .filter(([, entry]) => entry.kind === 'network')
      .map(([host]) => host)
    expect(unlistedNetworkHosts(network, egress)).toEqual([])
  })

  test('every CSP connect-src host is a documented network host', async () => {
    const config = await tauriConfig()
    const hosts = urlHosts(config.app.security.csp['connect-src'].split(/\s+/))
    expect(hosts).toContain('api.anthropic.com')
    expect(unlistedNetworkHosts(hosts, await egressDocument())).toEqual([])
  })

  test('every updater endpoint host is a documented network host', async () => {
    const config = await tauriConfig()
    expect(
      unlistedNetworkHosts(urlHosts(config.plugins.updater.endpoints), await egressDocument())
    ).toEqual([])
  })

  test('every host the desktop proxy allows is a documented network host', async () => {
    const hosts = await proxyHosts()
    expect(hosts).toContain('api.anthropic.com')
    expect(hosts).toContain('cdn.jsdelivr.net')
    expect(hosts).toContain('www.figma.com')
    expect(unlistedNetworkHosts(hosts, await egressDocument())).toEqual([])
  })
})
