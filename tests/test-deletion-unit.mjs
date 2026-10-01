import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { stripTypeScriptTypes } from 'node:module'
const values = new Map()
globalThis.localStorage = {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, value),
}
globalThis.window = new EventTarget()
let response,
  calls = 0,
  storageFailure = false,
  storedCalls = 0,
  references = [],
  lookups = 0
const query = {
  delete() {
    return this
  },
  eq() {
    return this
  },
  select() {
    return this
  },
  single() {
    calls++
    return response
  },
  limit() {
    lookups++
    return Promise.resolve({ data: references, error: null })
  },
}
globalThis.deletionTestClient = {
  schema: () => ({ from: () => query }),
  storage: {
    from: () => ({
      remove: async () => {
        storedCalls++
        return { error: storageFailure ? { message: 'offline' } : null }
      },
    }),
  },
}
const source = (
  await readFile(new URL('../src/lib/deletion.ts', import.meta.url), 'utf8')
)
  .replace(
    "import { supabase } from './supabase'",
    'const supabase = globalThis.deletionTestClient',
  )
  .replace(
    "import { UserError } from './feedback'",
    'class UserError extends Error {}',
  )
  .replace('import.meta.env.VITE_SUPABASE_URL', "'http://local-test'")
const moduleUrl =
  'data:text/javascript;base64,' +
  Buffer.from(stripTypeScriptTypes(source)).toString('base64')
const {
  deleteRecord,
  DELETED_EVENT,
  removeDeletedRecord,
  cleanupStorage,
  pendingCleanup,
  retryCleanup,
  reserveUploadPath,
  releaseUploadPath,
} = await import(moduleUrl)
const events = []
window.addEventListener(DELETED_EVENT, (event) => events.push(event.detail))
let resolveDelete
response = new Promise((resolve) => {
  resolveDelete = resolve
})
const first = deleteRecord('media_assets', 'one')
assert.equal(deleteRecord('media_assets', 'one'), first)
assert.equal(calls, 1)
resolveDelete({ data: { id: 'one' }, error: null })
await first
assert.deepEqual(events, [{ table: 'media_assets', id: 'one' }])
response = Promise.resolve({ data: null, error: null })
await assert.rejects(
  deleteRecord('media_assets', 'missing'),
  /could not be confirmed/,
)
response = Promise.resolve({
  data: null,
  error: { message: 'foreign key 23503' },
})
await assert.rejects(deleteRecord('media_assets', 'used'), /foreign key/)
assert.equal(events.length, 1, 'Failed deletes must not update caches')
response = Promise.resolve({ data: { id: 'used' }, error: null })
await deleteRecord('media_assets', 'used')
assert.equal(events.length, 2, 'Failed locks release for retry')
const original = {
  assets: [{ id: 'one' }, { id: 'two' }],
  rooms: [{ id: 'room' }],
  count: 2,
}
assert.deepEqual(removeDeletedRecord(original, 'one'), {
  ...original,
  assets: [{ id: 'two' }],
})
assert.equal(original.assets.length, 2)
assert.equal(removeDeletedRecord(null, 'one'), null)
assert.deepEqual(removeDeletedRecord(original.assets, 'one'), [{ id: 'two' }])
storageFailure = true
assert.match(await cleanupStorage('works/one/file.webp'), /needs cleanup/)
assert.deepEqual(pendingCleanup(), ['works/one/file.webp'])
storageFailure = false
await retryCleanup()
assert.deepEqual(pendingCleanup(), [])
storageFailure = true
await cleanupStorage('works/reused/file.webp')
const before = storedCalls
references = [{ id: 'reused' }]
await retryCleanup()
assert.equal(
  storedCalls,
  before,
  'Never remove objects referenced by a retried upload',
)
assert.deepEqual(pendingCleanup(), [])
storageFailure = true
await cleanupStorage('works/active/file.webp')
await reserveUploadPath('works/active/file.webp')
await cleanupStorage('works/active/file.webp')
const beforeLookup = lookups
await retryCleanup()
assert.equal(lookups, beforeLookup, 'Cleanup does not race an active upload')
releaseUploadPath('works/active/file.webp')
references = []
storageFailure = false
await retryCleanup()
assert.deepEqual(pendingCleanup(), [])
console.log(
  'PASS: duplicate deletion lock, server confirmation, rejected-delete cache safety, retry, immutable cache eviction, persistent cleanup, reused and active upload protection.',
)
