// Disposable test double: loopback only, in-memory PostgreSQL and Storage. Never reads .env.
import { createServer } from 'node:http'
import { readFile, readdir } from 'node:fs/promises'
import { resolve, extname } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
const root = resolve(import.meta.dirname, '..'),
  demo = resolve(root, '../jpdemo/dist'),
  db = new PGlite(),
  objects = new Map()
const admin = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'
const user = {
  id: admin,
  email: 'local-test@example.test',
  aud: 'authenticated',
  role: 'authenticated',
  app_metadata: {},
  user_metadata: {},
  created_at: new Date().toISOString(),
}
const token = `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: admin, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.local-test-signature`
const session = {
  access_token: token,
  refresh_token: 'local-test-refresh',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  token_type: 'bearer',
  user,
}
await db.exec(
  await readFile(
    resolve(root, 'database/showcase-validation/bootstrap.sql'),
    'utf8',
  ),
)
for (const name of (
  await readdir(resolve(root, 'database/showcase-migrations'))
)
  .filter((f) => f.endsWith('.sql'))
  .sort())
  await db.exec(
    await readFile(resolve(root, 'database/showcase-migrations', name), 'utf8'),
  )
await db.exec(
  await readFile(
    resolve(root, 'database/showcase-next/008_room_based_content.sql'),
    'utf8',
  ),
)
await db.exec(
  await readFile(
    resolve(root, 'supabase/migrations/20261001045730_room_first_cms.sql'),
    'utf8',
  ),
)
await db.query("insert into identity.profiles(id,role) values($1,'admin')", [
  admin,
])
const image = await readFile(resolve(root, 'public/assets/project-01.jpg'))
const fixtureId = '82000000-0000-4000-8000-000000000001'
objects.set('works/local/cover.jpg', { body: image, type: 'image/jpeg' })
await db.query(
  "insert into showcase.media_assets(id,title,storage_path,kind,mime_type,original_filename,byte_size) values($1,'Existing cover','works/local/cover.jpg','image','image/jpeg','cover.jpg',$2)",
  [fixtureId, image.length],
)
let nextFailure = null
let delay = 0
const send = (res, status, data, type = 'application/json') => {
  res.writeHead(status, {
    'Content-Type': type,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'Content-Range': '0-199/*',
  })
  res.end(type === 'application/json' ? JSON.stringify(data) : data)
}
const body = async (req) => {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  return Buffer.concat(chunks)
}
let queue = Promise.resolve()
async function request(req, res) {
  const url = new URL(req.url, 'http://127.0.0.1:54321')
  try {
    if (req.method === 'OPTIONS') return send(res, 204, {})
    if (url.pathname === '/test/session') return send(res, 200, session)
    if (url.pathname === '/test/reset') {
      await db.exec(
        'delete from showcase.landing_page_versions; delete from showcase.works; delete from showcase.materials; delete from showcase.partners; update showcase.room_categories set cover_asset_id=null; delete from showcase.room_categories where is_custom; delete from showcase.media_items;',
      )
      await db.query('delete from showcase.media_assets where id<>$1', [
        fixtureId,
      ])
      nextFailure = null
      delay = 0
      return send(res, 200, { ok: true })
    }
    if (url.pathname === '/test/control') {
      const data = JSON.parse((await body(req)).toString() || '{}')
      nextFailure = data.fail ?? null
      delay = data.delay ?? 0
      return send(res, 200, { ok: true })
    }
    if (url.pathname === '/test/state') {
      const result = {}
      for (const table of [
        'works',
        'room_categories',
        'materials',
        'partners',
        'media_assets',
        'media_items',
        'landing_page_versions',
        'landing_sections',
      ])
        result[table] = (await db.query(`select * from showcase.${table}`)).rows
      return send(res, 200, result)
    }
    if (url.pathname.startsWith('/auth/v1/')) {
      if (
        url.pathname.endsWith('/token') &&
        url.searchParams.get('grant_type') === 'password'
      ) {
        const credentials = JSON.parse((await body(req)).toString() || '{}')
        if (credentials.email !== 'local-test@example.test')
          return send(res, 400, {
            error: 'invalid_grant',
            error_description: 'Invalid login credentials',
            msg: 'Invalid login credentials',
          })
        return send(res, 200, session)
      }
      return send(
        res,
        200,
        url.pathname.endsWith('/user')
          ? user
          : url.pathname.endsWith('/logout')
            ? {}
            : session,
      )
    }
    if (url.pathname === '/showcase-config.json')
      return send(res, 200, {
        supabaseUrl: 'http://127.0.0.1:54321',
        publishableKey: 'local-publishable-test-key',
      })
    if (url.pathname.startsWith('/storage/v1/object/sign/showcase-media/'))
      return send(res, 200, {
        signedURL: `/object/showcase-media/${url.pathname.split('/showcase-media/')[1]}`,
      })
    if (url.pathname.startsWith('/storage/v1/object/showcase-media/')) {
      const path = decodeURIComponent(url.pathname.split('/showcase-media/')[1])
      if (req.method === 'POST') {
        if (nextFailure === 'upload') {
          nextFailure = null
          await body(req)
          return send(res, 503, { message: 'Network interruption' })
        }
        const bytes = await body(req)
        if (delay) await new Promise((r) => setTimeout(r, delay))
        objects.set(path, {
          body: bytes,
          type: req.headers['content-type'] || 'application/octet-stream',
        })
        return send(res, 200, { Key: `showcase-media/${path}` })
      }
      const object = objects.get(path)
      return object
        ? send(res, 200, object.body, object.type)
        : send(res, 404, { error: 'not found' })
    }
    if (
      url.pathname === '/storage/v1/object/showcase-media' &&
      req.method === 'DELETE'
    ) {
      const data = JSON.parse((await body(req)).toString())
      data.prefixes?.forEach((path) => objects.delete(path))
      return send(res, 200, [])
    }
    if (url.pathname === '/functions/v1/public-showcase-media') {
      const id = url.searchParams.get('id')
      await db.query("select set_config('request.jwt.claims',$1,false)", [
        JSON.stringify({ role: 'anon' }),
      ])
      const result = await db.query(
        'select showcase.is_media_public($1) allowed',
        [id],
      )
      if (!result.rows[0]?.allowed)
        return send(res, 404, { error: 'not_found' })
      const asset = (
        await db.query('select * from showcase.media_assets where id=$1', [id])
      ).rows[0]
      return send(res, 200, {
        url: `http://127.0.0.1:54321/storage/v1/object/showcase-media/${asset.storage_path}`,
        expires_in: 300,
        mime_type: asset.mime_type,
      })
    }
    if (url.pathname.startsWith('/rest/v1/')) {
      if (nextFailure === 'save' && req.method !== 'GET') {
        nextFailure = null
        await body(req)
        return send(res, 503, { message: 'Network interruption' })
      }
      if (delay) await new Promise((r) => setTimeout(r, delay))
      const claims = req.headers.authorization?.includes(token)
        ? { role: 'authenticated', sub: admin }
        : { role: 'anon' }
      await db.exec(`set role ${claims.role}`)
      await db.query("select set_config('request.jwt.claims',$1,false)", [
        JSON.stringify(claims),
      ])
      try {
        if (url.pathname.includes('/rpc/')) {
          const name = url.pathname.split('/rpc/')[1]
          const data = JSON.parse((await body(req)).toString() || '{}')
          const functions = {
            is_admin: ['public', []],
            ensure_landing_draft: ['showcase', []],
            save_content: [
              'showcase',
              ['p_kind', 'p_id', 'p_data', 'p_assets', 'p_cover'],
            ],
            reorder_media: ['showcase', ['p_kind', 'p_owner', 'p_assets']],
            reorder_works: ['showcase', ['p_room', 'p_ids']],
            reorder_rooms: ['showcase', ['p_ids']],
            save_landing_draft: [
              'showcase',
              [
                'p_version_id',
                'p_meta_title',
                'p_meta_description',
                'p_sections',
                'p_featured',
              ],
            ],
            publish_homepage: ['showcase', ['p_version_id']],
            set_video_poster: ['showcase', ['p_video', 'p_poster']],
          }
          const spec = functions[name]
          if (!spec) return send(res, 404, { message: 'Unknown RPC' })
          const args = spec[1].map((k) =>
            k === 'p_ids' && Array.isArray(data[k])
              ? `{${data[k].join(',')}}`
              : typeof data[k] === 'object' && data[k] !== null
                ? JSON.stringify(data[k])
                : data[k],
          )
          const sql = `select ${spec[0]}.${name}(${args.map((_, i) => '$' + (i + 1)).join(',')}) result`
          return send(res, 200, (await db.query(sql, args)).rows[0].result)
        }
        const table = url.pathname.split('/rest/v1/')[1]
        if (!/^[a-z_]+$/.test(table))
          return send(res, 400, { message: 'Invalid table' })
        const params = [],
          clauses = []
        for (const [key, value] of url.searchParams) {
          if (!/^[a-z_]+$/.test(key)) continue
          if (value.startsWith('eq.')) {
            params.push(value.slice(3))
            clauses.push(`${key}=$${params.length}`)
          }
        }
        const where = clauses.length ? ' where ' + clauses.join(' and ') : ''
        let rows
        if (req.method === 'GET') {
          let sql = `select * from showcase.${table}${where}`
          const order = url.searchParams.get('order')
          if (order && /^[a-z_,.]+$/.test(order))
            sql +=
              ' order by ' +
              order
                .split(',')
                .map((part) =>
                  part.replace('.desc', ' desc').replace('.asc', ' asc'),
                )
                .join(',')
          sql +=
            ' limit ' +
            Math.min(1000, Number(url.searchParams.get('limit') || 1000)) +
            ' offset ' +
            Number(url.searchParams.get('offset') || 0)
          rows = (await db.query(sql, params)).rows
        } else if (req.method === 'DELETE')
          rows = (
            await db.query(
              `delete from showcase.${table}${where} returning *`,
              params,
            )
          ).rows
        else {
          const data = JSON.parse((await body(req)).toString())
          const keys = Object.keys(data).filter((k) => /^[a-z_]+$/.test(k))
          const values = keys.map((k) =>
            typeof data[k] === 'object' && data[k] !== null
              ? JSON.stringify(data[k])
              : data[k],
          )
          if (req.method === 'PATCH') {
            rows = (
              await db.query(
                `update showcase.${table} set ${keys.map((k, i) => `${k}=$${i + 1}`).join(',')}${where.replace(/\$(\d+)/g, (_, n) => '$' + (+n + values.length))} returning *`,
                [...values, ...params],
              )
            ).rows
          } else {
            const conflict = table === 'cms_settings' ? 'key' : 'id'
            const upsert = req.headers.prefer?.includes(
              'resolution=merge-duplicates',
            )
              ? ` on conflict(${conflict}) do update set ${keys
                  .filter((k) => k !== conflict)
                  .map((k) => `${k}=excluded.${k}`)
                  .join(',')}`
              : ''
            rows = (
              await db.query(
                `insert into showcase.${table}(${keys.join(',')}) values(${values.map((_, i) => '$' + (i + 1)).join(',')})${upsert} returning *`,
                values,
              )
            ).rows
          }
        }
        const single = req.headers.accept?.includes('vnd.pgrst.object')
        return send(res, 200, single ? (rows[0] ?? null) : rows)
      } finally {
        await db.exec('reset role')
      }
    }
    const file = resolve(
      demo,
      '.' +
        decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname),
    )
    if (!file.startsWith(demo + '\\') && !file.startsWith(demo + '/'))
      return send(res, 403, { error: 'Denied' })
    const type =
      {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.jpg': 'image/jpeg',
        '.png': 'image/png',
        '.svg': 'image/svg+xml',
        '.webp': 'image/webp',
      }[extname(file)] || 'application/octet-stream'
    return send(res, 200, await readFile(file), type)
  } catch (error) {
    console.error('Local test request', error.message)
    send(res, error.code === 'ENOENT' ? 404 : 400, {
      message: error.message,
      code: error.code,
    })
  }
}
const server = createServer((req, res) => {
  queue = queue
    .then(() => request(req, res))
    .catch((error) => console.error(error.message))
})
server.listen(54321, '127.0.0.1', () =>
  console.log(
    'Disposable local showcase backend and Site 2: http://127.0.0.1:54321',
  ),
)
process.on('SIGINT', () => {
  server.close()
  void db.close()
})
