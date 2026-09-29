import { createClient } from 'npm:@supabase/supabase-js@2.117.2'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const WINDOW_MS = 60_000
const MAX_REQUESTS = 60
// ponytail: per-instance limiter; replace with shared Redis only if distributed abuse is observed.
const requests = new Map<string, { count: number; resetAt: number }>()

function cors(origin: string | null): Record<string, string> {
  const allowed = (Deno.env.get('SHOWCASE_ALLOWED_ORIGINS') ?? '').split(',').map((item) => item.trim()).filter(Boolean)
  return origin && allowed.includes(origin)
    ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type', Vary: 'Origin' }
    : {}
}

function response(status: number, body: Record<string, unknown>, headers: HeadersInit = {}) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers } })
}

function isRateLimited(request: Request) {
  const key = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || request.headers.get('cf-connecting-ip') || 'unknown'
  const now = Date.now()
  if (requests.size > 10_000) for (const [ip, value] of requests) if (value.resetAt <= now) requests.delete(ip)
  const entry = requests.get(key)
  if (!entry && requests.size >= 10_000) return true
  if (!entry || entry.resetAt <= now) {
    requests.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return false
  }
  entry.count += 1
  return entry.count > MAX_REQUESTS
}

export async function handleRequest(request: Request) {
  const origin = request.headers.get('origin')
  const corsHeaders = cors(origin)
  if (request.method === 'OPTIONS') return new Response(null, { status: origin && Object.keys(corsHeaders).length ? 204 : 403, headers: corsHeaders })
  if (request.method !== 'GET') return response(405, { error: 'method_not_allowed' }, corsHeaders)
  if (isRateLimited(request)) return response(429, { error: 'rate_limited' }, { ...corsHeaders, 'Retry-After': '60' })

  const url = new URL(request.url)
  const assetId = url.searchParams.get('id') ?? url.pathname.split('/').filter(Boolean).at(-1) ?? ''
  if (!UUID.test(assetId)) return response(404, { error: 'not_found' }, corsHeaders)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) return response(503, { error: 'service_unavailable' }, corsHeaders)

  const client = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const [publicCheck, assetResult] = await Promise.all([
    client.schema('showcase').rpc('is_media_public', { p_asset_id: assetId }),
    client.schema('showcase').from('media_assets').select('storage_path, kind, mime_type').eq('id', assetId).maybeSingle(),
  ])
  if (publicCheck.error || assetResult.error) return response(503, { error: 'authorization_unavailable' }, corsHeaders)
  if (publicCheck.data !== true || !assetResult.data) return response(404, { error: 'not_found' }, corsHeaders)

  const asset = assetResult.data as { storage_path: string; kind: string; mime_type: string }
  if (asset.storage_path.startsWith('internal/') || asset.storage_path.startsWith('unassigned/')) return response(404, { error: 'not_found' }, corsHeaders)
  const expiresIn = asset.kind === 'video' || asset.kind === 'model_3d' ? 900 : 300
  const signed = await client.storage.from('showcase-media').createSignedUrl(asset.storage_path, expiresIn)
  if (signed.error || !signed.data?.signedUrl) return response(503, { error: 'signing_failed' }, corsHeaders)

  return response(200, { url: signed.data.signedUrl, expires_in: expiresIn, mime_type: asset.mime_type }, corsHeaders)
}

if (import.meta.main) Deno.serve(handleRequest)
