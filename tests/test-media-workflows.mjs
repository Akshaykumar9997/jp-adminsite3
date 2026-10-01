import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFile, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
const { chromium } = createRequire(import.meta.url)('playwright')
const root = resolve(import.meta.dirname, '..')
const front = 'http://127.0.0.1:5174',
  api = 'http://127.0.0.1:54321'
const config = await (await fetch(front + '/src/lib/supabase.ts')).text()
assert.ok(
  config.includes(api) && config.includes('local-publishable-test-key'),
  'Disposable backend required',
)
await fetch(api + '/test/reset', { method: 'POST' })
const session = await (await fetch(api + '/test/session')).json()
const state = async () => (await fetch(api + '/test/state')).json()
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
})
await context.addInitScript(
  (value) => localStorage.setItem('sb-127-auth-token', JSON.stringify(value)),
  session,
)
const page = await context.newPage(),
  crashes = []
page.on('pageerror', (error) => crashes.push(error.message))
const panel = page.locator('.upload-center')
const dialog = page.locator('dialog[open]').last()
const image = {
  name: 'Delete regression.jpg',
  mimeType: 'image/jpeg',
  buffer: await readFile(resolve(root, 'public/assets/project-01.jpg')),
}
const upload = (names) =>
  page
    .locator('input[type=file]')
    .first()
    .setInputFiles(names.map((name) => ({ ...image, name })))
const ready = (count) =>
  page.waitForFunction(
    (count) =>
      Array.from(
        document.querySelectorAll('.upload-center .upload-state'),
      ).filter((el) => el.textContent === '✓ Ready').length === count,
    count,
  )
const dismiss = () =>
  page.getByRole('button', { name: 'Dismiss uploads', exact: true }).click()
const editAsset = (name) =>
  page.getByRole('button', { name: `Open ${name}`, exact: true }).click()
const deleteItem = async (label) => {
  await dialog.getByRole('button', { name: /^Trash$|^Move to Trash$/ }).click()
  await dialog
    .getByRole('button', { name: 'Move to Trash', exact: true })
    .click()
}
try {
  await page.goto(front + '/media')
  await page.locator('.content-card').first().waitFor()
  await upload([image.name])
  await ready(1)
  await editAsset('Delete regression')
  // The upload panel remains at the viewport corner even inside a modal.
  const panelRect = await panel.boundingBox()
  assert.ok(panelRect.x > 900 && panelRect.y + panelRect.height > 900)
  await deleteItem('Delete media')
  await page.locator('dialog[open]').waitFor({ state: 'hidden' })
  await page
    .getByRole('heading', { name: 'Delete regression', exact: true })
    .waitFor({ state: 'hidden' })
  assert.ok(
    !(await state()).media_assets.some(
      (asset) => asset.title === 'Delete regression' && !asset.deleted_at,
    ),
  )
  await page
    .getByRole('navigation', { name: 'Admin navigation' })
    .getByRole('link', { name: 'Materials', exact: true })
    .click()
  await page
    .getByRole('navigation', { name: 'Admin navigation' })
    .getByRole('link', { name: 'Media Library', exact: true })
    .click()
  assert.equal(
    await page
      .getByRole('heading', { name: 'Delete regression', exact: true })
      .count(),
    0,
  )

  // Reject zero-row/RLS deletes and network failures; preserve the editor for retry.
  await upload(['Protected.jpg'])
  await ready(1)
  await editAsset('Protected')
  let rejection = 'zero'
  await page.route('**/rest/v1/media_assets?*', async (route) => {
    if (route.request().method() !== 'PATCH') return route.continue()
    await route.fulfill({
      status: rejection === 'zero' ? 200 : 503,
      contentType: 'application/json',
      body:
        rejection === 'zero'
          ? 'null'
          : JSON.stringify({ message: 'Network interruption' }),
    })
  })
  await deleteItem('Delete media')
  await page.locator('dialog[open] p[role=alert]').waitFor()
  assert.ok(
    (await state()).media_assets.some((asset) => asset.title === 'Protected'),
  )
  rejection = 'network'
  await deleteItem('Delete media')
  await page.locator('dialog[open] p[role=alert]').waitFor()
  await page.unroute('**/rest/v1/media_assets?*')
  await deleteItem('Delete media')
  await page.locator('dialog[open]').waitFor({ state: 'hidden' })
  await page
    .getByRole('heading', { name: 'Protected', exact: true })
    .waitFor({ state: 'hidden' })

  // Committed deletion + failed storage cleanup is a warning, with a durable retry.
  await upload(['Cleanup.jpg'])
  await ready(1)
  await editAsset('Cleanup')
  await page.route('**/storage/v1/object/showcase-media', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Network interruption' }),
    }),
  )
  await deleteItem('Delete media')
  await page.locator('dialog[open]').waitFor({ state: 'hidden' })
  await page.goto(front + '/trash')
  await page.getByRole('button', { name: 'Open Cleanup', exact: true }).click()
  await page
    .getByRole('button', { name: 'Delete permanently', exact: true })
    .click()
  await dialog
    .getByRole('button', { name: 'Delete permanently', exact: true })
    .click()
  await page.locator('dialog[open]').waitFor({ state: 'hidden' })
  await page
    .getByRole('region', { name: 'Selection actions' })
    .locator('[role=status]')
    .filter({ hasText: '0 selected' })
    .waitFor()
  await page.waitForFunction(
    () =>
      document
        .querySelector('.gallery-selection')
        ?.getAttribute('aria-busy') === 'false',
  )
  await page.goto(front + '/media')
  await page
    .getByRole('button', { name: 'Retry cleanup', exact: true })
    .waitFor()
  assert.equal(
    await page.getByRole('heading', { name: 'Cleanup', exact: true }).count(),
    0,
  )
  await page.reload()
  await page
    .getByRole('button', { name: 'Retry cleanup', exact: true })
    .waitFor()
  await page.unroute('**/storage/v1/object/showcase-media')
  await page.getByRole('button', { name: 'Retry cleanup', exact: true }).click()
  await page.locator('.cleanup-notice').waitFor({ state: 'hidden' })

  // Delay transfers in the browser, leaving page navigation and additional enqueues free.
  const held = []
  await page.route('**/storage/v1/object/showcase-media/**', (route) => {
    if (route.request().method() === 'POST') held.push(route)
    else return route.continue()
  })
  await upload(['Queue one.jpg', 'Queue two.jpg', 'Queue cancel.jpg'])
  await page.waitForFunction(
    () => document.querySelectorAll('.upload-center li').length === 3,
  )
  assert.equal(
    await page.evaluate(() => {
      const event = new Event('beforeunload', { cancelable: true })
      window.dispatchEvent(event)
      return event.defaultPrevented
    }),
    true,
  )
  assert.equal(
    await panel.locator('.progress').count(),
    0,
    'No horizontal upload bars',
  )
  assert.equal(await panel.getByRole('progressbar').count(), 3)
  await panel.getByRole('button', { name: 'Collapse uploads' }).click()
  await page
    .getByRole('navigation', { name: 'Admin navigation' })
    .getByRole('link', { name: 'Materials', exact: true })
    .click()
  await page.getByRole('heading', { name: 'Materials', exact: true }).waitFor()
  await page
    .getByRole('navigation', { name: 'Admin navigation' })
    .getByRole('link', { name: 'Media Library', exact: true })
    .click()
  await upload(['Queue extra.jpg'])
  await panel.getByText('Queue extra.jpg', { exact: true }).waitFor()
  await panel
    .locator('li')
    .filter({ hasText: 'Queue cancel.jpg' })
    .getByRole('button', {
      name: 'Cancel upload Queue cancel.jpg',
      exact: true,
    })
    .click()
  await panel
    .locator('li')
    .filter({ hasText: 'Queue cancel.jpg' })
    .getByText('Cancelled', { exact: true })
    .waitFor()
  assert.equal(held.length, 2, 'Two transfer slots; later files stay queued')
  await panel.getByRole('button', { name: 'Minimize uploads' }).click()
  assert.equal(
    await panel.getByRole('button', { name: 'Expand uploads' }).count(),
    1,
  )
  await panel.getByRole('button', { name: 'Expand uploads' }).click()
  await held.shift().continue()
  await page.waitForFunction(() =>
    Array.from(document.querySelectorAll('.upload-center .upload-state')).some(
      (el) => el.textContent === '✓ Ready',
    ),
  )
  // Third eligible upload starts as a slot becomes available.
  await panel
    .locator('li')
    .filter({ hasText: 'Queue extra.jpg' })
    .getByText(/Uploading/)
    .waitFor()
  for (let attempt = 0; held.length < 2 && attempt < 100; attempt++)
    await new Promise((resolve) => setTimeout(resolve, 20))
  assert.equal(held.length, 2)
  for (const route of held.splice(0)) await route.continue()
  await page.unroute('**/storage/v1/object/showcase-media/**')
  await ready(3)
  await panel
    .locator('li')
    .filter({ hasText: 'Queue cancel.jpg' })
    .getByRole('button', { name: 'Retry upload' })
    .click()
  await ready(4)
  assert.equal(await panel.getByRole('progressbar').count(), 0)
  assert.equal(
    await panel
      .getByRole('img', { name: 'Upload complete', exact: true })
      .count(),
    4,
  )
  await panel.getByText('4 uploads complete', { exact: true }).waitFor()
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    const rect = await panel.boundingBox()
    assert.ok(
      rect.x >= 0 &&
        rect.x + rect.width <= width &&
        rect.y + rect.height <= 900,
    )
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    )
  }
  await mkdir(resolve(root, 'test-results'), { recursive: true })
  await page.screenshot({
    path: resolve(root, 'test-results/media-upload-panel.png'),
    animations: 'disabled',
  })
  await dismiss()
  await panel.waitFor({ state: 'hidden' })

  // Failed transfer, continued queue, and retry; unsupported files never reach storage.
  await fetch(api + '/test/control', {
    method: 'POST',
    body: JSON.stringify({ fail: 'upload' }),
  })
  await upload(['Failure.jpg', 'Sibling.jpg'])
  await panel.getByRole('button', { name: 'Retry upload' }).waitFor()
  await ready(1)
  await panel.getByRole('button', { name: 'Retry upload' }).click()
  await ready(2)
  await dismiss()
  await upload(['invalid.mov'])
  await panel.getByText('✕ Failed', { exact: true }).waitFor()
  assert.ok(
    !(await state()).media_assets.some(
      (asset) => asset.original_filename === 'invalid.mov',
    ),
  )
  await dismiss()
  // A metadata write failure cleans the object; a lost response after commit
  // recovers the existing asset rather than deleting its bytes or duplicating it.
  let rejectMetadata = true,
    failedPath
  await page.route('**/rest/v1/media_assets?*', async (route) => {
    if (route.request().method() !== 'POST') return route.continue()
    failedPath = route.request().postDataJSON().storage_path
    if (rejectMetadata)
      return route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Network interruption' }),
      })
    await route.fetch()
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Lost response' }),
    })
  })
  await upload(['Metadata recovery.jpg'])
  await panel.getByRole('button', { name: 'Retry upload' }).waitFor()
  assert.equal(
    (await fetch(api + '/storage/v1/object/showcase-media/' + failedPath))
      .status,
    404,
  )
  rejectMetadata = false
  await panel.getByRole('button', { name: 'Retry upload' }).click()
  await ready(1)
  assert.equal(
    (await state()).media_assets.filter(
      (asset) => asset.title === 'Metadata recovery',
    ).length,
    1,
  )
  assert.equal(
    (await fetch(api + '/storage/v1/object/showcase-media/' + failedPath))
      .status,
    200,
  )
  await page.unroute('**/rest/v1/media_assets?*')
  await dismiss()

  // Exercise every currently exposed content deletion, associations and reuse.
  const create = async (kind, data, assets = []) => {
    const response = await fetch(api + '/rest/v1/rpc/save_content', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Profile': 'showcase',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        p_kind: kind,
        p_id: null,
        p_data: data,
        p_assets: assets,
        p_cover: assets[0] ?? null,
      }),
    })
    assert.equal(response.status, 200, await response.clone().text())
    return response.json()
  }
  const reusable = (await state()).media_assets.find(
    (asset) => asset.title === 'Metadata recovery',
  )
  for (const [kind, route, name] of [
    ['material', 'materials', 'Deletion oak'],
    ['partner', 'partners', 'Deletion studio'],
  ]) {
    await create(
      kind,
      { title: name, status: 'archived', tier: 'mid' },
      kind === 'material' ? [reusable.id] : [],
    )
    await page.goto(front + '/' + route)
    await page.getByRole('heading', { name, exact: true }).waitFor()
    if (kind === 'material') {
      await page
        .getByRole('navigation', { name: 'Admin navigation' })
        .getByRole('link', { name: 'Media Library', exact: true })
        .click()
      await editAsset('Metadata recovery')
      await deleteItem('Delete media')
      await page.locator('dialog[open] p[role=alert]').waitFor()
      assert.match(
        await page.locator('dialog[open] p[role=alert]').textContent(),
        /still in use/i,
      )
      await dialog.getByRole('button', { name: 'Close dialog' }).click()
      await page
        .getByRole('navigation', { name: 'Admin navigation' })
        .getByRole('link', { name: 'Materials', exact: true })
        .click()
    }
    await page
      .locator('.content-card')
      .filter({ has: page.getByRole('heading', { name, exact: true }) })
      .getByRole('button', { name: 'Edit', exact: true })
      .click()
    await dialog
      .getByRole('button', { name: 'Move to Trash', exact: true })
      .click()
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
    assert.ok((await state())[route].some((item) => item.name === name))
    await deleteItem(`Delete ${kind}`)
    await page.locator('dialog[open]').waitFor({ state: 'hidden' })
    await page
      .getByRole('heading', { name, exact: true })
      .waitFor({ state: 'hidden' })
    assert.ok(
      !(await state())[route].some(
        (item) => item.name === name && !item.deleted_at,
      ),
    )
    assert.ok(
      (await state()).media_assets.some((asset) => asset.id === reusable.id),
      'Deleting content preserves reusable media',
    )
  }
  const roomId = await create('room', {
    title: 'Deletion lounge',
    status: 'archived',
  })
  await create(
    'work',
    {
      title: 'Deletion album',
      location: 'Chennai',
      room_category_id: roomId,
      status: 'archived',
    },
    [reusable.id],
  )
  await page.goto(front + '/rooms/' + roomId)
  await page.getByRole('button', { name: 'Room details', exact: true }).click()
  await deleteItem('Delete room')
  await page.locator('dialog[open] p[role=alert]').waitFor()
  assert.ok((await state()).room_categories.some((item) => item.id === roomId))
  await dialog.getByRole('button', { name: 'Close dialog' }).click()
  await page.getByRole('button', { name: 'Edit work', exact: true }).click()
  await deleteItem('Delete work')
  await page.locator('dialog[open]').waitFor({ state: 'hidden' })
  await page
    .getByRole('heading', { name: 'Deletion album', exact: true })
    .waitFor({ state: 'hidden' })
  assert.ok(
    !(await state()).works.some(
      (item) => item.title === 'Deletion album' && !item.deleted_at,
    ),
  )
  await page.getByRole('button', { name: 'Room details', exact: true }).click()
  await deleteItem('Delete room')
  await page.locator('dialog[open]').waitFor({ state: 'hidden' })
  assert.ok(
    !(await state()).room_categories.some(
      (item) => item.id === roomId && !item.deleted_at,
    ),
  )
  assert.ok(
    (await state()).media_assets.some((asset) => asset.id === reusable.id),
  )
  // Cancelling in an editor and retrying must reattach the recovered upload.
  await page.goto(front + '/materials')
  await page
    .getByRole('button', { name: 'Create material', exact: true })
    .click()
  await dialog.locator('[name=title]').fill('Editor retry attachment')
  const editorTransfers = []
  await page.route('**/storage/v1/object/showcase-media/**', (route) => {
    if (route.request().method() === 'POST') editorTransfers.push(route)
    else return route.continue()
  })
  await upload(['Editor one.jpg', 'Editor two.jpg', 'Editor retry.jpg'])
  await panel.getByText('Editor retry.jpg', { exact: true }).waitFor()
  await panel
    .locator('li')
    .filter({ hasText: 'Editor retry.jpg' })
    .getByRole('button', {
      name: 'Cancel upload Editor retry.jpg',
      exact: true,
    })
    .click()
  await panel
    .locator('li')
    .filter({ hasText: 'Editor retry.jpg' })
    .getByText('Cancelled', { exact: true })
    .waitFor()
  await panel
    .locator('li')
    .filter({ hasText: 'Editor retry.jpg' })
    .getByRole('button', { name: 'Retry upload', exact: true })
    .click()
  await page.unroute('**/storage/v1/object/showcase-media/**')
  await ready(3)
  await page.waitForFunction(
    () => document.querySelectorAll('.mixed-card').length === 3,
  )
  await dismiss()
  await dialog
    .getByRole('button', { name: 'Save changes', exact: true })
    .click()
  await page.locator('dialog[open]').waitFor({ state: 'hidden' })
  const saved = (await state()).materials.find(
    (item) => item.name === 'Editor retry attachment',
  )
  assert.equal(
    (await state()).media_items.filter((item) => item.owner_id === saved.id)
      .length,
    3,
  )
  assert.deepEqual(crashes, [])
  console.log(
    'PASS: media/room/work/material/partner deletion, stale-card and reuse safety, zero-row/network/in-use failures, cleanup retry after reload, concurrent uploads across navigation, append/cancel/retry, editor reattachment, metadata failure/commit recovery, modal and mobile layout, invalid files and failure isolation.',
  )
} finally {
  await browser.close()
}
