import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFile, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
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
const choose = async (label, option) => {
  await page.getByRole('combobox', { name: label, exact: true }).click()
  await page.getByRole('option', { name: option, exact: true }).click()
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
const output = resolve(import.meta.dirname, '../test-results')
await mkdir(output, { recursive: true })
try {
  await page.goto(front + '/media')
  await page.locator('input[type=file]').setInputFiles({
    name: 'Rollout image.jpg',
    mimeType: 'image/jpeg',
    buffer: await readFile(
      resolve(import.meta.dirname, '../public/assets/project-01.jpg'),
    ),
  })
  await page.getByText('✓ Ready', { exact: true }).waitFor()
  await page
    .getByRole('button', { name: 'Dismiss uploads', exact: true })
    .click()
  const asset = (await state()).media_assets.find(
    (a) => a.title === 'Rollout image',
  )
  const room = await save('room', { title: 'Rollout room', status: 'archived' })
  await save(
    'work',
    {
      title: 'Rollout work',
      location: 'Chennai',
      room_category_id: room,
      status: 'archived',
    },
    [asset.id],
  )
  await save(
    'material',
    { title: 'Rollout oak', tier: 'mid', status: 'archived' },
    [asset.id],
  )
  await save('partner', { title: 'Rollout studio', status: 'archived' }, [
    asset.id,
  ])
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 })
    for (const route of ['rooms', 'materials', 'partners', 'trash']) {
      await page.goto(front + '/' + route)
      await page.locator('.gallery-page h1').waitFor()
      if (width <= 768) {
        assert.equal(
          await page
            .getByRole('navigation', { name: 'Gallery navigation' })
            .getByRole('link')
            .count(),
          5,
        )
        await page
          .getByRole('navigation', { name: 'Gallery navigation' })
          .getByRole('link', { name: 'Partners', exact: true })
          .waitFor()
      }
      assert.equal(
        await page.locator('select').count(),
        0,
        `${route} still has native menus`,
      )
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${route} overflow at ${width}`,
      )
      const control = page.getByRole('combobox').first()
      await control.click()
      const bounds = await page
        .locator('.ui-dropdown-menu:popover-open')
        .boundingBox()
      assert.ok(
        bounds.x >= 0 &&
          bounds.y >= 0 &&
          bounds.x + bounds.width <= width + 1 &&
          bounds.y + bounds.height <= 1001,
        `${route} menu bounds ${width}`,
      )
      await page.keyboard.press('Escape')
      assert.equal(await control.getAttribute('aria-expanded'), 'false')
      const search = page.locator('.gallery-toolbar > input')
      await search.fill('No rollout matches')
      await page
        .getByRole('button', { name: 'Clear filters', exact: true })
        .waitFor()
      await page.locator('.gallery-empty-illustration').waitFor()
      await page.screenshot({
        path: resolve(output, `rollout-${route}-empty-${width}.png`),
        animations: 'disabled',
      })
      await page
        .getByRole('button', { name: 'Clear filters', exact: true })
        .click()
      if (route !== 'trash') {
        await choose('Gallery density', 'Compact')
        assert.ok(await page.locator('.is-compact').count())
        await page.getByRole('button', { name: 'Select', exact: true }).click()
        await page
          .getByRole('button', { name: 'Select all results', exact: true })
          .click()
        const selection = page.getByRole('region', {
          name: 'Selection actions',
        })
        assert.ok(
          await selection
            .getByRole('combobox', { name: 'Bulk visibility' })
            .count(),
        )
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          `${route} selection overflow ${width}`,
        )
        await page.screenshot({
          path: resolve(output, `rollout-${route}-selection-${width}.png`),
          animations: 'disabled',
        })
        await selection
          .getByRole('button', { name: 'Done', exact: true })
          .click()
      }
    }
  }
  // Album viewers share rename, gestures and safe in-use Trash behavior.
  for (const [route, title] of [
    ['materials', 'Rollout oak'],
    ['partners', 'Rollout studio'],
  ]) {
    await page.goto(front + '/' + route)
    await page
      .getByRole('button', { name: `Open ${title}`, exact: true })
      .click()
    await dialog.getByRole('button', { name: /^Preview Rollout image/ }).click()
    await dialog.getByRole('button', { name: 'Edit name', exact: true }).click()
    await dialog
      .getByRole('textbox', { name: 'File name', exact: true })
      .fill(`Rollout image ${route}`)
    await dialog.getByRole('button', { name: 'Save name', exact: true }).click()
    await dialog
      .getByRole('heading', { name: `Rollout image ${route}`, exact: true })
      .waitFor()
    assert.equal(
      (await state()).media_assets.find((a) => a.id === asset.id).storage_path,
      asset.storage_path,
    )
    await dialog.getByRole('button', { name: 'Trash', exact: true }).click()
    await dialog
      .getByRole('button', { name: 'Move to Trash', exact: true })
      .click()
    await dialog
      .getByRole('alert')
      .filter({ hasText: 'still in use' })
      .waitFor()
    await dialog
      .getByRole('button', { name: 'Close dialog', exact: true })
      .click()
    await dialog
      .getByRole('button', { name: 'Close dialog', exact: true })
      .click()
  }
  // Dropdown form values participate in validation and unsaved-change protection.
  await page.goto(front + '/rooms')
  await page
    .getByRole('button', { name: 'Kitchen', exact: false })
    .first()
    .click()
  await page
    .getByRole('button', { name: 'Add work', exact: true })
    .first()
    .click()
  await dialog
    .getByRole('button', { name: 'Save changes', exact: true })
    .click()
  await dialog.getByText('Please enter work title.').waitFor()
  await choose('Visibility', 'Archived — admins only')
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  await dialog
    .getByRole('heading', { name: 'Unsaved changes', exact: true })
    .waitFor()
  await dialog.getByRole('button', { name: 'Leave', exact: true }).click()
  // Bulk Partner Trash and restore preserve its logo association.
  await page.goto(front + '/partners')
  await page.getByRole('button', { name: 'Select', exact: true }).click()
  await page
    .getByRole('checkbox', { name: 'Select Rollout studio', exact: true })
    .check()
  await page
    .getByRole('region', { name: 'Selection actions' })
    .getByRole('button', { name: 'Trash', exact: true })
    .click()
  await dialog
    .getByRole('button', { name: 'Move to Trash', exact: true })
    .click()
  await page
    .getByRole('heading', { name: 'No partners here yet', exact: true })
    .waitFor()
  await page.goto(front + '/trash')
  await choose('Trash type', 'Partners')
  await page
    .getByRole('button', { name: 'Open Rollout studio', exact: true })
    .click()
  await page.getByRole('button', { name: 'Restore', exact: true }).click()
  await page
    .getByRole('heading', { name: 'No matching items', exact: true })
    .waitFor()
  const restored = (await state()).partners.find(
    (p) => p.name === 'Rollout studio',
  )
  assert.equal(restored.status, 'archived')
  assert.equal(restored.logo_asset_id, asset.id)
  assert.deepEqual(crashes, [])
  console.log(
    'PASS full gallery rollout: Rooms/Materials/Partners/Trash at 320/390/768/1440, menu keyboard/bounds, filter reset, illustrated empty states, density, multi-selection, shared album rename/in-use guards, form validation/unsaved changes, Partner Trash/restore and logo preservation.',
  )
} finally {
  await browser.close()
}
