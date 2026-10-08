import { createClient } from '@supabase/supabase-js'

const columns = 'id,email,full_name,role,created_at,access_revoked_at'
const reply = (status, data) =>
  Response.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })

// Uses only the caller's token and a public key. The existing Edge Function
// remains responsible for privileged Auth operations.
export async function handleAdminRequest(
  request,
  env = process.env,
  clientFactory = createClient,
) {
  if (request.method !== 'POST')
    return reply(405, { error: 'Use POST for admin management.' })
  const authorization = request.headers.get('authorization')
  if (!/^Bearer \S+$/i.test(authorization ?? ''))
    return reply(401, { error: 'Sign in again to manage admins.' })
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    return reply(415, { error: 'A JSON request is required.' })
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL
  const key = env.SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key)
    return reply(503, {
      error: 'Admin management is not configured on the server.',
    })
  try {
    if (
      key.startsWith('sb_secret_') ||
      (key.split('.').length === 3 &&
        JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString())
          .role !== 'anon')
    )
      return reply(503, {
        error: 'Admin management requires a public publishable key.',
      })
  } catch {
    return reply(503, {
      error: 'Admin management has an invalid public key configuration.',
    })
  }
  let body
  try {
    const raw = await request.text()
    if (Buffer.byteLength(raw) > 8192)
      return reply(413, { error: 'Request is too large.' })
    body = JSON.parse(raw)
    if (!body || typeof body !== 'object' || Array.isArray(body))
      throw new Error()
  } catch {
    return reply(400, { error: 'Invalid request.' })
  }
  if (!['list', 'create', 'password', 'remove'].includes(body.action))
    return reply(400, { error: 'Unknown admin action.' })
  try {
    const client = clientFactory(url, key, {
      global: {
        headers: { Authorization: authorization },
        fetch: (input, init) =>
          fetch(input, { ...init, signal: AbortSignal.timeout(20_000) }),
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    })
    const { data: auth, error: authError } = await client.auth.getUser(
      authorization.slice(7),
    )
    if (authError || !auth.user)
      return reply(401, { error: 'Sign in again to manage admins.' })
    const { data: allowed, error: permissionError } =
      await client.rpc('is_admin')
    if (permissionError)
      return reply(503, {
        error: 'Could not verify administrator access. Please retry.',
      })
    if (allowed !== true)
      return reply(403, {
        error: 'Only active administrators can manage admins.',
      })
    const profiles = () => client.schema('identity').from('profiles')
    if (body.action === 'list') {
      const { data, error } = await profiles()
        .select(columns)
        .eq('role', 'admin')
        .order('full_name')
      if (error)
        return reply(502, {
          error: 'Could not load administrators. Please retry.',
        })
      return reply(200, { admins: data })
    }
    let target
    if (body.action !== 'create') {
      if (
        typeof body.id !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          body.id,
        )
      )
        return reply(400, { error: 'Choose an administrator.' })
      const { data, error } = await profiles()
        .select(columns)
        .eq('id', body.id)
        .eq('role', 'admin')
        .maybeSingle()
      if (error)
        return reply(502, {
          error: 'Could not verify the selected administrator. Please retry.',
        })
      if (!data)
        return reply(404, {
          error: 'This administrator no longer exists. Refresh the list.',
        })
      target = data
    }
    if (body.action === 'remove') {
      if (target.id === auth.user.id)
        return reply(409, {
          error: 'You cannot remove your own administrator account.',
        })
      const { count, error } = await profiles()
        .select('id', { count: 'exact', head: true })
        .eq('role', 'admin')
        .is('access_revoked_at', null)
      if (error || count === null)
        return reply(502, {
          error: 'Could not check remaining administrators. Please retry.',
        })
      if (!target.access_revoked_at && count <= 1)
        return reply(409, {
          error: 'Cannot remove the last active administrator.',
        })
      // ponytail: this fresh count is not a cross-app transaction; simultaneous
      // removals elsewhere would need an existing database-level guard.
      const { data, error: deleteError } = await profiles()
        .delete()
        .eq('id', target.id)
        .eq('role', 'admin')
        .select('id')
      if (deleteError)
        return reply(409, {
          error:
            'Could not remove this admin. Existing linked records may prevent removal.',
        })
      if (!data?.length)
        return reply(404, {
          error: 'This administrator no longer exists. Refresh the list.',
        })
      return reply(200, { success: true })
    }
    const password =
      typeof body.password === 'string' ? body.password.trim() : ''
    if (password.length < 6 || password.length > 1024)
      return reply(400, {
        error: 'Password must contain between 6 and 1024 characters.',
      })
    const email =
      body.action === 'create' && typeof body.email === 'string'
        ? body.email.trim().toLowerCase()
        : target?.email
    const name =
      body.action === 'create' && typeof body.full_name === 'string'
        ? body.full_name.trim()
        : target?.full_name
    if (
      !email ||
      email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      !name ||
      name.length > 200
    )
      return reply(400, {
        error:
          'A valid email and full name (up to 200 characters) are required.',
      })
    if (body.action === 'create') {
      // Check before the existing function, which updates Auth before checking
      // profile role conflicts. Never silently reset an existing account here.
      const { data, error } = await profiles()
        .select('id,role')
        .ilike('email', email.replace(/[\\%_]/g, '\\$&'))
        .maybeSingle()
      if (error)
        return reply(502, {
          error: 'Could not check this email. Please retry.',
        })
      if (data)
        return reply(409, {
          error:
            data.role === 'admin'
              ? 'This email already belongs to an admin. Use Change password instead.'
              : 'This email already belongs to a client or worker. Its role and password were not changed.',
        })
    }
    const response = await client.functions.invoke('create-admin-account', {
      body: { email, password, full_name: name },
      headers: { Authorization: authorization },
    })
    if (response.error || response.data?.success !== true) {
      // Never expose upstream internals or retry a credential mutation automatically.
      return reply(502, {
        error:
          'The account operation could not be confirmed. Refresh the list and check the account before retrying.',
      })
    }
    return reply(200, { success: true })
  } catch {
    return reply(502, {
      error:
        'Admin management could not reach the backend. Check the account before retrying a change.',
    })
  }
}

// Shared adapter for Vercel and local Vite. Bound the body before buffering it.
export async function serveAdmins(req, res, env = process.env) {
  let response
  try {
    let raw = ''
    if (req.body !== undefined)
      raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body)
    else {
      const chunks = []
      let bytes = 0
      for await (const chunk of req) {
        bytes += Buffer.byteLength(chunk)
        if (bytes > 8192) {
          response = reply(413, { error: 'Request is too large.' })
          continue
        }
        chunks.push(Buffer.from(chunk))
      }
      if (!response) raw = Buffer.concat(chunks).toString('utf8')
    }
    if (!response) {
      const headers = new Headers()
      for (const [name, value] of Object.entries(req.headers))
        if (value !== undefined)
          headers.set(name, Array.isArray(value) ? value.join(',') : value)
      response = await handleAdminRequest(
        new Request(`http://${req.headers.host || 'localhost'}/api/admins`, {
          method: req.method,
          headers,
          ...(!['GET', 'HEAD'].includes(req.method) ? { body: raw } : {}),
        }),
        env,
      )
    }
  } catch {
    response = reply(400, { error: 'Invalid request.' })
  }
  res.writeHead(response.status, Object.fromEntries(response.headers))
  res.end(await response.text())
}

export default serveAdmins
