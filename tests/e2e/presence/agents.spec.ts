import { expect, test, useEditorSetup } from '#tests/e2e/fixtures'

const editor = useEditorSetup('/?test')

test('an MCP session shows as an agent at the layers it touches, to follow and rename', async () => {
  const { page } = editor
  const nodeId = await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    return store.graph.createNode('FRAME', store.state.currentPageId, {
      name: 'Card',
      x: 240,
      y: 160,
      width: 200,
      height: 120
    }).id
  })

  // A tool call as the MCP bridge delivers it, from a session of an outside client.
  await page.evaluate(
    (id) =>
      window.openPencil?.test?.automation?.('tool', {
        name: 'rename_node',
        args: { id, name: 'Checkout card' },
        agent: { session: 'session-1', kind: 'mcp', client: 'claude-code' }
      }),
    nodeId
  )
  const agent = await page.evaluate(() => {
    const cursor = window.openPencil
      ?.getStore?.()
      .state.presenceCursors.find((entry) => entry.kind === 'agent')
    return cursor ? { name: cursor.name, x: cursor.x, y: cursor.y } : null
  })
  expect(agent).toMatchObject({ x: 240, y: 160 })
  const name = agent?.name ?? ''

  // With Follow agents on, as by default, the view follows it as soon as it works.
  const frame = page.getByTestId('follow-frame')
  await expect(frame).toContainText(`Following ${name}`)
  await frame.getByRole('button', { name: 'Stop following' }).click()
  await expect(frame).toHaveCount(0)

  // Your avatar lists it, and you can follow it again from there.
  const avatar = page.getByTestId('presence-self-avatar')
  await expect(avatar).toContainText('1')
  await avatar.click()
  const menu = page.getByTestId('presence-self-menu')
  await expect(menu.getByText(name)).toBeVisible()
  await menu.getByRole('button', { name: `Follow ${name}` }).click()
  await expect(frame).toContainText(`Following ${name}`)

  // Renaming it there renames it everywhere it shows.
  await menu.getByRole('button', { name: `Rename ${name}` }).click()
  const input = menu.getByRole('textbox', { name: 'Agent name' })
  await input.fill('Scout')
  await input.press('Enter')
  await expect(menu.getByRole('button', { name: 'Rename Scout' })).toBeVisible()
  await expect(frame).toContainText('Following Scout')

  // When the session ends, the agent leaves.
  await page.evaluate(() =>
    window.openPencil?.test?.automation?.('agent_session_closed', { session: 'session-1' })
  )
  await expect(frame).toHaveCount(0)
  await expect(menu.getByText('Scout')).toHaveCount(0)
  await expect(avatar).not.toContainText('1')
})
