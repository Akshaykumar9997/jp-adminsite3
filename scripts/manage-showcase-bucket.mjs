import { createClient } from '@supabase/supabase-js'

const projectRef = 'xssjgzzhcudktrkruitb'
const apply = process.argv.includes('--apply')

console.log(`Target project ref: ${projectRef}`)
console.log('Operation: create private Storage bucket showcase-media only when it does not exist; stop if an existing bucket is public.')
if (!apply) {
  console.log('Plan only. Re-run with --apply after explicit production approval.')
  process.exit(0)
}

const url = process.env.SUPABASE_URL
const secret = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !new URL(url).hostname.startsWith(`${projectRef}.`)) throw new Error(`SUPABASE_URL must identify ${projectRef}.`)
if (!secret) throw new Error('SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY is required.')

const client = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } })
const listed = await client.storage.listBuckets()
if (listed.error) throw new Error(`Bucket inspection failed: ${listed.error.message}`)
const existing = listed.data.find((bucket) => bucket.id === 'showcase-media')
if (existing?.public) throw new Error('Existing showcase-media bucket is unexpectedly public; no change was made.')
if (!existing) {
  const created = await client.storage.createBucket('showcase-media', { public: false })
  if (created.error) throw new Error(`Bucket creation failed: ${created.error.message}`)
}

const verified = await client.storage.getBucket('showcase-media')
if (verified.error || !verified.data || verified.data.public) throw new Error('Private bucket verification failed.')
console.log('Verified showcase-media exists and is private.')
