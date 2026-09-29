import { assertEquals } from 'jsr:@std/assert@1.0.14'
import { handleRequest } from './index.ts'

Deno.env.set('SHOWCASE_ALLOWED_ORIGINS', 'https://showcase.example')

Deno.test('allows configured CORS preflight', async () => {
  const response = await handleRequest(new Request('http://localhost/public-showcase-media', {
    method: 'OPTIONS',
    headers: { Origin: 'https://showcase.example' },
  }))
  assertEquals(response.status, 204)
  assertEquals(response.headers.get('Access-Control-Allow-Origin'), 'https://showcase.example')
})

Deno.test('rejects unconfigured CORS preflight', async () => {
  const response = await handleRequest(new Request('http://localhost/public-showcase-media', {
    method: 'OPTIONS',
    headers: { Origin: 'https://attacker.example' },
  }))
  assertEquals(response.status, 403)
  assertEquals(response.headers.get('Access-Control-Allow-Origin'), null)
})

Deno.test('rejects unsupported methods', async () => {
  const response = await handleRequest(new Request('http://localhost/public-showcase-media', { method: 'POST' }))
  assertEquals(response.status, 405)
  assertEquals(await response.json(), { error: 'method_not_allowed' })
})

Deno.test('hides malformed asset identifiers', async () => {
  const response = await handleRequest(new Request('http://localhost/public-showcase-media?id=../../internal/nda.pdf'))
  assertEquals(response.status, 404)
  assertEquals(await response.json(), { error: 'not_found' })
})

Deno.test('does not run without server credentials', async () => {
  Deno.env.delete('SUPABASE_URL')
  Deno.env.delete('SUPABASE_SERVICE_ROLE_KEY')
  const response = await handleRequest(new Request('http://localhost/public-showcase-media?id=20000000-0000-4000-8000-000000000001'))
  assertEquals(response.status, 503)
  assertEquals(await response.json(), { error: 'service_unavailable' })
})
