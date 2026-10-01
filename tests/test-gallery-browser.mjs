import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFile, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
const { chromium } = createRequire(import.meta.url)('playwright')
const root = resolve(import.meta.dirname, '..'),
  front = 'http://127.0.0.1:5174',
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
  acceptDownloads: true,
})
await context.addInitScript(
  (value) => localStorage.setItem('sb-127-auth-token', JSON.stringify(value)),
  session,
)
const page = await context.newPage(),
  crashes = []
page.on('pageerror', (error) => crashes.push(error.message))
const dialog = page.locator('dialog[open]').last()
const actions = page.getByRole('region', { name: 'Selection actions' })
const waitIdle = async () => {
  await page.waitForFunction(
    () =>
      document
        .querySelector('.gallery-selection')
        ?.getAttribute('aria-busy') === 'false',
  )
}
const confirm = async (name) => {
  await dialog.getByRole('button', { name, exact: true }).click()
  await page.locator('dialog[open]').waitFor({ state: 'hidden' })
  await waitIdle()
}
const select = async (...names) => {
  await page.getByRole('button', { name: 'Select', exact: true }).click()
  for (const name of names)
    await page
      .getByRole('checkbox', { name: `Select ${name}`, exact: true })
      .check()
}
const save = async (kind, data, assets = []) => {
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
try {
  await page.goto(front + '/media')
  await page.locator('.gallery-tile').first().waitFor()
  const image = await readFile(resolve(root, 'public/assets/project-01.jpg'))
  await page.locator('input[type=file]').setInputFiles(
    ['Gallery A.jpg', 'Gallery B.jpg', 'Gallery C.jpg'].map((name) => ({
      name,
      mimeType: 'image/jpeg',
      buffer: image,
    })),
  )
  await page.waitForFunction(
    () =>
      Array.from(document.querySelectorAll('.upload-state')).filter(
        (el) => el.textContent === '✓ Ready',
      ).length === 3,
  )
  await page.getByRole('button', { name: 'Dismiss uploads' }).click()
  await page.getByRole('combobox', { name: 'Sort media' }).click()
  await page.getByRole('option', { name: 'Name', exact: true }).click()
  // Native gallery viewing, keyboard navigation, zoom/details/download, no photo tools.
  await page
    .getByRole('button', { name: 'Open Gallery A', exact: true })
    .click()
  await dialog.locator('img').waitFor()
  await page.keyboard.press('ArrowRight')
  await dialog
    .getByRole('heading', { name: 'Gallery B', exact: true })
    .waitFor()
  await dialog.getByRole('button', { name: 'Details', exact: true }).click()
  await dialog.getByRole('heading', { name: 'File details' }).waitFor()
  const stage = dialog.locator('.gallery-image-stage')
  await stage.hover()
  await page.mouse.wheel(0, -200)
  await page.waitForFunction(
    () =>
      Number(document.querySelector('.gallery-image-stage')?.dataset.zoom) > 1,
  )
  await page.mouse.wheel(0, 2000)
  await page.waitForFunction(
    () =>
      document.querySelector('.gallery-image-stage')?.dataset.zoom === '1.00',
  )
  assert.equal(
    await dialog.getByRole('button', { name: 'Zoom in', exact: true }).count(),
    0,
  )
  // Rename stays in File details, preserves storage/extension and locks only its own action.
  const beforeRename = (await state()).media_assets.find(
    (asset) => asset.title === 'Gallery B',
  )
  await dialog.getByRole('button', { name: 'Edit name', exact: true }).click()
  await page.screenshot({
    path: resolve(root, 'test-results/media-name-edit-desktop.png'),
    animations: 'disabled',
  })
  await dialog
    .getByRole('textbox', { name: 'File name', exact: true })
    .fill('bad/name')
  await dialog.getByRole('button', { name: 'Save name', exact: true }).click()
  await dialog.getByRole('alert').waitFor()
  await dialog
    .getByRole('textbox', { name: 'File name', exact: true })
    .fill('Gallery B renamed')
  let resolveRename
  const interceptedRename = new Promise((resolve) => {
    resolveRename = resolve
  })
  await page.route('**/rest/v1/media_assets?*', (route) => {
    if (route.request().method() === 'PATCH') resolveRename(route)
    else return route.continue()
  })
  await dialog.getByRole('button', { name: 'Save name', exact: true }).click()
  await page.waitForFunction(
    () =>
      document
        .querySelector('.gallery-name-form button')
        ?.getAttribute('aria-busy') === 'true',
  )
  assert.equal(
    await dialog
      .getByRole('button', { name: 'Download', exact: true })
      .getAttribute('aria-busy'),
    'false',
  )
  assert.equal(
    await dialog
      .getByRole('button', { name: 'Trash', exact: true })
      .getAttribute('aria-busy'),
    'false',
  )
  assert.equal(await dialog.locator('.ui-spinner').count(), 1)
  assert.equal(await page.locator('dialog[open]').count(), 1)
  await (await interceptedRename).continue()
  await page.unroute('**/rest/v1/media_assets?*')
  await dialog
    .getByRole('heading', { name: 'Gallery B renamed', exact: true })
    .waitFor()
  const renamed = (await state()).media_assets.find(
    (asset) => asset.id === beforeRename.id,
  )
  assert.equal(renamed.original_filename, 'Gallery B renamed.jpg')
  assert.equal(renamed.storage_path, beforeRename.storage_path)
  await dialog.getByRole('button', { name: 'Rename file', exact: true }).click()
  await dialog
    .getByRole('textbox', { name: 'File name', exact: true })
    .fill('Gallery B.jpg')
  await dialog.getByRole('button', { name: 'Save name', exact: true }).click()
  await dialog
    .getByRole('heading', { name: 'Gallery B', exact: true })
    .waitFor()
  const download = page.waitForEvent('download')
  await dialog.getByRole('button', { name: 'Download', exact: true }).click()
  assert.equal((await download).suggestedFilename(), 'Gallery B.jpg')
  assert.equal(
    await dialog.getByRole('button', { name: /crop|filter|rotate/i }).count(),
    0,
  )
  await dialog.getByRole('button', { name: 'Close dialog' }).click()
  // Desktop modifier/range selection and selection pruning to search results.
  await page
    .getByRole('button', { name: 'Open Gallery A', exact: true })
    .click({ modifiers: ['Control'] })
  await page
    .getByRole('button', { name: 'Open Gallery C', exact: true })
    .click({ modifiers: ['Shift'] })
  await actions.getByText('3 selected', { exact: true }).waitFor()
  await page.getByLabel('Search media').fill('Gallery B')
  await actions.getByText('1 selected', { exact: true }).waitFor()
  await page.getByLabel('Search media').fill('')
  await actions.getByRole('button', { name: 'Done', exact: true }).click()
  // Recover a committed Trash write whose response was lost, without a false failure.
  await select('Gallery C')
  await page.route('**/rest/v1/media_assets?*', async (route) => {
    if (route.request().method() !== 'PATCH') return route.continue()
    await route.fetch()
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Lost Trash response' }),
    })
  })
  await actions.getByRole('button', { name: 'Trash', exact: true }).click()
  await confirm('Move to Trash')
  await actions.getByText('0 selected', { exact: true }).waitFor()
  assert.equal(await page.locator('.gallery-errors').count(), 0)
  await page.unroute('**/rest/v1/media_assets?*')
  await page.goto(front + '/trash')
  await page
    .getByRole('button', { name: 'Open Gallery C', exact: true })
    .click()
  await actions.getByRole('button', { name: 'Restore', exact: true }).click()
  await actions.getByText('0 selected', { exact: true }).waitFor()
  await waitIdle()
  await page.goto(front + '/media')
  await page
    .getByRole('button', { name: 'Open Gallery C', exact: true })
    .waitFor()
  await page.getByRole('combobox', { name: 'Sort media' }).click()
  await page.getByRole('option', { name: 'Name', exact: true }).click()
  // Mixed success/failure remains visible and retryable, no stale cards.
  await select('Gallery A', 'Gallery B')
  const assetB = (await state()).media_assets.find(
    (a) => a.title === 'Gallery B',
  )
  await page.route('**/rest/v1/media_assets?*', async (route) => {
    if (
      route.request().method() !== 'PATCH' ||
      !route.request().url().includes(assetB.id)
    )
      return route.continue()
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Deliberate gallery retry test' }),
    })
  })
  await actions.getByRole('button', { name: 'Trash', exact: true }).click()
  await confirm('Move to Trash')
  await actions.getByText('1 selected', { exact: true }).waitFor()
  await page.getByRole('alert').filter({ hasText: 'Gallery B:' }).waitFor()
  assert.equal(
    await page
      .getByRole('button', { name: 'Open Gallery A', exact: true })
      .count(),
    0,
  )
  assert.equal(
    await page
      .getByRole('button', { name: 'Open Gallery B', exact: true })
      .count(),
    1,
  )
  await page.unroute('**/rest/v1/media_assets?*')
  await actions.getByRole('button', { name: 'Trash', exact: true }).click()
  await confirm('Move to Trash')
  await actions.getByText('0 selected', { exact: true }).waitFor()
  const trashedA = (await state()).media_assets.find(
    (a) => a.title === 'Gallery A',
  )
  assert.ok(trashedA.deleted_at)
  assert.equal(
    (
      await fetch(
        api + '/storage/v1/object/showcase-media/' + trashedA.storage_path,
      )
    ).status,
    200,
    'Trash retains bytes',
  )
  await page.goto(front + '/trash')
  await page
    .getByRole('button', { name: 'Open Gallery A', exact: true })
    .click()
  await page
    .getByRole('checkbox', { name: 'Select Gallery B', exact: true })
    .check()
  await actions.getByRole('button', { name: 'Restore', exact: true }).click()
  await actions.getByText('0 selected', { exact: true }).waitFor()
  await waitIdle()
  await page.reload()
  assert.equal(
    await page
      .getByRole('button', { name: 'Open Gallery A', exact: true })
      .count(),
    0,
  )
  await page.goto(front + '/media')
  await page
    .getByRole('button', { name: 'Open Gallery A', exact: true })
    .waitFor()
  const asset = (await state()).media_assets.find(
    (a) => a.title === 'Gallery A',
  )
  assert.equal(asset.status, 'archived')
  await save(
    'material',
    { title: 'Oak collection', tier: 'mid', status: 'archived' },
    [asset.id],
  )
  await save(
    'material',
    { title: 'Stone collection', tier: 'top', status: 'archived' },
    [asset.id],
  )
  await page.goto(front + '/materials')
  await select('Oak collection', 'Stone collection')
  await page
    .getByRole('combobox', { name: 'Bulk material category', exact: true })
    .click()
  await page.getByRole('option', { name: 'Essentials', exact: true }).click()
  await actions.getByRole('button', { name: 'Apply', exact: true }).click()
  await actions.getByText('0 selected', { exact: true }).waitFor()
  await waitIdle()
  assert.ok((await state()).materials.every((m) => m.tier === 'low'))
  assert.equal(
    (await state()).media_items.filter((m) => m.owner_kind === 'material')
      .length,
    2,
  )
  await actions.getByRole('button', { name: 'Done', exact: true }).click()
  await page
    .getByRole('button', { name: 'Open Oak collection', exact: true })
    .click()
  await dialog
    .getByRole('button', { name: 'Preview Gallery A', exact: true })
    .click()
  await dialog
    .getByRole('heading', { name: 'Gallery A', exact: true })
    .waitFor()
  await dialog.getByRole('button', { name: 'Close dialog' }).click()
  await dialog
    .getByRole('heading', { name: 'Oak collection', exact: true })
    .waitFor()
  await dialog.getByRole('button', { name: 'Close dialog' }).click()
  const room = await save('room', { title: 'Gallery lounge', status: 'archived' })
  await save(
    'work',
    {
      title: 'Gallery interior',
      location: 'Chennai',
      room_category_id: room,
      status: 'archived',
    },
    [asset.id],
  )
  await mkdir(resolve(root, 'test-results'), { recursive: true })
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    for (const route of [
      'media',
      'materials',
      'rooms',
      'rooms/' + room,
      'trash',
    ]) {
      await page.goto(front + '/' + route)
      await page.locator('.gallery-toolbar').waitFor()
      await page.waitForFunction(
        () =>
          !document
            .querySelector('.gallery-page')
            ?.textContent.includes('Loading '),
      )
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${route} overflow at ${width}`,
      )
      if (width === 390 || width === 1440)
        await page.screenshot({
          path: resolve(
            root,
            `test-results/gallery-${route.replace('/', '-')}-${width}.png`,
          ),
          animations: 'disabled',
        })
    }
    await page.goto(front + '/media')
    await page.getByRole('combobox', { name: 'Sort media' }).click()
    await page.getByRole('option', { name: 'Name', exact: true }).waitFor()
    const menu = page.getByRole('listbox', { name: 'Sort media', exact: true })
    if (width === 390 || width === 1440)
      await page.screenshot({
        path: resolve(root, `test-results/media-dropdown-${width}.png`),
        animations: 'disabled',
      })
    assert.ok(
      await menu.evaluate((el) => {
        const rect = el.getBoundingClientRect()
        return (
          rect.left >= 0 &&
          rect.right <= innerWidth &&
          rect.bottom <= innerHeight
        )
      }),
      `Dropdown overflow at ${width}`,
    )
    await page.keyboard.press('End')
    await page.keyboard.press('Enter')
    assert.equal(
      await page
        .getByRole('combobox', { name: 'Sort media' })
        .getAttribute('aria-expanded'),
      'false',
    )
    await page
      .getByRole('button', { name: 'Open Gallery C', exact: true })
      .click()
    await dialog.locator('img').waitFor()
    await dialog.getByRole('button', { name: 'Details', exact: true }).click()
    if (width === 390) {
      // Browser-delivered multi-touch, not mocked handlers, validates pinch and cancel.
      const cdp = await context.newCDPSession(page)
      await cdp.send('Emulation.setTouchEmulationEnabled', {
        enabled: true,
        maxTouchPoints: 2,
      })
      const rect = await dialog.locator('.gallery-image-stage').boundingBox(),
        x = rect.x + rect.width / 2,
        y = rect.y + rect.height / 2
      const touches = (distance) => [
        { x: x - distance, y, id: 1 },
        { x: x + distance, y, id: 2 },
      ]
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: touches(35),
      })
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: touches(80),
      })
      await page.waitForFunction(
        () =>
          Number(document.querySelector('.gallery-image-stage')?.dataset.zoom) >
          2,
      )
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: touches(20),
      })
      await page.waitForFunction(
        () =>
          document.querySelector('.gallery-image-stage')?.dataset.zoom ===
          '1.00',
      )
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchCancel',
        touchPoints: [],
      })
      await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: false })
      await cdp.detach()
      await dialog
        .getByRole('button', { name: 'Edit name', exact: true })
        .click()
      await dialog
        .getByRole('textbox', { name: 'File name', exact: true })
        .waitFor()
      await page.screenshot({
        path: resolve(root, 'test-results/media-name-edit-mobile.png'),
        animations: 'disabled',
      })
      await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
    }
    assert.ok(
      await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
      `Viewer overflow at ${width}`,
    )
    if (width === 390)
      await page.screenshot({
        path: resolve(root, 'test-results/gallery-viewer-mobile.png'),
        animations: 'disabled',
      })
    await dialog.getByRole('button', { name: 'Close dialog' }).click()
    await select('Gallery C')
    assert.ok(
      await actions.evaluate((el) => {
        const r = el.getBoundingClientRect()
        return r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight
      }),
      `Selection outside viewport at ${width}`,
    )
    if (width <= 820)
      assert.ok(
        await actions.evaluate(
          (el) => el.getBoundingClientRect().bottom > innerHeight - 110,
        ),
        'Mobile selection must stay at the bottom, not inside the sticky toolbar',
      )
    if (width === 390)
      await page.screenshot({
        path: resolve(root, 'test-results/gallery-selection-mobile.png'),
        animations: 'disabled',
      })
    await actions.getByRole('button', { name: 'Done', exact: true }).click()
  }
  // Long-touch starts selection without opening the viewer.
  const tile = page.getByRole('button', {
    name: 'Open Gallery C',
    exact: true,
  })
  await tile.dispatchEvent('pointerdown', {
    pointerType: 'touch',
    clientX: 10,
    clientY: 10,
  })
  await actions.getByText('1 selected', { exact: true }).waitFor()
  await tile.dispatchEvent('pointerup', { pointerType: 'touch' })
  await tile.click()
  assert.equal(await page.locator('dialog[open]').count(), 0)
  await actions.getByRole('button', { name: 'Done', exact: true }).click()
  // Shared editors must also show a spinner only on the requested action.
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto(front + '/materials')
  const oakCard = page.locator('.content-card').filter({
    has: page.getByRole('heading', { name: 'Oak collection', exact: true }),
  })
  await oakCard.getByRole('button', { name: 'Edit', exact: true }).click()
  let releaseSave
  const heldSave = new Promise((resolve) => {
    releaseSave = resolve
  })
  await page.route('**/rest/v1/rpc/save_content', (route) => releaseSave(route))
  await dialog
    .getByRole('button', { name: 'Save changes', exact: true })
    .click()
  const saveRoute = await heldSave
  assert.equal(
    await dialog
      .getByRole('button', { name: 'Saving changes…', exact: true })
      .getAttribute('aria-busy'),
    'true',
  )
  assert.equal(
    await dialog
      .getByRole('button', { name: 'Move to Trash', exact: true })
      .getAttribute('aria-busy'),
    'false',
  )
  assert.equal(await dialog.locator('.ui-spinner').count(), 1)
  await saveRoute.continue()
  await page.unroute('**/rest/v1/rpc/save_content')
  await page.locator('dialog[open]').waitFor({ state: 'hidden' })
  await oakCard.getByRole('button', { name: 'Edit', exact: true }).click()
  let releaseTrash
  const heldTrash = new Promise((resolve) => {
    releaseTrash = resolve
  })
  await page.route('**/rest/v1/materials?*', (route) => {
    if (route.request().method() === 'PATCH') releaseTrash(route)
    else return route.continue()
  })
  await dialog
    .getByRole('button', { name: 'Move to Trash', exact: true })
    .click()
  await dialog
    .getByRole('button', { name: 'Move to Trash', exact: true })
    .click()
  const trashRoute = await heldTrash
  assert.equal(
    await dialog
      .getByRole('button', { name: 'Deleting…', exact: true })
      .getAttribute('aria-busy'),
    'true',
  )
  assert.equal(
    await dialog
      .getByRole('button', { name: 'Save changes', exact: true })
      .getAttribute('aria-busy'),
    'false',
  )
  assert.equal(await dialog.locator('.ui-spinner').count(), 1)
  await trashRoute.continue()
  await page.unroute('**/rest/v1/materials?*')
  await page.locator('dialog[open]').waitFor({ state: 'hidden' })
  await page.goto(front + '/media')
  await page.getByLabel('Search media').waitFor()
  assert.deepEqual(crashes, [])
  await page.setViewportSize({ width: 390, height: 900 })
  await page.getByLabel('Search media').fill('No matching gallery fixture')
  await page
    .getByRole('heading', { name: 'No matching files', exact: true })
    .waitFor()
  await page.locator('.gallery-empty-illustration').waitFor()
  await page.screenshot({
    path: resolve(root, 'test-results/media-empty-mobile.png'),
    animations: 'disabled',
  })
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click()
  // Make a tiny real H.264 video: its first frame is red; later frames are blue.
  const bytes = await page.evaluate(async () => {
    const canvas = document.createElement('canvas')
    canvas.width = 160
    canvas.height = 90
    const context = canvas.getContext('2d'),
      stream = canvas.captureStream(12)
    const chunks = [],
      recorder = new MediaRecorder(stream, {
        mimeType: 'video/mp4;codecs=avc1.42001E',
      })
    context.fillStyle = '#d02030'
    context.fillRect(0, 0, 160, 90)
    recorder.ondataavailable = (event) => chunks.push(event.data)
    const stopped = new Promise((resolve) => {
      recorder.onstop = resolve
    })
    recorder.start()
    const began = performance.now(),
      timer = setInterval(() => {
        context.fillStyle =
          performance.now() - began < 350 ? '#d02030' : '#2040d0'
        context.fillRect(0, 0, 160, 90)
      }, 50)
    await new Promise((resolve) => setTimeout(resolve, 800))
    clearInterval(timer)
    recorder.stop()
    await stopped
    stream.getTracks().forEach((track) => track.stop())
    return [
      ...new Uint8Array(
        await new Blob(chunks, { type: 'video/mp4' }).arrayBuffer(),
      ),
    ]
  })
  await page.locator('input[type=file]').setInputFiles({
    name: 'First frame fixture.mp4',
    mimeType: 'video/mp4',
    buffer: Buffer.from(bytes),
  })
  await page.getByText('✓ Ready', { exact: true }).waitFor()
  await page
    .getByRole('button', { name: 'Dismiss uploads', exact: true })
    .click()
  const videoCard = page.locator('.gallery-tile').filter({
    has: page.getByRole('heading', {
      name: 'First frame fixture',
      exact: true,
    }),
  })
  await videoCard.locator('video').waitFor()
  await page.waitForFunction(() => {
    const video = document.querySelector('.gallery-tile video')
    return video?.readyState >= 2 && !video.seeking
  })
  assert.equal(await videoCard.locator('video').getAttribute('poster'), null)
  assert.ok(
    await videoCard
      .locator('video')
      .evaluate((video) => video.paused && video.currentTime < 0.01),
    'Thumbnail must pause at the beginning',
  )
  const rgb = await videoCard.locator('video').evaluate(async (video) => {
    // A same-byte CORS decoder allows pixel inspection without changing the app's
    // normal video loading policy (cross-origin canvases otherwise are tainted).
    const copy = document.createElement('video')
    copy.crossOrigin = 'anonymous'
    copy.muted = true
    const loaded = new Promise((resolve, reject) => {
      copy.onloadeddata = resolve
      copy.onerror = reject
    })
    copy.src = video.currentSrc
    await loaded
    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1
    const context = canvas.getContext('2d')
    context.drawImage(copy, 0, 0, 1, 1)
    return [...context.getImageData(0, 0, 1, 1).data]
  })
  assert.ok(rgb[0] > rgb[2] + 80, `Expected the red first frame, got ${rgb}`)
  await page
    .getByRole('button', { name: 'Open First frame fixture', exact: true })
    .click()
  await dialog.getByRole('button', { name: 'Edit name', exact: true }).click()
  assert.equal(await dialog.locator('input').count(), 1)
  assert.equal(await dialog.locator('[name=poster]').count(), 0)
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  await dialog
    .getByRole('button', { name: 'Close dialog', exact: true })
    .click()
  assert.deepEqual(crashes, [])
  console.log(
    'PASS: wheel and browser multi-touch pinch zoom, inline filename validation/save/extension and storage preservation, single-action spinner, custom dropdown keyboard/bounds, compact filters, illustrated empty states, decoded first-frame H.264 preview, gallery selection/trash/restore/bulk and 320/390/768/1440 layouts; no photo editing tools.',
  )
} finally {
  await browser.close()
}
