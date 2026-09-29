import { createHash } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const migrations = resolve(root, 'database/showcase-migrations')
const expected = new Map([
  ['001_create_showcase_schema.sql', '31c055381c8ee05c46fa44afe80b5f3f50e10a00381db8ff8ef78533e303ad04'],
  ['002_create_public_media_predicate.sql', '3e9d200aa62111332d20c24d79c2eb262f0df3ddfbd440a350773c3c1795d36b'],
  ['003_create_showcase_rls.sql', 'd36e456e96ef6b0c029d51f2e3bace42bfc4007459750abe47a6a79638d5d98b'],
  ['004_create_showcase_storage_policies.sql', '5ecfcf6e8f7eea89c5be19024f20d0917a473e1c6931bace76dc107d7001ef0c'],
  ['005_create_showcase_auditing.sql', '5ac37abf44e2c9d53d63c221ae3a6b5d36a045092e8960b9ca3271c28391959d'],
  ['006_create_landing_publish_function.sql', '4ac429b9ff04f0e876a166eab9e84d4bfbddd45fe84d3afa675141e422402ac8'],
  ['007_complete_atomic_landing_and_auditing.sql', 'd4ee66ee21427e3dc19949417078af89b2cc7e3ff72d69ee08c36b2406a9c1c6'],
])

const files = (await readdir(migrations)).filter((file) => file.endsWith('.sql')).sort()
if (files.length !== expected.size || files.some((file, index) => file !== [...expected.keys()][index])) throw new Error('Migration package file set/order changed.')
for (const file of files) {
  const contents = await readFile(resolve(migrations, file))
  const actual = createHash('sha256').update(contents).digest('hex')
  if (actual !== expected.get(file)) throw new Error(`Reviewed checksum changed: ${file}`)
}

async function sourceFiles(directory) {
  const result = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) result.push(...await sourceFiles(path))
    else if (/\.(ts|tsx)$/.test(entry.name)) result.push(path)
  }
  return result
}

for (const file of await sourceFiles(resolve(root, 'src'))) {
  const contents = await readFile(file, 'utf8')
  if (/SERVICE_ROLE|SECRET_KEY/i.test(contents)) throw new Error(`Server credential reference found in frontend source: ${file}`)
}

const migrationSql = (await Promise.all(files.map((file) => readFile(resolve(migrations, file), 'utf8')))).join('\n')
if (/supabase_migrations/i.test(migrationSql)) throw new Error('Reviewed migrations must not access the shared Supabase migration ledger.')
for (const required of ['ensure_landing_draft', 'save_landing_draft', "'project_media', 'project_room_media', 'work_media', 'work_materials'", 'record_id type text']) {
  if (!migrationSql.includes(required)) throw new Error(`Completion migration guard missing: ${required}`)
}

const showcaseClient = await readFile(resolve(root, 'src/lib/showcase.ts'), 'utf8')
if (!showcaseClient.includes("rpc('save_landing_draft'")) throw new Error('Landing draft save must use the atomic database RPC.')

const edge = await readFile(resolve(root, 'supabase/functions/public-showcase-media/index.ts'), 'utf8')
for (const required of ["from('showcase-media')", "rpc('is_media_public'", 'SUPABASE_SERVICE_ROLE_KEY', 'return response(429', 'return response(404', 'return response(503']) {
  if (!edge.includes(required)) throw new Error(`Public media guard missing: ${required}`)
}
if (edge.includes('VITE_SUPABASE_SERVICE')) throw new Error('Service-role secret must not use a Vite environment variable.')

const bucketManager = await readFile(resolve(root, 'scripts/manage-showcase-bucket.mjs'), 'utf8')
if (!bucketManager.includes("createBucket('showcase-media', { public: false })") || !bucketManager.includes("getBucket('showcase-media')")) throw new Error('Private bucket API safeguards are missing.')

const runner = await readFile(resolve(root, 'database/run-showcase-migrations.ps1'), 'utf8')
for (const required of ['ResumeKnownState', 'PGDATABASE', 'public.is_admin()', 'storage.objects', 'migration ledger is unknown']) {
  if (!runner.includes(required)) throw new Error(`Migration runner safeguard missing: ${required}`)
}

console.log('PASS checksum-locked migrations, frontend secret isolation, private bucket API guard, media authorization, and required error paths')
