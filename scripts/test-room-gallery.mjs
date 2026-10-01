import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFile, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
const { chromium } = createRequire(import.meta.url)('playwright')
const root = resolve(import.meta.dirname, '..'),
  output = resolve(root, 'test-results')
await mkdir(output, { recursive: true })
const front = 'http://127.0.0.1:5174',
  api = 'http://127.0.0.1:54321'
const config = await (await fetch(front + '/src/lib/supabase.ts')).text()
assert.ok(
  config.includes('http://127.0.0.1:54321') &&
    config.includes('local-publishable-test-key'),
  'Refusing writes outside the disposable local configuration',
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
const dialog = page.locator('dialog[open]').last()
const save = async () => {
  await dialog
    .getByRole('button', { name: /^(Save changes|Retry save)$/ })
    .click()
  await page.locator('dialog[open]').waitFor({ state: 'hidden' })
}
const image = {
  name: 'A very long descriptive interior photograph filename.jpg',
  mimeType: 'image/jpeg',
  buffer: await readFile(resolve(root, 'public/assets/project-01.jpg')),
}
try {
  await page.goto(front + '/rooms')
  await page.locator('.room-tile').first().waitFor()
  assert.equal(await page.locator('.room-tile').count(), 8)
  const promotedRoom = await page.locator('.room-tile h2').nth(1).textContent()
  await page
    .getByRole('button', { name: `Move ${promotedRoom} earlier`, exact: true })
    .click()
  await page.waitForFunction(
    (name) => document.querySelector('.room-tile h2')?.textContent === name,
    promotedRoom,
  )
  await page.reload()
  await page.locator('.room-tile').first().waitFor()
  assert.equal(
    await page.locator('.room-tile h2').first().textContent(),
    promotedRoom,
  )
  await page.screenshot({
    path: resolve(output, 'rooms-mobile.png'),
    animations: 'disabled',
  })
  for (const name of ['Works', 'Homepage', 'Settings'])
    assert.equal(
      await page
        .getByRole('navigation')
        .getByRole('link', { name, exact: true })
        .count(),
      0,
    )
  await page
    .locator('.room-tile')
    .filter({ has: page.getByRole('heading', { name: 'Hall', exact: true }) })
    .click()
  await page
    .getByRole('button', { name: 'Add work', exact: true })
    .first()
    .click()
  assert.equal(
    await dialog.locator('[name=room_category_id]').isVisible(),
    false,
  )
  await dialog
    .getByRole('button', { name: 'Save changes', exact: true })
    .click()
  await dialog.getByText('Please enter work title.', { exact: true }).waitFor()
  await dialog.locator('[name=title]').fill('First room album')
  await dialog.locator('[name=location]').fill('Chennai')
  await dialog
    .locator('input[type=file]')
    .first()
    .setInputFiles([image, { ...image, name: 'Second photograph.jpg' }])
  await page.waitForFunction(
    () =>
      document.querySelectorAll('.mixed-card').length === 2 &&
      !document.querySelector('.upload-center'),
  )
  assert.equal(await page.locator('.notification-layer dialog').count(), 0)
  assert.equal(
    await page
      .locator('.notification-layer')
      .evaluate((el) => el.matches(':popover-open')),
    true,
  )
  // Notification is in its own top layer, not embedded inside the form.
  await page.screenshot({
    path: resolve(output, 'room-editor-upload-desktop.png'),
  })
  await save()
  await page.locator('.work-album').waitFor()
  assert.equal(await page.locator('.album-tile').count(), 2)
  let data = await state(),
    first = data.works.find((w) => w.title === 'First room album')
  assert.equal(first.sort_order, 0)
  await page
    .getByRole('button', { name: 'Add work', exact: true })
    .first()
    .click()
  await dialog.locator('[name=title]').fill('Second room album')
  await dialog.locator('[name=location]').fill('Bengaluru')
  await save()
  await page
    .getByRole('heading', { name: 'Second room album', exact: true })
    .waitFor()
  assert.equal(
    (await state()).works.find((w) => w.title === 'Second room album')
      .sort_order,
    1,
  )
  await page
    .getByRole('button', {
      name: 'Move Second room album earlier',
      exact: true,
    })
    .click()
  await page.waitForFunction(
    () =>
      document.querySelector('.work-album h2')?.textContent ===
      'Second room album',
  )
  await page.reload()
  await page.locator('.work-album').first().waitFor()
  assert.equal(
    await page.locator('.work-album h2').first().textContent(),
    'Second room album',
  )
  await page
    .locator('.work-album')
    .filter({
      has: page.getByRole('heading', { name: 'First room album', exact: true }),
    })
    .getByRole('button', { name: 'Edit work', exact: true })
    .click()
  await dialog.locator('[name=status]').selectOption('published')
  await dialog
    .getByRole('button', { name: 'Publish work', exact: true })
    .click()
  await page.locator('dialog[open]').waitFor({ state: 'hidden' })
  data = await state()
  assert.equal(data.works.find((w) => w.id === first.id).status, 'published')
  assert.ok(data.works.find((w) => w.id === first.id).published_at)
  // Failed save retains edits for a deliberate retry.
  await page
    .locator('.work-album')
    .filter({
      has: page.getByRole('heading', { name: 'First room album', exact: true }),
    })
    .getByRole('button', { name: 'Edit work', exact: true })
    .click()
  await dialog.locator('[name=title]').fill('First room album edited')
  await fetch(api + '/test/control', {
    method: 'POST',
    body: JSON.stringify({ fail: 'save' }),
  })
  await dialog
    .getByRole('button', { name: 'Save changes', exact: true })
    .click()
  await dialog.locator('p[role=alert]').waitFor()
  await page.locator('[data-sonner-toast]').last().waitFor()
  await page
    .locator('[data-sonner-toast][data-front=true]')
    .getByRole('button', { name: 'Close toast' })
    .click({ timeout: 5000 })
  assert.equal(
    await dialog.locator('[name=title]').inputValue(),
    'First room album edited',
  )
  await save()
  await page
    .getByRole('heading', { name: 'First room album edited', exact: true })
    .waitFor()
  // Preview opens real media, then restores gallery focus.
  await page.locator('.album-tile').first().click()
  await dialog.locator('.large-preview img').waitFor()
  await dialog.getByRole('button', { name: 'Close dialog' }).click()
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await page.screenshot({
      path: resolve(output, `room-gallery-${width}.png`),
      animations: 'disabled',
    })
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `Gallery overflow at ${width}`,
    )
    await page
      .locator('.work-album')
      .filter({
        has: page.getByRole('heading', {
          name: 'First room album edited',
          exact: true,
        }),
      })
      .getByRole('button', { name: 'Edit work', exact: true })
      .click()
    await dialog
      .getByRole('heading', { name: 'Edit work', exact: true })
      .waitFor()
    await page.screenshot({
      path: resolve(output, `room-editor-${width}.png`),
      animations: 'disabled',
    })
    const overflow = await dialog.evaluate((el) => ({
      width: el.clientWidth,
      scroll: el.scrollWidth,
      items: Array.from(el.querySelectorAll('*'))
        .filter((e) => e.getBoundingClientRect().right > innerWidth + 1)
        .map((e) => ({
          tag: e.tagName,
          class: e.className,
          text: e.textContent?.slice(0, 40),
        }))
        .slice(0, 12),
    }))
    assert.ok(
      overflow.scroll <= overflow.width + 1,
      `Editor overflow at ${width}: ${JSON.stringify(overflow)}`,
    )
    await dialog.getByRole('button', { name: 'Close dialog' }).click()
    if (width <= 820) {
      const menu = page.getByRole('button', { name: 'Toggle navigation' })
      await menu.click()
      assert.equal(await page.locator('.app-frame').getAttribute('inert'), '')
      await page.keyboard.press('Escape')
      assert.equal(await menu.getAttribute('aria-expanded'), 'false')
      assert.equal(await page.locator('.sidebar').getAttribute('inert'), '')
    }
  }
  // Obsolete routes cannot expose editing controls.
  for (const route of ['/works', '/settings', '/landing']) {
    await page.goto(front + route)
    await page.locator('.room-tile').first().waitFor()
    assert.equal(new URL(page.url()).pathname, '/rooms')
  }
  await page.setViewportSize({ width: 390, height: 900 })
  await page.screenshot({
    path: resolve(output, 'rooms-mobile.png'),
    animations: 'disabled',
  })
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    'Room grid mobile overflow',
  )
  // Custom rooms, materials and partners retain their real creation/edit flows.
  await page.getByRole('button', { name: 'Add room', exact: true }).click()
  await dialog.locator('[name=title]').fill('Local custom lounge')
  await save()
  await page
    .locator('.room-tile')
    .filter({
      has: page.getByRole('heading', {
        name: 'Local custom lounge',
        exact: true,
      }),
    })
    .waitFor()
  assert.ok(
    (await state()).room_categories.some(
      (r) => r.name === 'Local custom lounge' && r.is_custom,
    ),
  )
  for (const [route, kind, name] of [
    ['materials', 'material', 'Local oak'],
    ['partners', 'partner', 'Local studio'],
  ]) {
    await page.goto(front + '/' + route)
    await page
      .getByRole('button', { name: `Create ${kind}`, exact: true })
      .click()
    await dialog.locator('[name=title]').fill(name)
    if (kind === 'material') {
      assert.equal(await dialog.locator('[name=tier]').inputValue(), 'mid')
      await dialog.locator('[name=tier]').selectOption('top')
    }
    await save()
    await page.getByRole('heading', { name, exact: true }).waitFor()
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `${route} overflow`,
    )
    await page
      .getByRole('button', { name: 'Edit', exact: true })
      .first()
      .click()
    await dialog.locator('[name=status]').selectOption('archived')
    await save()
    assert.equal(
      (await state())[route].find((r) => r.name === name).status,
      'archived',
    )
    await page
      .getByRole('button', { name: 'Edit', exact: true })
      .first()
      .click()
    await dialog.locator('[name=status]').selectOption('draft')
    await save()
    assert.equal(
      (await state())[route].find((r) => r.name === name).status,
      'draft',
    )
  }
  // Failed upload can be retried without keeping completed upload histories.
  await page.goto(front + '/media')
  await page
    .getByRole('heading', { name: 'Media Library', exact: true })
    .waitFor()
  await fetch(api + '/test/control', {
    method: 'POST',
    body: JSON.stringify({ fail: 'upload' }),
  })
  await page
    .locator('input[type=file]')
    .setInputFiles({ ...image, name: 'Retry upload.jpg' })
  await page
    .locator('.upload-center')
    .getByRole('button', { name: 'Retry upload', exact: true })
    .waitFor()
  await page
    .locator('.upload-center')
    .getByRole('button', { name: 'Retry upload', exact: true })
    .click()
  await page.locator('.upload-center').waitFor({ state: 'hidden' })
  await page
    .getByRole('heading', { name: 'Retry upload', exact: true })
    .waitFor()
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    'Media library overflow',
  )
  assert.equal(await page.locator('.upload-center').count(), 0)
  // Static Site 2 copy does not require a landing-page version.
  const publicPage = await context.newPage()
  await publicPage.goto(api + '/#home')
  await publicPage.waitForFunction(() =>
    window.JPShowcase?.snapshot.works.some(
      (w) => w.title === 'First room album edited',
    ),
  )
  assert.equal(
    await publicPage.evaluate(() => window.JPShowcase.snapshot.version),
    null,
  )
  await publicPage.close()
  assert.deepEqual(crashes, [])
  console.log(
    'PASS: room navigation, validation, image uploads, external notifications, work ordering/reload, direct publication, failed-save retry, previews, retired routes, mobile navigation and 320/390/768/1440 layouts.',
  )
} finally {
  await browser.close()
}
