import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { PGlite } from '@electric-sql/pglite'

const root = resolve(import.meta.dirname, '..')
const db = new PGlite()

async function scalar(sql, params = []) {
  const result = await db.query(sql, params)
  return Object.values(result.rows[0])[0]
}

async function asRole(role, claims, fn) {
  await db.exec(`set role ${role}`)
  await db.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify(claims)])
  try {
    return await fn()
  } finally {
    await db.exec('reset role')
  }
}

try {
  await db.exec(await readFile(resolve(root, 'database/showcase-validation/bootstrap.sql'), 'utf8'))
  const migrationRoot = resolve(root, 'database/showcase-migrations')
  const migrations = (await readdir(migrationRoot)).filter((file) => file.endsWith('.sql')).sort()
  for (const migration of migrations) {
    const contents = await readFile(resolve(migrationRoot, migration), 'utf8')
    const version = migration.slice(0, 3)
    const name = migration.slice(4, -4)
    const sha256 = createHash('sha256').update(contents).digest('hex')
    await db.exec('begin')
    try {
      await db.exec(contents)
      await db.query('insert into showcase.schema_migrations(version,name,sha256) values ($1,$2,$3)', [version, name, sha256])
      await db.exec('commit')
    } catch (error) {
      await db.exec('rollback')
      throw error
    }
  }

  assert.equal(await scalar('select count(*)::integer from showcase.schema_migrations'), 7)
  let intentionalFailureRolledBack = false
  await db.exec('begin')
  try {
    await db.exec('create table showcase.rollback_probe(id integer)')
    await db.exec(await readFile(resolve(root, 'database/showcase-validation/007_intentional_failure.sql'), 'utf8'))
  } catch {
    intentionalFailureRolledBack = true
    await db.exec('rollback')
  }
  assert.equal(intentionalFailureRolledBack, true)
  assert.equal(await scalar("select to_regclass('showcase.rollback_probe') is null"), true)
  assert.equal(await scalar('select count(*)::integer from showcase.schema_migrations'), 7)

  const fixtures = (await readFile(resolve(root, 'database/showcase-validation/rls-fixtures.sql'), 'utf8'))
    .replace(/^\\set ON_ERROR_STOP on\s*/i, '')
  await db.exec(fixtures)

  assert.equal(await scalar(`select count(*)::integer from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='showcase' and c.relkind='r'`), 21)
  assert.equal(await scalar(`select bool_and(c.relrowsecurity) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='showcase' and c.relkind='r'`), true)

  await asRole('anon', { role: 'anon' }, async () => {
    assert.equal(await scalar(`select count(*)::integer from showcase.projects where id::text like '10000000-%'`), 1)
    assert.equal(await scalar(`select count(*)::integer from showcase.media_assets where id::text like '20000000-%'`), 1)
    await assert.rejects(db.query('select * from showcase.partner_private_details'))
    assert.equal(await scalar(`select count(*)::integer from storage.objects where bucket_id='showcase-media'`), 0)
  })

  await asRole('authenticated', { role: 'authenticated', sub: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3' }, async () => {
    assert.equal(await scalar(`select count(*)::integer from showcase.projects where id::text like '10000000-%'`), 1)
    assert.equal(await scalar('select count(*)::integer from showcase.partner_private_details'), 0)
    await assert.rejects(db.exec(`insert into showcase.projects(slug,title) values ('denied','Denied')`))
    await assert.rejects(db.query('select showcase.ensure_landing_draft()'))
  })

  await asRole('authenticated', { role: 'authenticated', sub: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2' }, async () => {
    assert.equal(await scalar('select public.is_admin()'), false)
    assert.equal(await scalar('select count(*)::integer from showcase.partner_private_documents'), 0)
    await assert.rejects(db.query('select showcase.ensure_landing_draft()'))
  })

  await asRole('authenticated', { role: 'authenticated', sub: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1' }, async () => {
    assert.equal(await scalar('select public.is_admin()'), true)
    assert.equal(await scalar(`select count(*)::integer from showcase.projects where id::text like '10000000-%'`), 3)
    assert.equal(await scalar('select count(*)::integer from showcase.partner_private_details'), 1)
    assert.equal(await scalar(`select showcase.is_media_public('20000000-0000-0000-0000-000000000004')`), false)
    await db.exec(`insert into showcase.cms_settings(key,value) values ('site_title','"JP Aluminium"'::jsonb)`)
    assert.equal(await scalar(`select count(*)::integer from showcase.audit_events where table_name='cms_settings' and record_id='site_title'`), 1)

    await db.exec(`insert into showcase.landing_page_versions(id,status) values ('70000000-0000-0000-0000-000000000001','draft')`)
    const sections = [{
      id: '71000000-0000-0000-0000-000000000001',
      section_key: 'hero',
      title: 'Original hero',
      description: null,
      content: {},
      media_asset_id: null,
      is_visible: true,
    }]
    const featured = [{
      project_id: '10000000-0000-0000-0000-000000000001',
      display_title: 'Public project',
      display_description: null,
    }]
    await db.query(`select showcase.save_landing_draft($1,$2,$3,$4::jsonb,$5::jsonb)`, [
      '70000000-0000-0000-0000-000000000001', 'Original title', null,
      JSON.stringify(sections), JSON.stringify(featured),
    ])
    assert.equal(await scalar(`select title from showcase.landing_sections where id='71000000-0000-0000-0000-000000000001'`), 'Original hero')

    const invalidSections = [{ ...sections[0], title: 'Must roll back', media_asset_id: 'ffffffff-ffff-4fff-8fff-ffffffffffff' }]
    await assert.rejects(db.query(`select showcase.save_landing_draft($1,$2,$3,$4::jsonb,$5::jsonb)`, [
      '70000000-0000-0000-0000-000000000001', 'Must roll back', null,
      JSON.stringify(invalidSections), JSON.stringify(featured),
    ]))
    assert.equal(await scalar(`select meta_title from showcase.landing_page_versions where id='70000000-0000-0000-0000-000000000001'`), 'Original title')
    assert.equal(await scalar(`select title from showcase.landing_sections where id='71000000-0000-0000-0000-000000000001'`), 'Original hero')

    await db.query(`select showcase.publish_landing_version('70000000-0000-0000-0000-000000000001')`)
    assert.equal(await scalar(`select status::text from showcase.landing_page_versions where id='70000000-0000-0000-0000-000000000001'`), 'published')
    assert.equal(await scalar(`select count(*)::integer from showcase.audit_events where table_name='landing_featured_projects' and record_id='70000000-0000-0000-0000-000000000001:10000000-0000-0000-0000-000000000001'`), 1)
    assert.equal(await scalar(`select count(*)::integer from showcase.audit_events where table_name='partner_private_details' and record_id='40000000-0000-0000-0000-000000000001'`), 1)

    const nextDraftId = await scalar('select showcase.ensure_landing_draft()')
    assert.notEqual(nextDraftId, '70000000-0000-0000-0000-000000000001')
    assert.equal(await scalar('select count(*)::integer from showcase.landing_sections where version_id=$1', [nextDraftId]), 1)
    assert.equal(await scalar('select count(*)::integer from showcase.landing_featured_projects where version_id=$1', [nextDraftId]), 1)
    assert.equal(await scalar('select showcase.ensure_landing_draft()'), nextDraftId)
  })

  console.log('PASS disposable PostgreSQL migration order/rollback, schema, RLS matrix, private media, atomic landing rollback, publishing, and audit identifiers')
} finally {
  await db.close()
}
