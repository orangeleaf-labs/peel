import { strict as assert } from 'node:assert'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'

import { invokeNative, writeNativeFile } from '#tests/helpers/tauri/invoke'

const NAME = 'openpencil-native-test-scope.txt'
const DISCOVERY = join(homedir(), 'Library', 'Application Support', 'OpenPencil', 'mcp.json')
// `BaseDirectory.AppLocalData` in `@tauri-apps/api/path`; packages cannot load in the WebView callback.
const APP_LOCAL_DATA = 15
const REFUSED = /forbidden|not allowed/i

function appLocalDataDir(): Promise<string> {
  return invokeNative<string>('plugin:path|resolve_directory', { directory: APP_LOCAL_DATA })
}

/** The fs command's error, or null when it succeeded. */
function nativeError(command: string, args: Record<string, unknown>): Promise<string | null> {
  return invokeNative(command, args).then(() => null, String)
}

describe('desktop file scope', () => {
  it('writes and deletes only in the app cache', async () => {
    const appData = await appLocalDataDir()
    const cacheDir = join(appData, 'cache', 'native-test')
    const cached = join(cacheDir, NAME)
    const outsideCache = join(appData, NAME)
    try {
      assert.equal(
        await nativeError('plugin:fs|mkdir', { path: cacheDir, options: { recursive: true } }),
        null
      )
      assert.equal(await writeNativeFile(cached, 'cache'), null)
      assert.equal(await nativeError('plugin:fs|remove', { path: cached }), null)
      assert.equal(existsSync(cached), false, 'the cache file was not removed')

      const write = await writeNativeFile(outsideCache, 'data')
      assert.match(write ?? '', REFUSED, `${outsideCache} was writable`)
      const removal = await nativeError('plugin:fs|remove', { path: outsideCache })
      assert.match(removal ?? '', REFUSED, `${outsideCache} was removable`)
    } finally {
      rmSync(cacheDir, { recursive: true, force: true })
      rmSync(outsideCache, { force: true })
    }
  })

  it('refuses folders the user never picked', async () => {
    // A document folder is reachable only after the user picks a file there in a dialog,
    // opens one from the file manager, or did so in an earlier session.
    const documents = mkdtempSync(join(tmpdir(), 'openpencil-scope-'))
    const existing = join(documents, 'existing.fig')
    writeFileSync(existing, 'design')
    try {
      const write = await writeNativeFile(join(documents, 'design.fig'), 'design')
      assert.match(write ?? '', REFUSED, `${documents} was writable`)
      const read = await nativeError('plugin:fs|read_file', { path: existing })
      assert.match(read ?? '', REFUSED, `${existing} was readable`)
      const removal = await nativeError('plugin:fs|remove', { path: existing })
      assert.match(removal ?? '', REFUSED, `${existing} was removable`)
      assert.ok(existsSync(existing), 'the document was removed')
      const folder = join(documents, 'nested')
      const mkdir = await nativeError('plugin:fs|mkdir', { path: folder, options: {} })
      assert.match(mkdir ?? '', REFUSED, `${folder} could be created`)
    } finally {
      rmSync(documents, { recursive: true, force: true })
    }
  })

  describe('on macOS', () => {
    // The protected paths below are macOS ones; other platforms are not claimed.
    before(function () {
      if (process.platform !== 'darwin') this.skip()
    })

    it('refuses places where a written file would run', async () => {
      const refused = [
        join(homedir(), 'Library', 'LaunchAgents', NAME),
        join(homedir(), `.${NAME}`),
        join(homedir(), '.openpencil', 'mcp.json')
      ]
      // Only files this test would have created are removed afterwards.
      const created = refused.filter((path) => !existsSync(path))
      try {
        for (const path of refused) {
          const error = await writeNativeFile(path, 'not allowed')
          assert.match(error ?? '', REFUSED, `${path} was writable`)
        }
      } finally {
        for (const path of created) if (existsSync(path)) rmSync(path)
      }
    })

    it('refuses to open the MCP discovery file for writing', async () => {
      // The scope is checked before the file is opened, so a refusal does not depend on the file
      // existing; opening without truncating changes nothing even if the scope let it through.
      const opened = await invokeNative<number>('plugin:fs|open', {
        path: DISCOVERY,
        options: { write: true }
      }).then((rid) => rid, String)
      if (typeof opened === 'number') await invokeNative('plugin:resources|close', { rid: opened })
      assert.match(String(opened), REFUSED, `${DISCOVERY} opened for writing`)
    })
  })
})
