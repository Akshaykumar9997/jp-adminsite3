import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
const { chromium } = createRequire(import.meta.url)('playwright')
const front = 'http://127.0.0.1:5174',
  api = 'http://127.0.0.1:54321'
const config = await (await fetch(front + '/src/lib/supabase.ts')).text()
assert.ok(
  config.includes(api) && config.includes('local-publishable-test-key'),
  'Disposable backend required',
)
await fetch(api + '/test/reset', { method: 'POST' })
const session = await (await fetch(api + '/test/session')).json()
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
page.on('pageerror', (e) => crashes.push(e.message))
let reads = 0,
  signs = 0
page.on('request', (request) => {
  if (request.method() === 'GET' && request.url().includes('/rest/v1/')) reads++
  if (request.url().includes('/storage/v1/object/sign/')) signs++
})
const dialog = page.locator('dialog[open]').last()
const nav = (name) =>
  page.getByRole('navigation').getByRole('link', { name, exact: true }).click()
try {
  await page.goto(front + '/rooms')
  await page.locator('.room-tile').first().waitFor()
  assert.equal(await page.title(), 'JP Aluminium Admin site')
  assert.equal((await page.locator('.environment').textContent()).trim(), 'Admin site')
  await page
    .getByRole('button', { name: 'Add room', exact: true })
    .first()
    .click()
  assert.equal(await dialog.locator('input[type=file]').count(), 0)
  assert.equal(
    await dialog.getByRole('button', { name: /Choose existing/ }).count(),
    0,
  )
  await dialog
    .getByRole('combobox', { name: 'Visibility', exact: true })
    .click()
  assert.equal(await dialog.getByRole('option').count(), 2)
  await dialog
    .getByRole('option', {
      name: 'Published — visible on website',
      exact: true,
    })
    .click()
  await dialog.locator('[name=title]').fill('Dining room 2')
  await dialog
    .getByRole('button', { name: 'Publish room', exact: true })
    .click()
  await page.locator('dialog[open]').waitFor({ state: 'hidden' })
  await page
    .getByRole('heading', { name: 'Dining room 2', exact: true })
    .waitFor()
  await page
    .locator('.room-tile')
    .filter({
      has: page.getByRole('heading', { name: 'Dining room 2', exact: true }),
    })
    .click()
  await page
    .getByRole('button', { name: 'Add work', exact: true })
    .first()
    .click()
  await dialog.locator('[name=title]').fill('Dining work')
  await dialog.locator('[name=location]').fill('Chennai')
  await dialog
    .locator('input[type=file]')
    .first()
    .setInputFiles({
      name: 'Cache photograph.jpg',
      mimeType: 'image/jpeg',
      buffer: await readFile(
        new URL('../public/assets/project-01.jpg', import.meta.url),
      ),
    })
  await page.getByText('✓ Ready', { exact: true }).waitFor()
  await dialog
    .getByRole('button', { name: 'Save changes', exact: true })
    .click()
  await page.locator('dialog[open]').waitFor({ state: 'hidden' })
  await page
    .getByRole('heading', { name: 'Dining work', exact: true })
    .waitFor()
  await nav('Media Library')
  await page.locator('.gallery-tile').first().waitFor()
  await page.waitForFunction(() =>
    Array.from(document.querySelectorAll('.gallery-tile img')).some(
      (img) => img.complete && img.naturalWidth > 0,
    ),
  )
  const before = { reads, signs }
  await nav('Materials')
  await page.getByRole('heading', { name: 'Materials', exact: true }).waitFor()
  await nav('Media Library')
  await page.locator('.gallery-tile').first().waitFor()
  assert.equal(
    reads,
    before.reads,
    'Warm tab navigation should reuse workspace data',
  )
  assert.equal(
    signs,
    before.signs,
    'Warm tab navigation should reuse exact signed preview URLs',
  )
  assert.equal(
    await page.getByText('Loading showcase content…', { exact: true }).count(),
    0,
  )
  const tileCount = await page.locator('.gallery-tile').count()
  await context.route('**/rest/v1/**', (route) => route.abort('failed'))
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await page
    .getByText(/Could not refresh. Showing previously loaded content/)
    .waitFor()
  assert.equal(
    await page.locator('.gallery-tile').count(),
    tileCount,
    'Failed refresh must retain content',
  )
  await context.unroute('**/rest/v1/**')
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await page.waitForResponse(
    (response) =>
      response.url().includes('/rest/v1/media_assets') && response.ok(),
  )
  await nav('Rooms')
  await page
    .getByRole('heading', { name: 'Dining room 2', exact: true })
    .waitFor()
  const state = await (await fetch(api + '/test/state')).json()
  assert.equal(
    state.media_items.filter((item) => item.owner_kind === 'room').length,
    0,
  )
  assert.equal(
    state.media_items.filter((item) => item.owner_kind === 'work').length,
    1,
  )
  assert.ok(
    state.room_categories.every(
      (room) =>
        room.is_custom && ['published', 'archived'].includes(room.status),
    ),
  )
  assert.deepEqual(crashes, [])
  const loginContext = await browser.newContext()
  const loginPage = await loginContext.newPage()
  await loginPage.goto(front + '/login')
  await loginPage.getByRole('button', { name: 'Sign in to Admin site', exact: true }).waitFor()
  assert.equal(await loginPage.title(), 'JP Aluminium Admin site')
  assert.equal(await loginPage.getByText(/\bCMS\b/).count(), 0)
  await loginContext.close()
  console.log(
    'PASS: Two-option room form, no room uploads, room → work → assets, warm navigation without refetch/re-sign/skeleton, offline refresh retention and recovery.',
  )
} finally {
  await browser.close()
}
