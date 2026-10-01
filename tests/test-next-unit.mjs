import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { stripTypeScriptTypes } from 'node:module'
const moduleUrl = (source) =>
  'data:text/javascript;base64,' +
  Buffer.from(stripTypeScriptTypes(source)).toString('base64')
const feedbackUrl = moduleUrl(
  await readFile(new URL('../src/lib/feedback.ts', import.meta.url), 'utf8'),
)
const { moveItem, friendlyError, UserError } = await import(feedbackUrl)
const { publicConfigurationError } = await import(
  moduleUrl(
    await readFile(
      new URL('../src/lib/public-config.ts', import.meta.url),
      'utf8',
    ),
  )
)
const { validateFile, prepareMedia } = await import(
  moduleUrl(
    (
      await readFile(
        new URL('../src/lib/media-processing.ts', import.meta.url),
        'utf8',
      )
    ).replace("'./feedback'", JSON.stringify(feedbackUrl)),
  )
)
const items = ['image', 'video', 'image2', 'model']
assert.deepEqual(moveItem(items, 1, 3), ['image', 'image2', 'model', 'video'])
assert.deepEqual(items, ['image', 'video', 'image2', 'model'])
for (const [from, to] of [
  [-1, 0],
  [0, 8],
  [2, 2],
])
  assert.equal(moveItem(items, from, to), items)
assert.equal(validateFile(new File(['x'], 'photo.JPEG')), 'jpeg')
assert.equal(validateFile(new File(['x'], 'logo.svg'), true), 'svg')
for (const file of [
  new File(['x'], 'movie.mov'),
  new File([], 'empty.jpg'),
  new File([new Uint8Array(21 * 1024 * 1024)], 'huge.jpg'),
])
  assert.throws(() => validateFile(file), UserError)
await assert.rejects(
  prepareMedia(
    new File(['not glb'], 'invalid.glb'),
    new AbortController().signal,
  ),
  UserError,
)
await assert.rejects(
  prepareMedia(
    new File(['not mp4'], 'invalid.mp4'),
    new AbortController().signal,
  ),
  UserError,
)
const cancelled = new AbortController()
cancelled.abort()
await assert.rejects(
  prepareMedia(new File(['x'], 'photo.jpg'), cancelled.signal),
  { name: 'AbortError' },
)
const payload = (role) =>
  `e30.${Buffer.from(JSON.stringify({ role })).toString('base64url')}.not-a-real-key`
assert.equal(
  publicConfigurationError('https://example.supabase.co', payload('anon')),
  null,
)
assert.ok(
  publicConfigurationError(
    'https://example.supabase.co',
    payload('service_role'),
  ),
)
assert.ok(
  publicConfigurationError(
    'https://example.supabase.co',
    'sb_secret_' + 'test-only-placeholder',
  ),
)
assert.ok(publicConfigurationError('http://example.com', 'public'))
assert.equal(
  publicConfigurationError('http://127.0.0.1:54321', 'local-test'),
  null,
)
const previous = console.error
console.error = () => {}
Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
try {
  assert.equal(
    friendlyError(new UserError('Location required.')),
    'Location required.',
  )
  assert.match(friendlyError(new Error('Failed to fetch')), /Connection lost/)
  assert.match(friendlyError(new Error('not_authorized')), /Sign in again/)
  assert.match(friendlyError(new Error('duplicate key 23505')), /already in use/)
  assert.match(friendlyError(new Error('foreign key 23503')), /still in use/)
  assert.doesNotMatch(
    friendlyError(new Error('SQL password=sensitive-detail')),
    /sensitive-detail|SQL|password/,
  )
} finally {
  console.error = previous
}
console.log(
  'PASS unit tests: immutable mixed ordering, file limits/formats/cancellation, friendly error sanitization, public-only configuration',
)
