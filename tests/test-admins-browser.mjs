// Disposable backend only. Never reads credentials or writes to hosted Supabase.
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdir, readFile } from 'node:fs/promises'
import ExcelJS from 'exceljs'
import { resolve } from 'node:path'
const { chromium } = createRequire(import.meta.url)('playwright')
const root = resolve(import.meta.dirname, '..')
const ownId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const otherId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const newId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const clientId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const now = new Date().toISOString()
const profiles = [
  {
    id: ownId,
    email: 'current@example.test',
    full_name: 'Current Admin',
    role: 'admin',
    created_at: now,
    access_revoked_at: null,
  },
  {
    id: otherId,
    email: 'other@example.test',
    full_name: 'Other Admin',
    role: 'admin',
    created_at: now,
    access_revoked_at: null,
  },
  {
    id: clientId,
    email: 'client@example.test',
    full_name: 'Existing Client',
    role: 'client',
    created_at: now,
    access_revoked_at: null,
  },
]
const token = `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: ownId, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.disposable-signature`
const user = {
  id: ownId,
  email: profiles[0].email,
  aud: 'authenticated',
  role: 'authenticated',
  app_metadata: {},
  user_metadata: {},
  created_at: now,
}
const session = {
  access_token: token,
  refresh_token: 'disposable-refresh',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  token_type: 'bearer',
  user,
}
const credentialCalls = []
let upstreamFailure = false
let crmFailure = false
const crmReads = []
const crmRows = Array.from({ length: 501 }, (_, index) => ({
  id: index + 1, name: `Lead ${index + 1}`, status: index === 0 ? 'Pending' : 'CONVERTED',
  created_at: '2026-10-08T08:00:00Z', contact: '0123456789', email: null,
  address: 'Test Street', comment: '=1+1', referral_source: 'Website', referral_details: null,
  latitude: null, longitude: null, user_id: null,
}))
const backend = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost')
  const send = (status, body, headers = {}) => {
    res.writeHead(status, {
      'Content-Type': 'application/json',
      ...(!url.pathname.startsWith('/functions/')
        ? {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': '*',
            'Access-Control-Allow-Methods': 'GET,POST,DELETE,HEAD,OPTIONS',
          }
        : {}),
      ...headers,
    })
    res.end(req.method === 'HEAD' ? undefined : JSON.stringify(body))
  }
  if (req.method === 'OPTIONS')
    return send(url.pathname.startsWith('/functions/') ? 405 : 204, {})
  if (req.headers.authorization !== `Bearer ${token}`)
    return send(401, { message: 'Invalid test token' })
  if (url.pathname === '/auth/v1/user') return send(200, user)
  if (url.pathname === '/auth/v1/logout') return send(204, {})
  if (url.pathname === '/rest/v1/rpc/is_admin') return send(200, true)
  if (['/rest/v1/leads', '/rest/v1/customer_support'].includes(url.pathname)) {
    assert.equal(req.method, 'GET', 'CRM tables must never receive mutations from the admin site')
    assert.equal(req.headers['accept-profile'], 'crm')
    crmReads.push(url.pathname)
    if (crmFailure) return send(503, { message: 'Unavailable' })
    const data = url.pathname.endsWith('/leads') ? crmRows : [{
      id: 'support-test', name: 'Support Person', phone: '+971 50 123 4567', city: 'Dubai',
      email: 'support@example.test', reference: 'JP-TEST', reason: 'Warranty question',
      preferred_contact: 'Email', message: 'Please clarify my warranty.', consent: true, created_at: now,
    }]
    const offset = Number(url.searchParams.get('offset') || 0)
    const limit = Number(url.searchParams.get('limit') || 500)
    return send(200, data.slice(offset, offset + limit))
  }
  if (url.pathname === '/rest/v1/profiles') {
    assert.equal(
      req.headers['accept-profile'] || req.headers['content-profile'],
      'identity',
    )
    let rows = profiles.filter((row) =>
      [...url.searchParams].every(([key, value]) => {
        if (['select', 'order'].includes(key)) return true
        if (value.startsWith('eq.')) return row[key] === value.slice(3)
        if (value.startsWith('ilike.'))
          return (
            row[key]?.toLowerCase() ===
            value
              .slice(6)
              .replace(/\\([_%\\])/g, '$1')
              .toLowerCase()
          )
        if (value === 'is.null') return row[key] === null
        throw new Error('Unexpected test filter: ' + key)
      }),
    )
    if (req.method === 'DELETE') {
      for (const row of rows) profiles.splice(profiles.indexOf(row), 1)
      return send(
        200,
        rows.map(({ id }) => ({ id })),
      )
    }
    if (req.method === 'HEAD')
      return send(200, null, {
        'Content-Range': `0-${Math.max(0, rows.length - 1)}/${rows.length}`,
      })
    if (req.headers.accept?.includes('vnd.pgrst.object'))
      return rows.length === 1
        ? send(200, rows[0])
        : send(406, {
            code: 'PGRST116',
            details: 'The result contains 0 rows',
            message: 'No rows',
          })
    return send(200, rows)
  }
  if (url.pathname === '/functions/v1/create-admin-account') {
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    const body = JSON.parse(Buffer.concat(chunks).toString())
    credentialCalls.push(body)
    if (upstreamFailure) return send(500, { error: 'private-upstream-detail' })
    const existing = profiles.find((row) => row.email === body.email)
    if (!existing)
      profiles.push({
        id: newId,
        email: body.email,
        full_name: body.full_name,
        role: 'admin',
        created_at: now,
        access_revoked_at: null,
      })
    return send(200, { success: true, user_id: existing?.id || newId })
  }
  return send(404, { error: 'Unexpected disposable endpoint: ' + url.pathname })
})
await new Promise((resolve) => backend.listen(0, '127.0.0.1', resolve))
const api = `http://127.0.0.1:${backend.address().port}`
const front = 'http://127.0.0.1:5186'
const vite = spawn(
  process.execPath,
  [
    'node_modules/vite/bin/vite.js',
    '--host',
    '127.0.0.1',
    '--port',
    '5186',
    '--strictPort',
  ],
  {
    cwd: root,
    env: {
      ...process.env,
      VITE_SUPABASE_URL: api,
      VITE_SUPABASE_PUBLISHABLE_KEY: 'local-publishable-test-key',
      SUPABASE_URL: api,
      SUPABASE_PUBLISHABLE_KEY: 'local-publishable-test-key',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  },
)
let viteOutput = ''
vite.stdout.on('data', (data) => {
  viteOutput += data
})
vite.stderr.on('data', (data) => {
  viteOutput += data
})
let browser
try {
  let ready = false
  for (let i = 0; i < 80; i++) {
    if (vite.exitCode !== null) throw new Error(viteOutput)
    try {
      if ((await fetch(front)).ok) {
        ready = true
        break
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  assert.ok(ready, viteOutput)
  const source = await (await fetch(front + '/src/lib/supabase.ts')).text()
  assert.ok(
    source.includes(api) && source.includes('local-publishable-test-key'),
    'Disposable configuration required',
  )
  assert.equal(
    (
      await fetch(front + '/api/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{"action":"list"}',
      })
    ).status,
    401,
  )
  assert.equal(
    (
      await fetch(front + '/api/admins', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'create', password: 'x'.repeat(9000) }),
      })
    ).status,
    413,
  )
  browser = await chromium.launch({
    ...(process.env.PLAYWRIGHT_CHANNEL
      ? { channel: process.env.PLAYWRIGHT_CHANNEL }
      : {}),
    headless: true,
  })
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'reduce',
  })
  await context.addInitScript(
    (value) => localStorage.setItem('sb-127-auth-token', JSON.stringify(value)),
    session,
  )
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto(front + '/admins')
  await page.getByRole('heading', { name: 'Manage Admins' }).waitFor()
  await page
    .getByRole('heading', { name: 'Other Admin', exact: true })
    .waitFor()
  assert.ok(await page.getByRole('link', { name: 'Manage Admins' }).count())
  assert.equal(await page.locator('.admin-card').count(), 2)
  assert.equal(
    await page
      .locator('.admin-card')
      .filter({ hasText: 'Current Admin' })
      .getByRole('button', { name: 'Remove', exact: true })
      .isDisabled(),
    true,
  )
  assert.equal(await page.getByText('Existing Client').count(), 0)

  const add = async (email, name) => {
    await page.getByRole('button', { name: 'Add Admin', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Add Admin' })
    await dialog.getByLabel('Full name', { exact: true }).fill(name)
    await dialog.getByLabel('Email', { exact: true }).fill(email)
    await dialog
      .getByLabel('Initial password', { exact: true })
      .fill('secret123')
    await dialog
      .getByLabel('Confirm password', { exact: true })
      .fill('secret123')
    return dialog
  }
  let dialog = await add('new@example.test', 'New Admin')
  await dialog
    .getByLabel('Confirm password', { exact: true })
    .fill('different123')
  await dialog
    .getByRole('button', { name: 'Create Admin', exact: true })
    .click()
  await dialog
    .getByRole('alert')
    .filter({ hasText: 'Passwords do not match' })
    .waitFor()
  assert.equal(credentialCalls.length, 0)
  await dialog.getByLabel('Confirm password', { exact: true }).fill('secret123')
  await dialog.getByLabel('Show password', { exact: true }).check()
  assert.equal(
    await dialog
      .getByLabel('Initial password', { exact: true })
      .getAttribute('type'),
    'text',
  )
  await dialog
    .getByRole('button', { name: 'Create Admin', exact: true })
    .click()
  await page.getByRole('heading', { name: 'New Admin', exact: true }).waitFor()
  assert.equal(credentialCalls.length, 1)
  assert.equal(credentialCalls[0].email, 'new@example.test')

  const newCard = page.locator('.admin-card').filter({ hasText: 'New Admin' })
  await newCard.getByRole('button', { name: 'Change password' }).click()
  dialog = page.getByRole('dialog', { name: 'Change admin password' })
  assert.equal(
    await dialog.getByLabel('New password', { exact: true }).inputValue(),
    '',
  )
  await dialog.getByLabel('New password', { exact: true }).fill('updated123')
  await dialog
    .getByLabel('Confirm password', { exact: true })
    .fill('updated123')
  await dialog
    .getByRole('button', { name: 'Save password', exact: true })
    .click()
  await dialog.waitFor({ state: 'hidden' })
  assert.equal(credentialCalls.length, 2)
  assert.equal(credentialCalls[1].password, 'updated123')

  dialog = await add('client@example.test', 'Existing Client')
  await dialog
    .getByRole('button', { name: 'Create Admin', exact: true })
    .click()
  await dialog
    .getByRole('alert')
    .filter({ hasText: 'client or worker' })
    .waitFor()
  assert.equal(credentialCalls.length, 2)
  assert.equal(profiles.find((row) => row.id === clientId).role, 'client')
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  await page
    .getByRole('dialog', { name: 'Discard changes?' })
    .getByRole('button', { name: 'Discard', exact: true })
    .click()
  await dialog.waitFor({ state: 'hidden' })

  upstreamFailure = true
  await newCard.getByRole('button', { name: 'Change password' }).click()
  dialog = page.getByRole('dialog', { name: 'Change admin password' })
  await dialog.getByLabel('New password', { exact: true }).fill('failed123')
  await dialog.getByLabel('Confirm password', { exact: true }).fill('failed123')
  await dialog
    .getByRole('button', { name: 'Save password', exact: true })
    .click()
  await dialog
    .getByRole('alert')
    .filter({ hasText: 'could not be confirmed' })
    .waitFor()
  assert.equal(
    await dialog.getByLabel('New password', { exact: true }).inputValue(),
    'failed123',
  )
  assert.equal(await dialog.getByText('private-upstream-detail').count(), 0)
  assert.equal(credentialCalls.length, 3)
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  await page
    .getByRole('dialog', { name: 'Discard changes?' })
    .getByRole('button', { name: 'Discard', exact: true })
    .click()
  await dialog.waitFor({ state: 'hidden' })
  upstreamFailure = false

  await newCard.getByRole('button', { name: 'Remove', exact: true }).click()
  await page
    .getByRole('dialog', { name: 'Remove administrator?' })
    .getByRole('button', { name: 'Cancel', exact: true })
    .click()
  assert.ok(profiles.some((row) => row.id === newId))
  await newCard.getByRole('button', { name: 'Remove', exact: true }).click()
  await page
    .getByRole('dialog', { name: 'Remove administrator?' })
    .getByRole('button', { name: 'Remove admin', exact: true })
    .click()
  await newCard.waitFor({ state: 'hidden' })
  assert.ok(!profiles.some((row) => row.id === newId))
  const output = resolve(root, 'test-results')
  await mkdir(output, { recursive: true })
  const screenshotOptions = {
    fullPage: true,
    animations: 'disabled',
    style: '.notification-layer { visibility: hidden; }',
  }
  await page.screenshot({
    path: resolve(output, 'admins-desktop.png'),
    ...screenshotOptions,
  })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({
    path: resolve(output, 'admins-mobile.png'),
    ...screenshotOptions,
  })
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
    'Mobile page must not overflow',
  )
  await page.getByRole('button', { name: 'Add Admin', exact: true }).click()
  await page.getByRole('dialog', { name: 'Add Admin' }).waitFor()
  await page.screenshot({
    path: resolve(output, 'admins-mobile-dialog.png'),
    ...screenshotOptions,
  })
  await page.getByRole('dialog', { name: 'Add Admin' }).getByRole('button', { name: 'Cancel', exact: true }).click()
  await page.goto(front + '/leads')
  await page.locator('.crm-table tbody tr').first().waitFor()
  assert.equal(await page.locator('.crm-table tbody tr').count(), 50)
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await page.getByText('Page 2 of 11').waitFor()
  await page.getByLabel('Status', { exact: true }).selectOption('PENDING')
  assert.equal(await page.locator('.crm-table tbody tr').count(), 1)
  assert.equal(await page.getByRole('button', { name: /Edit|Delete|Approve|Reject|Convert/, exact: false }).count(), 0)
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export Excel' }).click()
  const download = await downloadPromise
  assert.match(download.suggestedFilename(), /leads_.*PENDING\.xlsx$/)
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(await readFile(await download.path()))
  assert.equal(workbook.getWorksheet(1).getRow(3).getCell(3).value, '0123456789')
  assert.equal(workbook.getWorksheet(1).getRow(3).getCell(6).value, '=1+1')
  assert.equal(workbook.getWorksheet(1).getRow(3).getCell(6).type, ExcelJS.ValueType.String)
  await page.getByLabel('Status', { exact: true }).selectOption('')
  const allPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export Excel' }).click()
  const all = await allPromise
  const allBook = new ExcelJS.Workbook()
  await allBook.xlsx.load(await readFile(await all.path()))
  let exported = 0
  allBook.getWorksheet(1).eachRow(row => { if (row.getCell(2).value?.startsWith('Lead ')) exported++ })
  assert.equal(exported, 501, 'Export must include all server pages and all UI pages')
  await page.getByLabel('From date').fill('2026-10-10')
  await page.getByLabel('To date').fill('2026-10-08')
  await page.getByRole('alert').filter({ hasText: 'From date' }).waitFor()
  assert.equal(await page.getByRole('button', { name: 'Export Excel' }).isDisabled(), true)
  await page.getByLabel('From date').fill('')
  await page.getByLabel('To date').fill('')
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
    await page.screenshot({ path: resolve(output, `leads-${width}.png`), ...screenshotOptions })
  }
  crmFailure = true
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await page.getByText('Could not load records. Please refresh and try again.').waitFor()
  assert.equal(await page.getByRole('button', { name: 'Export Excel' }).isDisabled(), true)
  crmFailure = false
  await page.goto(front + '/customer-support')
  await page.getByRole('cell', { name: 'Support Person', exact: true }).waitFor()
  const supportPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export Excel' }).click()
  const supportDownload = await supportPromise
  const supportBook = new ExcelJS.Workbook()
  await supportBook.xlsx.load(await readFile(await supportDownload.path()))
  assert.equal(supportBook.getWorksheet(1).getRow(2).getCell(5).value, 'JP-TEST')
  assert.equal(supportBook.getWorksheet(1).getRow(2).getCell(9).value, 'Yes')
  assert.ok(crmReads.includes('/rest/v1/leads') && crmReads.includes('/rest/v1/customer_support'))
  await page.screenshot({ path: resolve(output, 'customer-support-desktop.png'), ...screenshotOptions })
  assert.deepEqual(errors, [])
  console.log(
    'PASS browser: admin management regression; read-only CRM, pagination, status/date filters, full XLSX downloads, formula safety, failure recovery, desktop/mobile layouts',
  )
} finally {
  await browser?.close()
  vite.kill()
  await new Promise((resolve) => backend.close(resolve))
}
