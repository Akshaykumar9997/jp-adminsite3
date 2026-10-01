import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { stripTypeScriptTypes } from 'node:module'
const source = stripTypeScriptTypes(
  await readFile(new URL('../src/lib/cache.ts', import.meta.url), 'utf8'),
)
const { MemoryCache, clearCmsCaches, previewCache, dataCache } = await import(
  'data:text/javascript;base64,' + Buffer.from(source).toString('base64')
)
const originalNow = Date.now
let now = 1000
Date.now = () => now
try {
  const cache = new MemoryCache(2, 100)
  let calls = 0
  const load = async () => ++calls
  assert.equal(await cache.get('a', load), 1)
  assert.equal(await cache.get('a', load), 1)
  await cache.get('b', load)
  cache.peek('a')
  await cache.get('c', load)
  assert.equal(cache.peek('b'), undefined, 'LRU evicts least recently used')
  now += 101
  assert.equal(cache.peek('a'), undefined, 'TTL expires entries')
  let release
  const pending = cache.get(
    'pending',
    () =>
      new Promise((resolve) => {
        release = resolve
      }),
  )
  const shared = cache.get('pending', () => {
    throw Error('Duplicate request')
  })
  release(12)
  assert.equal(await pending, 12)
  assert.equal(await shared, 12)
  await assert.rejects(
    cache.get('failed', async () => {
      throw Error('offline')
    }),
    /offline/,
  )
  assert.equal(await cache.get('failed', async () => 13), 13)
  const stale = cache.get(
    'stale',
    () =>
      new Promise((resolve) => {
        release = resolve
      }),
  )
  cache.clear()
  release(14)
  await stale
  assert.equal(
    cache.peek('stale'),
    undefined,
    'Cleared in-flight responses cannot repopulate cache',
  )
  globalThis.window = new EventTarget()
  await previewCache.get('private', async () => 'signed')
  await dataCache.get('private', async () => ({ title: 'private' }))
  clearCmsCaches()
  assert.equal(previewCache.peek('private'), undefined)
  assert.equal(dataCache.peek('private'), undefined)
  console.log(
    'PASS: LRU bounds, TTL expiry, request deduplication, failure retry, stale-response rejection and logout cache clearing.',
  )
} finally {
  Date.now = originalNow
}
