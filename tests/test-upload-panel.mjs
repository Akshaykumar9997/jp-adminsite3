import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdir } from 'node:fs/promises'
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
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
})
await context.addInitScript((value) => {
  localStorage.setItem('sb-127-auth-token', JSON.stringify(value))
  const original = XMLHttpRequest.prototype.send
  window.__uploadRequests = []
  XMLHttpRequest.prototype.send = function (body) {
    if (body instanceof Blob) window.__uploadRequests.push(this)
    return original.call(this, body)
  }
}, session)
const page = await context.newPage(),
  errors = []
page.on('pageerror', (error) => errors.push(error.message))
const panel = page.getByRole('complementary', { name: 'Upload Center' })
const output = resolve(import.meta.dirname, '../test-results')
await mkdir(output, { recursive: true })
try {
  await page.goto(front + '/media')
  const bytes = await page.evaluate(async () => {
    const canvas = document.createElement('canvas')
    canvas.width = 160
    canvas.height = 90
    canvas.getContext('2d').fillRect(0, 0, 160, 90)
    const stream = canvas.captureStream(10),
      chunks = []
    const recorder = new MediaRecorder(stream, {
      mimeType: 'video/mp4;codecs=avc1.42001E',
    })
    recorder.ondataavailable = (event) => chunks.push(event.data)
    const stopped = new Promise((resolve) => (recorder.onstop = resolve))
    recorder.start()
    const timer = setInterval(() => {
      const paint = canvas.getContext('2d')
      paint.fillStyle = '#cf202e'
      paint.fillRect(0, 0, 160, 90)
    }, 50)
    await new Promise((resolve) => setTimeout(resolve, 800))
    clearInterval(timer)
    recorder.stop()
    await stopped
    stream.getTracks().forEach((track) => track.stop())
    return [...new Uint8Array(await new Blob(chunks).arrayBuffer())]
  })
  let release
  const held = new Promise((resolve) => {
    release = resolve
  })
  await page.route('**/storage/v1/object/showcase-media/**', (route) =>
    route.request().method() === 'POST' ? release(route) : route.continue(),
  )
  await page
    .locator('input[type=file]')
    .setInputFiles({
      name: '2.9_Sh1.mp4',
      mimeType: 'video/mp4',
      buffer: Buffer.from(bytes),
    })
  let deadline
  const route = await Promise.race([
    held,
    new Promise((_, reject) => {
      deadline = setTimeout(
        () => reject(new Error('Transfer did not start')),
        15000,
      )
    }),
  ])
  clearTimeout(deadline)
  await panel.getByText('Uploading 1 item', { exact: true }).waitFor()
  const ring = panel.getByRole('progressbar', {
    name: '2.9_Sh1.mp4 uploading',
    exact: true,
  })
  await ring.waitFor()
  for (const percent of [0, 42, 100]) {
    await page.evaluate((percent) => {
      window.__uploadRequests
        .at(-1)
        .upload.dispatchEvent(
          new ProgressEvent('progress', {
            lengthComputable: true,
            loaded: percent * 10,
            total: 1000,
          }),
        )
    }, percent)
    await page.waitForFunction(
      (value) =>
        document
          .querySelector('.upload-ring')
          ?.getAttribute('aria-valuenow') === String(value),
      Math.min(99, percent),
    )
  }
  await panel.getByText('Less than a minute left', { exact: true }).waitFor()
  assert.equal(await panel.locator('.progress').count(), 0)
  assert.equal(await panel.locator('.upload-file-heading').count(), 1)
  assert.equal(
    await panel.locator('.upload-complete-icon').count(),
    0,
    'Transfer 100% is not a completed metadata save',
  )
  await page.screenshot({
    path: resolve(output, 'drive-upload-active.png'),
    animations: 'disabled',
  })
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    const rect = await panel.boundingBox()
    assert.ok(
      rect.x >= 0 &&
        rect.x + rect.width <= width &&
        rect.y + rect.height <= 900,
    )
  }
  await panel
    .getByRole('button', { name: 'Collapse uploads', exact: true })
    .click()
  assert.equal(await panel.getByRole('progressbar').count(), 0)
  await page
    .getByRole('navigation', { name: 'Admin navigation' })
    .getByRole('link', { name: 'Partners', exact: true })
    .click()
  await panel
    .getByRole('button', { name: 'Expand uploads', exact: true })
    .click()
  await ring.waitFor()
  await route.continue()
  await panel.getByText('1 upload complete', { exact: true }).waitFor()
  assert.equal(
    await panel
      .getByRole('img', { name: 'Upload complete', exact: true })
      .count(),
    1,
  )
  assert.equal(await panel.getByRole('progressbar').count(), 0)
  assert.equal(await panel.locator('.upload-summary').count(), 0)
  await page.screenshot({
    path: resolve(output, 'drive-upload-complete.png'),
    animations: 'disabled',
  })
  await panel
    .getByRole('button', { name: 'Dismiss uploads', exact: true })
    .click()
  await panel.waitFor({ state: 'hidden' })
  assert.deepEqual(errors, [])
  console.log(
    'PASS Drive upload tray: actual video upload, circular progress 0/42/99%, metadata completion guard, ETA, no long bars, completed green check/count, collapse/navigation/dismiss and 320/390/768/1440 bounds.',
  )
} catch (error) {
  console.error(await page.locator('body').innerText())
  await page.screenshot({
    path: resolve(output, 'drive-upload-test-error.png'),
  })
  throw error
} finally {
  await browser.close()
}
