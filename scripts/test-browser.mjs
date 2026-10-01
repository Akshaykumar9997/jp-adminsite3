import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFile, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
const { chromium } = createRequire(import.meta.url)('playwright')
const root = resolve(import.meta.dirname, '..'),
  output = resolve(root, 'test-results')
await mkdir(output, { recursive: true })
const viteConnection = await (
  await fetch('http://127.0.0.1:5174/src/lib/supabase.ts')
).text()
assert.ok(
  /"VITE_SUPABASE_URL"\s*:\s*"http:\/\/127\.0\.0\.1:54321"/.test(
    viteConnection,
  ) &&
    /"VITE_SUPABASE_PUBLISHABLE_KEY"\s*:\s*"local-publishable-test-key"/.test(
      viteConnection,
    ),
  'Refusing browser writes: start Vite with the documented disposable local configuration first.',
)
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
})
const page = await context.newPage()
const crashes = []
page.on('pageerror', (error) => crashes.push(error.message))
const api = 'http://127.0.0.1:54321'
const session = await (await fetch(api + '/test/session')).json()
await context.addInitScript(
  (value) => localStorage.setItem('sb-127-auth-token', JSON.stringify(value)),
  session,
)
const control = async (data) =>
  fetch(api + '/test/control', { method: 'POST', body: JSON.stringify(data) })
const state = async () => (await fetch(api + '/test/state')).json()
const positions = Buffer.from(
  new Float32Array([-1, 0, 0, 1, 0, 0, 0, 1, 0]).buffer,
)
const glbJson = Buffer.from(
  JSON.stringify({
    asset: { version: '2.0' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, material: 0 }] }],
    materials: [
      {
        doubleSided: true,
        pbrMetallicRoughness: {
          baseColorFactor: [0.8, 0.03, 0.08, 1],
          metallicFactor: 0,
        },
      },
    ],
    buffers: [{ byteLength: 36 }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 36 }],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: 3,
        type: 'VEC3',
        min: [-1, 0, 0],
        max: [1, 1, 0],
      },
    ],
  }),
)
const padded = Buffer.alloc(Math.ceil(glbJson.length / 4) * 4, 32)
glbJson.copy(padded)
const glb = Buffer.alloc(28 + padded.length + positions.length)
glb.writeUInt32LE(0x46546c67, 0)
glb.writeUInt32LE(2, 4)
glb.writeUInt32LE(glb.length, 8)
glb.writeUInt32LE(padded.length, 12)
glb.writeUInt32LE(0x4e4f534a, 16)
padded.copy(glb, 20)
glb.writeUInt32LE(positions.length, 20 + padded.length)
glb.writeUInt32LE(0x004e4942, 24 + padded.length)
positions.copy(glb, 28 + padded.length)
const image = {
  name: 'kitchen.jpg',
  mimeType: 'image/jpeg',
  buffer: await readFile(resolve(root, 'public/assets/project-01.jpg')),
}
try {
  await fetch(api + '/test/reset', { method: 'POST' })
  // Protected routes and sign-in validation use the same feedback language.
  const authContext = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  })
  const authPage = await authContext.newPage()
  authPage.on('pageerror', (error) => crashes.push(error.message))
  await authPage.goto('http://127.0.0.1:5174/works')
  await authPage
    .getByRole('heading', { name: 'Administrator sign in' })
    .waitFor()
  await authPage
    .getByRole('button', { name: 'Sign in to CMS', exact: true })
    .click()
  await authPage
    .getByText('Please enter your email address.', { exact: true })
    .waitFor()
  await authPage
    .getByText('Please enter your password.', { exact: true })
    .waitFor()
  await authPage.getByLabel('Email address').fill('wrong@example.test')
  await authPage.getByLabel('Password').fill('local-test-only')
  await authPage
    .getByRole('button', { name: 'Sign in to CMS', exact: true })
    .click()
  await authPage
    .getByText('Incorrect email or password.', { exact: true })
    .waitFor()
  await authPage.getByLabel('Email address').fill('local-test@example.test')
  await authPage
    .getByRole('button', { name: 'Sign in to CMS', exact: true })
    .click()
  await authPage.getByRole('heading', { name: 'Works', exact: true }).waitFor()
  await authPage.getByRole('button', { name: 'Sign out', exact: true }).click()
  await authPage
    .getByRole('heading', { name: 'Administrator sign in' })
    .waitFor()
  await authContext.close()
  await page.goto('http://127.0.0.1:5174/works')
  await page
    .getByRole('button', { name: 'Create work', exact: true })
    .first()
    .click()
  let dialog = page.getByRole('dialog').first()
  await dialog
    .getByRole('button', { name: 'Save changes', exact: true })
    .click()
  await dialog.getByText('Please enter work title.').waitFor()
  await dialog.getByText('Please enter a location.').waitFor()
  assert.equal((await state()).works.length, 0)
  await dialog.locator('[name="title"]').fill('Modern Kitchen')
  await dialog.locator('[name="location"]').fill('Coimbatore')
  await dialog
    .locator('[name="room_category_id"]')
    .selectOption({ label: 'Kitchen' })
  // Browser-generated H.264 MP4. No microphone, camera, or external media required.
  const video = await page.evaluate(async () => {
    const type = 'video/mp4;codecs=avc1.42001E'
    if (!MediaRecorder.isTypeSupported(type)) return null
    const canvas = document.createElement('canvas')
    canvas.width = 64
    canvas.height = 64
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#bb0016'
    ctx.fillRect(0, 0, 64, 64)
    const stream = canvas.captureStream(10)
    const recorder = new MediaRecorder(stream, { mimeType: type })
    const chunks = []
    const done = new Promise((resolve) => {
      recorder.ondataavailable = (e) => chunks.push(e.data)
      recorder.onstop = async () => {
        const bytes = new Uint8Array(await new Blob(chunks).arrayBuffer())
        resolve(btoa(String.fromCharCode(...bytes)))
        stream.getTracks().forEach((track) => track.stop())
      }
    })
    recorder.start()
    const timer = setInterval(() => {
      ctx.fillStyle = Date.now() % 2 ? '#bb0016' : '#ffffff'
      ctx.fillRect(0, 0, 64, 64)
    }, 50)
    setTimeout(() => {
      clearInterval(timer)
      recorder.stop()
    }, 500)
    return done
  })
  const videoBuffer = video
    ? Buffer.from(video, 'base64')
    : await readFile(resolve(root, 'test-fixtures/flower.mp4'))
  await dialog
    .locator('input[type=file]')
    .setInputFiles([
      image,
      { name: 'tour.mp4', mimeType: 'video/mp4', buffer: videoBuffer },
      { name: 'room.glb', mimeType: 'model/gltf-binary', buffer: glb },
    ])
  await page
    .locator('.upload-center-heading')
    .filter({ hasText: '3 of 3 ready' })
    .waitFor({ timeout: 30000 })
  assert.equal(await dialog.locator('.mixed-card').count(), 3)
  await dialog.getByRole('button', { name: 'Move tour later' }).click()
  assert.deepEqual(
    await dialog.locator('.mixed-card > strong').allTextContents(),
    ['kitchen', 'room', 'tour'],
  )
  await control({ fail: 'save' })
  await dialog
    .getByRole('button', { name: 'Save changes', exact: true })
    .click()
  await dialog
    .getByText(/Connection lost/)
    .first()
    .waitFor()
  assert.equal(
    await dialog.locator('[name="title"]').inputValue(),
    'Modern Kitchen',
  )
  await dialog.getByRole('button', { name: 'Retry save', exact: true }).click()
  await page
    .getByRole('heading', { name: 'Modern Kitchen', exact: true })
    .waitFor()
  assert.equal((await state()).works.length, 1)
  await page.getByRole('button', { name: 'Edit', exact: true }).first().click()
  dialog = page.getByRole('dialog').first()
  await dialog.locator('[name="title"]').fill('Modern Kitchen revised')
  await dialog.locator('[name="status"]').selectOption('published')
  await dialog
    .getByRole('button', { name: 'Save changes', exact: true })
    .click()
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  await page
    .getByRole('heading', { name: 'Modern Kitchen revised', exact: true })
    .waitFor()
  assert.equal((await state()).works[0].status, 'published')
  // Existing ordering is saved automatically, including mouse drag.
  await page.getByRole('button', { name: 'Edit', exact: true }).first().click()
  dialog = page.getByRole('dialog').first()
  await dialog.getByRole('button', { name: 'Move room earlier' }).click()
  await page
    .getByText('Media order updated.', { exact: true })
    .first()
    .waitFor()
  assert.equal(
    (await state()).media_items.sort((a, b) => a.sort_order - b.sort_order)[0]
      .media_asset_id,
    (await state()).media_assets.find((a) => a.kind === 'model_3d').id,
  )
  await dialog
    .getByRole('button', { name: 'Drag room', exact: true })
    .dragTo(dialog.locator('.mixed-card').nth(1))
  await page.waitForFunction(
    () =>
      document.querySelector('.mixed-card > strong')?.textContent === 'kitchen',
  )
  await page.getByText('Saving media order…').waitFor({ state: 'hidden' })
  assert.equal(
    (await state()).media_items.sort((a, b) => a.sort_order - b.sort_order)[0]
      .media_asset_id,
    (await state()).media_assets.find((a) => a.title === 'kitchen').id,
  )
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  // Keyboard and real touch pointer ordering on tablet.
  await page.setViewportSize({ width: 768, height: 1024 })
  await page.getByRole('button', { name: 'Edit', exact: true }).first().click()
  dialog = page.getByRole('dialog').first()
  await dialog.getByRole('button', { name: 'Move room earlier' }).focus()
  await page.keyboard.press('Enter')
  await page.getByText('Saving media order…').waitFor({ state: 'hidden' })
  assert.equal(
    await dialog.locator('.mixed-card > strong').first().textContent(),
    'room',
  )
  const handle = dialog.getByRole('button', { name: 'Drag room', exact: true })
  await handle.scrollIntoViewIfNeeded()
  await dialog
    .locator('.mixed-card')
    .evaluateAll((els) =>
      Promise.all(
        els.flatMap((el) =>
          el.getAnimations().map((animation) => animation.finished),
        ),
      ),
    )
  const start = await handle.boundingBox(),
    target = await dialog.locator('.mixed-card').nth(1).boundingBox()
  const cdp = await context.newCDPSession(page)
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [
      { x: start.x + start.width / 2, y: start.y + start.height / 2 },
    ],
  })
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [
      { x: target.x + target.width / 2, y: start.y + start.height / 2 },
    ],
  })
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  })
  await page.waitForFunction(
    () =>
      document.querySelector('.mixed-card > strong')?.textContent === 'kitchen',
  )
  await page.getByText('Saving media order…').waitFor({ state: 'hidden' })
  await cdp.detach()
  await dialog
    .getByRole('button', { name: 'Preview room', exact: true })
    .click()
  await page.getByRole('dialog').last().locator('model-viewer').waitFor()
  await page.waitForFunction(
    () => document.querySelector('.model-preview model-viewer')?.loaded,
    {},
    { timeout: 30000 },
  )
  await page
    .getByRole('dialog')
    .last()
    .getByRole('button', { name: 'Close dialog', exact: true })
    .click()
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  await page.setViewportSize({ width: 1440, height: 1000 })
  // Duplicate click guard during a delayed save.
  await page.getByRole('button', { name: 'Edit', exact: true }).first().click()
  dialog = page.getByRole('dialog').first()
  await dialog.locator('[name="location"]').fill('Chennai')
  await control({ delay: 250 })
  await dialog
    .getByRole('button', { name: 'Save changes', exact: true })
    .dblclick()
  await page
    .getByRole('heading', { name: 'Modern Kitchen revised', exact: true })
    .waitFor()
  await control({})
  assert.equal((await state()).works.length, 1)
  // Custom Other room.
  await page
    .getByRole('button', { name: 'Create work', exact: true })
    .first()
    .click()
  dialog = page.getByRole('dialog').first()
  await dialog.locator('[name="title"]').fill('Custom study')
  await dialog.locator('[name="location"]').fill('Chennai')
  await dialog
    .locator('[name="room_category_id"]')
    .selectOption({ label: 'Other' })
  await dialog.locator('[name="custom_room_name"]').fill('Study')
  await dialog
    .getByRole('button', { name: 'Save changes', exact: true })
    .click()
  await page
    .getByRole('heading', { name: 'Custom study', exact: true })
    .waitFor()
  assert.ok((await state()).room_categories.some((r) => r.name === 'Study'))
  // Room cover from an existing work image.
  await page.getByRole('link', { name: 'Rooms', exact: true }).click()
  await page
    .getByRole('button')
    .filter({
      has: page.getByRole('heading', { name: 'Kitchen', exact: true }),
    })
    .click()
  dialog = page.getByRole('dialog').first()
  await dialog
    .getByLabel('Cover image', { exact: true })
    .selectOption({ label: 'kitchen' })
  await dialog
    .getByRole('button', { name: 'Save changes', exact: true })
    .click()
  await page.getByRole('heading', { name: 'Rooms', exact: true }).waitFor()
  assert.ok(
    (await state()).room_categories.find((r) => r.name === 'Kitchen')
      .cover_asset_id,
  )
  await page.getByRole('link', { name: 'Works', exact: true }).click()
  // Unsaved changes dialog and focus return.
  await page
    .getByRole('button', { name: 'Create work', exact: true })
    .first()
    .click()
  dialog = page.getByRole('dialog').first()
  await dialog.locator('[name="title"]').fill('Keep this input')
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  await page
    .getByRole('heading', { name: 'Unsaved changes', exact: true })
    .waitFor()
  await page
    .getByRole('dialog')
    .last()
    .getByRole('button', { name: 'Cancel', exact: true })
    .click()
  assert.equal(
    await dialog.locator('[name="title"]').inputValue(),
    'Keep this input',
  )
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  await page.getByRole('button', { name: 'Leave', exact: true }).click()
  // Failed upload remains retryable, then completes.
  await page.getByRole('link', { name: 'Media Library', exact: true }).click()
  await control({ fail: 'upload' })
  await page
    .locator('input[type=file]')
    .setInputFiles({ ...image, name: 'retry.jpg' })
  await page.getByText('retry.jpg', { exact: true }).first().waitFor()
  await page
    .locator('.upload-center')
    .getByRole('button', { name: 'Retry upload' })
    .waitFor({ timeout: 15000 })
  await page
    .locator('.upload-center')
    .getByRole('button', { name: 'Retry upload' })
    .click()
  await page
    .locator('.upload-center-heading')
    .filter({ hasText: '4 of 4 ready' })
    .waitFor({ timeout: 30000 })
  // Actual offline save retains the user's input for retry.
  await page.getByRole('link', { name: 'Works', exact: true }).click()
  await page
    .locator('.content-card')
    .filter({ hasText: 'Modern Kitchen revised' })
    .getByRole('button', { name: 'Edit', exact: true })
    .click()
  dialog = page.getByRole('dialog').first()
  await dialog.locator('[name="location"]').fill('Coimbatore')
  await context.setOffline(true)
  await dialog
    .getByRole('button', { name: 'Save changes', exact: true })
    .click()
  await dialog
    .getByText(/Connection lost/)
    .first()
    .waitFor()
  assert.equal(
    await dialog.locator('[name="location"]').inputValue(),
    'Coimbatore',
  )
  await context.setOffline(false)
  await dialog.getByRole('button', { name: 'Retry save', exact: true }).click()
  await page
    .getByRole('heading', { name: 'Modern Kitchen revised', exact: true })
    .waitFor()
  await page.getByRole('link', { name: 'Media Library', exact: true }).click()
  // Cancellation while a file is queued/being prepared.
  await control({ delay: 1000 })
  await page.locator('input[type=file]').setInputFiles([
    { ...image, name: 'cancel-one.jpg' },
    { ...image, name: 'cancel-two.jpg' },
    { ...image, name: 'cancel-three.jpg' },
  ])
  await page
    .locator('.upload-center li')
    .filter({ hasText: 'cancel-three.jpg' })
    .getByRole('button', { name: 'Cancel', exact: true })
    .click()
  await page
    .locator('.upload-center li')
    .filter({ hasText: 'cancel-three.jpg' })
    .getByText('Cancelled', { exact: true })
    .waitFor()
  await control({})
  // Invalid format identified by file.
  await page
    .locator('input[type=file]')
    .setInputFiles({
      name: 'wrong.mov',
      mimeType: 'video/quicktime',
      buffer: Buffer.from('invalid'),
    })
  await page
    .locator('.upload-center li')
    .filter({ hasText: 'wrong.mov' })
    .getByText(/Unsupported format/)
    .waitFor()
  // Materials and partner editor reuse.
  await page.getByRole('link', { name: 'Materials', exact: true }).click()
  await page
    .getByRole('button', { name: 'Create material', exact: true })
    .first()
    .click()
  dialog = page.getByRole('dialog').first()
  await dialog.locator('[name="title"]').fill('Oak finish')
  assert.equal(await dialog.locator('[name="tier"] option').count(), 3)
  await dialog.locator('[name="tier"]').selectOption('top')
  await dialog
    .getByRole('button', { name: 'Choose existing', exact: true })
    .click()
  await page
    .getByRole('dialog')
    .last()
    .getByRole('button', { name: 'Existing cover', exact: true })
    .click()
  await dialog
    .getByRole('button', { name: 'Save changes', exact: true })
    .click()
  await page.getByRole('heading', { name: 'Oak finish', exact: true }).waitFor()
  await page.getByRole('link', { name: 'Partners', exact: true }).click()
  await page
    .getByRole('button', { name: 'Create partner', exact: true })
    .first()
    .click()
  dialog = page.getByRole('dialog').first()
  await dialog.locator('[name="title"]').fill('JP collaborator')
  await dialog
    .getByRole('button', { name: 'Choose existing', exact: true })
    .click()
  await page
    .getByRole('dialog')
    .last()
    .getByRole('button', { name: 'Existing cover', exact: true })
    .click()
  await dialog.locator('[name="status"]').selectOption('published')
  await dialog
    .getByRole('button', { name: 'Save changes', exact: true })
    .click()
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  await page
    .getByRole('heading', { name: 'JP collaborator', exact: true })
    .waitFor()
  // Homepage and hero cover, then public website integration.
  await page.getByRole('link', { name: 'Homepage', exact: true }).click()
  await page.getByRole('button', { name: 'Hero', exact: true }).click()
  await page
    .getByRole('button', { name: 'Choose existing', exact: true })
    .click()
  await page
    .getByRole('dialog')
    .last()
    .getByRole('button', { name: 'Existing cover', exact: true })
    .click()
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await page
    .getByRole('button', { name: 'Publish', exact: true })
    .first()
    .click()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Publish', exact: true })
    .click()
  await page.getByText('Homepage published successfully.').waitFor()
  const site = await context.newPage()
  site.on('pageerror', (error) => crashes.push(error.message))
  await site.goto(
    api +
      '/?preview=' +
      (await state()).landing_page_versions.find(
        (v) => v.status === 'published',
      ).id,
  )
  await site.locator('.hero h1').waitFor()
  await site.goto(api + '/#works')
  await site.locator('#entry-form input[name=name]').fill('Local tester')
  await site.locator('#entry-form select[name=city]').selectOption('Dubai')
  await site.locator('#entry-form input[name=phone]').fill('+971 50 123 4567')
  await site.locator('#entry-form button').click()
  await site.locator('.work-card').first().waitFor()
  assert.equal(
    await site.locator('.work-card h3').first().textContent(),
    'Modern Kitchen revised ↗',
  )
  assert.equal(
    await site.locator('.work-card p').first().textContent(),
    'Coimbatore',
  )
  await site.locator('.work-card').first().click()
  await site.locator('#media-stage img').waitFor()
  await site.getByRole('button', { name: 'Next asset' }).click()
  await site.getByRole('button', { name: 'Next asset' }).click()
  await site.locator('#media-stage video').waitFor()
  await site.getByRole('button', { name: 'Close viewer' }).click()
  // Desktop, tablet and mobile overflow/focus checks.
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport)
    await page.goto('http://127.0.0.1:5174/works')
    await page
      .getByRole('heading', { name: 'Modern Kitchen revised', exact: true })
      .waitFor()
    await page.locator('.content-card img').first().waitFor()
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      `Admin overflow at ${viewport.width}`,
    )
    await page.waitForFunction(() =>
      [...document.querySelectorAll('.content-card img')].every(
        (img) => img.complete && img.naturalWidth > 0,
      ),
    )
    assert.ok(
      await page
        .locator('.content-card img')
        .evaluateAll((images) =>
          images.every(
            (img) =>
              img.getBoundingClientRect().height <=
              img.parentElement.getBoundingClientRect().height + 1,
          ),
        ),
      'A preview must not overlap card text',
    )
    await page.screenshot({
      path: resolve(output, `admin-${viewport.width}.png`),
      fullPage: true,
    })
    await site.setViewportSize(viewport)
    await site.goto(
      api +
        '/?preview=' +
        (await state()).landing_page_versions.find(
          (v) => v.status === 'published',
        ).id,
    )
    await site.locator('.hero h1').waitFor()
    assert.ok(
      await site.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      `Site 2 overflow at ${viewport.width}`,
    )
    await site.locator('#loader').waitFor({ state: 'hidden' })
    await site.waitForFunction(() =>
      [...document.querySelectorAll('.hero img, .partner-track img')].every(
        (img) => img.complete && img.naturalWidth > 0,
      ),
    )
    await site.screenshot({
      path: resolve(output, `site2-${viewport.width}.png`),
      fullPage: true,
    })
  }
  await page.emulateMedia({ reducedMotion: 'reduce' })
  assert.equal(
    await page
      .locator('.content-card')
      .first()
      .evaluate((el) => getComputedStyle(el).animationName),
    'none',
  )
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.getByRole('button', { name: 'Edit', exact: true }).first().click()
  dialog = page.getByRole('dialog').first()
  assert.ok(await dialog.evaluate((el) => el.contains(document.activeElement)))
  await dialog.getByRole('button', { name: 'Delete work', exact: true }).click()
  await page
    .getByRole('dialog')
    .last()
    .getByRole('button', { name: 'Delete', exact: true })
    .click()
  await page.getByText('Item deleted successfully.').waitFor()
  assert.equal((await state()).works.length, 1)
  assert.deepEqual(crashes, [])
  console.log(
    'PASS browser sign-in/validation/sign-out, mouse/keyboard/touch ordering, interactive 3D, workflows, measured upload/retry/cancel, validation, dirty/save/delete/publish states, duplicate guard, mixed media, custom rooms, materials, partners, homepage, Site 2 cards/viewer, responsive layout, focus and reduced motion',
  )
} catch (error) {
  await page.screenshot({
    path: resolve(output, 'failure.png'),
    fullPage: true,
  })
  console.error('Browser test failed:', error.stack)
  process.exitCode = 1
} finally {
  await browser.close()
}
