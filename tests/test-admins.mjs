import assert from 'node:assert/strict'
import { handleAdminRequest, serveAdmins } from '../server/admins.mjs'

const ownId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const targetId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const env = {
  VITE_SUPABASE_URL: 'https://example.supabase.co',
  VITE_SUPABASE_PUBLISHABLE_KEY: 'public-test-key',
}
const target = {
  id: targetId,
  email: 'admin@example.test',
  full_name: 'Other Admin',
  role: 'admin',
  access_revoked_at: null,
}

function fixture(options = {}) {
  const calls = []
  const results = [...(options.queries ?? [])]
  const client = {
    auth: {
      getUser: async (token) => {
        calls.push(['getUser', token])
        return options.invalidToken
          ? { error: new Error('invalid'), data: { user: null } }
          : { data: { user: { id: ownId } }, error: null }
      },
    },
    rpc: async (name) => {
      calls.push(['rpc', name])
      return {
        data: options.allowed ?? true,
        error: options.permissionError ?? null,
      }
    },
    schema(name) {
      assert.equal(name, 'identity')
      return {
        from(table) {
          assert.equal(table, 'profiles')
          const result = results.shift()
          assert.ok(result, 'Unexpected profile query')
          const chain = new Proxy(
            {},
            {
              get(_, method) {
                if (method === 'then')
                  return Promise.resolve(result).then.bind(
                    Promise.resolve(result),
                  )
                return (...args) => {
                  calls.push([method, ...args])
                  return chain
                }
              },
            },
          )
          return chain
        },
      }
    },
    functions: {
      invoke: async (slug, options) => {
        calls.push(['invoke', slug, options])
        return (
          optionsFixture.upstream ?? { data: { success: true }, error: null }
        )
      },
    },
  }
  const optionsFixture = options
  const factory = (url, key, config) => {
    assert.equal(url, env.VITE_SUPABASE_URL)
    assert.equal(key, env.VITE_SUPABASE_PUBLISHABLE_KEY)
    assert.equal(config.global.headers.Authorization, 'Bearer caller-token')
    assert.equal(config.auth.persistSession, false)
    return client
  }
  return { calls, factory, results }
}
async function run(body, options = {}, overrides = {}) {
  const f = fixture(options)
  const response = await handleAdminRequest(
    new Request('https://admin.example.test/api/admins', {
      method: 'POST',
      headers: {
        authorization: 'Bearer caller-token',
        'content-type': 'application/json',
        ...overrides.headers,
      },
      body: JSON.stringify(body),
    }),
    overrides.env ?? env,
    f.factory,
  )
  assert.equal(response.headers.get('cache-control'), 'no-store')
  return { ...f, status: response.status, data: await response.json() }
}
const noAuthorization = await run(
  { action: 'list' },
  {},
  { headers: { authorization: '' } },
)
assert.equal(noAuthorization.status, 401)
assert.equal(noAuthorization.calls.length, 0)
for (const options of [
  { invalidToken: true },
  { allowed: false },
  { permissionError: new Error() },
]) {
  const result = await run(
    {
      action: 'create',
      email: target.email,
      full_name: target.full_name,
      password: 'secret123',
    },
    options,
  )
  assert.ok([401, 403, 503].includes(result.status))
  assert.ok(
    !result.calls.some(([name]) => name === 'invoke' || name === 'delete'),
  )
}
assert.equal((await run({ action: 'unknown' })).status, 400)
assert.equal((await run({ action: 'list' }, {}, { env: {} })).status, 503)
const list = await run(
  { action: 'list' },
  { queries: [{ data: [target], error: null }] },
)
assert.deepEqual(list.data.admins, [target])
assert.ok(
  !list.calls.find(([name]) => name === 'select')[1].includes('password'),
)
const createBody = {
  action: 'create',
  email: ' NEW@EXAMPLE.TEST ',
  full_name: ' New Admin ',
  password: ' password123 ',
}
const created = await run(createBody, {
  queries: [{ data: null, error: null }],
})
assert.equal(created.status, 200)
assert.deepEqual(created.calls.find(([name]) => name === 'invoke')[2], {
  body: {
    email: 'new@example.test',
    full_name: 'New Admin',
    password: 'password123',
  },
  headers: { Authorization: 'Bearer caller-token' },
})
for (const role of ['admin', 'client', 'worker']) {
  const conflict = await run(createBody, {
    queries: [{ data: { id: targetId, role }, error: null }],
  })
  assert.equal(conflict.status, 409)
  assert.ok(!conflict.calls.some(([name]) => name === 'invoke'))
}
assert.equal((await run({ ...createBody, password: ' 123 ' })).status, 400)
assert.equal((await run({ ...createBody, full_name: ' ' })).status, 400)
const lookupFailed = await run(createBody, {
  queries: [{ data: null, error: new Error() }],
})
assert.equal(lookupFailed.status, 502)
assert.ok(!lookupFailed.calls.some(([name]) => name === 'invoke'))
const escaped = await run(
  { ...createBody, email: 'first_last@example.test' },
  { queries: [{ data: null, error: null }] },
)
assert.equal(
  escaped.calls.find(([name]) => name === 'ilike')[2],
  'first\\_last@example.test',
)
const changed = await run(
  {
    action: 'password',
    id: targetId,
    email: 'ignored@example.test',
    password: 'password123',
  },
  { queries: [{ data: target, error: null }] },
)
assert.equal(changed.status, 200)
assert.equal(
  changed.calls.find(([name]) => name === 'invoke')[2].body.email,
  target.email,
)
const missing = await run(
  { action: 'password', id: targetId, password: 'password123' },
  { queries: [{ data: null, error: null }] },
)
assert.equal(missing.status, 404)
const upstreamFailure = await run(createBody, {
  queries: [{ data: null, error: null }],
  upstream: { data: null, error: new Error('private server detail') },
})
assert.equal(upstreamFailure.status, 502)
assert.ok(
  !JSON.stringify(upstreamFailure.data).includes('private server detail'),
)
assert.equal(
  upstreamFailure.calls.filter(([name]) => name === 'invoke').length,
  1,
  'Credential mutations must not be retried',
)
const self = await run(
  { action: 'remove', id: ownId },
  { queries: [{ data: { ...target, id: ownId }, error: null }] },
)
assert.equal(self.status, 409)
assert.ok(!self.calls.some(([name]) => name === 'delete'))
for (const count of [0, 1, null]) {
  const last = await run(
    { action: 'remove', id: targetId },
    {
      queries: [
        { data: target, error: null },
        { count, error: null },
      ],
    },
  )
  assert.ok([409, 502].includes(last.status))
  assert.ok(!last.calls.some(([name]) => name === 'delete'))
}
const removed = await run(
  { action: 'remove', id: targetId },
  {
    queries: [
      { data: target, error: null },
      { count: 2, error: null },
      { data: [{ id: targetId }], error: null },
    ],
  },
)
assert.equal(removed.status, 200)
assert.ok(removed.calls.some(([name]) => name === 'delete'))
assert.ok(!removed.calls.some(([name]) => name === 'invoke'))
const linked = await run(
  { action: 'remove', id: targetId },
  {
    queries: [
      { data: target, error: null },
      { count: 2, error: null },
      { data: null, error: new Error('foreign key') },
    ],
  },
)
assert.equal(linked.status, 409)
const malformed = await handleAdminRequest(
  new Request('https://admin.example.test/api/admins', {
    method: 'POST',
    headers: {
      authorization: 'Bearer caller-token',
      'content-type': 'application/json',
    },
    body: '{',
  }),
  env,
)
assert.equal(malformed.status, 400)
const oversized = await run({ action: 'create', password: 'x'.repeat(9000) })
assert.equal(oversized.status, 413)
const method = await handleAdminRequest(
  new Request('https://admin.example.test/api/admins'),
  env,
)
assert.equal(method.status, 405)
for (const key of [
  'sb_secret_test',
  `e30.${Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url')}.test`,
]) {
  const result = await run(
    { action: 'list' },
    {},
    { env: { ...env, VITE_SUPABASE_PUBLISHABLE_KEY: key } },
  )
  assert.equal(result.status, 503)
  assert.equal(result.calls.length, 0)
}
// Vercel provides a parsed body; Vite provides a stream. Exercise both adapters.
for (const parsed of [true, false]) {
  const req = {
    method: 'POST',
    headers: {
      host: 'localhost',
      authorization: 'Bearer caller-token',
      'content-type': 'application/json',
    },
    ...(parsed ? { body: { action: 'list' } } : {}),
    async *[Symbol.asyncIterator]() {
      yield Buffer.from('{"action":"list"}')
    },
  }
  const captured = {}
  await serveAdmins(
    req,
    {
      writeHead(status, headers) {
        captured.status = status
        captured.headers = headers
      },
      end(body) {
        captured.body = body
      },
    },
    {},
  )
  assert.equal(captured.status, 503)
  assert.equal(captured.headers['cache-control'], 'no-store')
  assert.match(captured.body, /not configured/)
}
console.log(
  'PASS admin API: authorization, shared profiles, create/reset, role conflicts, deletion safeguards, validation, sanitized failures, no credential retries',
)
