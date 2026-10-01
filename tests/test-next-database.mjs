import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
const root = resolve(import.meta.dirname, '..'),
  db = new PGlite()
const scalar = async (sql, args = []) =>
  Object.values((await db.query(sql, args)).rows[0])[0]
const admin = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'
async function role(name, id, fn) {
  await db.exec(`set role ${name}`)
  await db.query("select set_config('request.jwt.claims',$1,false)", [
    JSON.stringify({ role: name, sub: id }),
  ])
  try {
    return await fn()
  } finally {
    await db.exec('reset role')
  }
}
try {
  await db.exec(
    await readFile(
      resolve(root, 'database/showcase-validation/bootstrap.sql'),
      'utf8',
    ),
  )
  for (const file of (
    await readdir(resolve(root, 'database/showcase-migrations'))
  )
    .filter((f) => f.endsWith('.sql'))
    .sort())
    await db.exec(
      await readFile(
        resolve(root, 'database/showcase-migrations', file),
        'utf8',
      ),
    )
  await db.exec(`
 insert into showcase.room_categories(id,slug,name,status) values('91000000-0000-4000-8000-000000000001','legacy-lounge','Legacy lounge','published');
 insert into showcase.projects(id,slug,title,location,status,published_at) values('92000000-0000-4000-8000-000000000001','legacy-live','Legacy live','Dubai','published',now()),('92000000-0000-4000-8000-000000000002','legacy-private','Legacy private','Dubai','draft',null);
 insert into showcase.project_rooms(id,project_id,room_category_id) values('93000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001'),('93000000-0000-4000-8000-000000000002','92000000-0000-4000-8000-000000000002','91000000-0000-4000-8000-000000000001');
 insert into showcase.works(id,slug,title,room_category_id,project_id,project_room_id,status,published_at) values('94000000-0000-4000-8000-000000000001','legacy-live-work','Legacy live work','91000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000001','published',now()),('94000000-0000-4000-8000-000000000002','legacy-private-work','Legacy private work','91000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000002','93000000-0000-4000-8000-000000000002','published',now());
 insert into showcase.media_assets(id,title,storage_path,kind,mime_type,original_filename,byte_size,status,published_at,is_publicly_deliverable) values('95000000-0000-4000-8000-000000000001','Legacy image','works/legacy/image.webp','image','image/webp','image.webp',10,'published',now(),true);
 insert into showcase.work_media(work_id,media_asset_id,sort_order) values('94000000-0000-4000-8000-000000000001','95000000-0000-4000-8000-000000000001',9);
 `)
  await db.exec(
    await readFile(
      resolve(root, 'database/showcase-next/008_room_based_content.sql'),
      'utf8',
    ),
  )
  assert.equal(
    await scalar(
      "select location from showcase.works where id='94000000-0000-4000-8000-000000000001'",
    ),
    'Dubai',
  )
  assert.equal(
    await scalar(
      "select sort_order from showcase.media_items where owner_id='94000000-0000-4000-8000-000000000001'",
    ),
    0,
  )
  assert.equal(
    await scalar(
      "select is_custom from showcase.room_categories where name='Legacy lounge'",
    ),
    true,
  )
  await role('anon', null, async () => {
    assert.equal(
      await scalar('select count(*)::integer from showcase.works'),
      1,
    )
    assert.equal(
      await scalar('select count(*)::integer from showcase.media_items'),
      1,
    )
  })
  await db.exec(
    "delete from showcase.projects where slug in ('legacy-live','legacy-private'); delete from showcase.room_categories where name='Legacy lounge'; delete from showcase.media_assets where id='95000000-0000-4000-8000-000000000001'",
  )
  await db.query("insert into identity.profiles(id,role) values($1,'admin')", [
    admin,
  ])
  const hall = await scalar(
    "select id from showcase.room_categories where name='Hall'",
  )
  let work, material, partner, custom
  const assets = [
    '82000000-0000-4000-8000-000000000001',
    '82000000-0000-4000-8000-000000000002',
    '82000000-0000-4000-8000-000000000003',
  ]
  const save = (kind, id, data, media = [], cover = null) =>
    scalar('select showcase.save_content($1,$2,$3::jsonb,$4::jsonb,$5)', [
      kind,
      id,
      JSON.stringify(data),
      JSON.stringify(media),
      cover,
    ])
  await role('authenticated', admin, async () => {
    for (const [i, id] of assets.entries())
      await db.query(
        'insert into showcase.media_assets(id,title,storage_path,kind,mime_type,original_filename,byte_size) values($1,$2,$3,$4,$5,$6,10)',
        [
          id,
          `Asset ${i}`,
          `works/test/${id}/asset`,
          ['image', 'video', 'model_3d'][i],
          ['image/webp', 'video/mp4', 'model/gltf-binary'][i],
          `asset${i}`,
        ],
      )
    await assert.rejects(
      save('work', null, {
        title: 'No location',
        room_category_id: hall,
        status: 'published',
      }),
    )
    assert.equal(
      await scalar('select count(*)::integer from showcase.works'),
      0,
    )
    work = await save(
      'work',
      '83000000-0000-4000-8000-000000000001',
      {
        create: true,
        title: 'Modern Kitchen',
        location: 'Coimbatore',
        room_category_id: hall,
        status: 'draft',
      },
      assets,
      assets[0],
    )
    await save(
      'work',
      work,
      {
        title: 'Kitchen revised',
        location: 'Coimbatore',
        room_category_id: hall,
        status: 'draft',
      },
      assets,
      assets[0],
    )
    assert.equal(
      await scalar('select title from showcase.works where id=$1', [work]),
      'Kitchen revised',
    )
    assert.equal(
      await scalar(
        'select project_id is null and project_room_id is null from showcase.works where id=$1',
        [work],
      ),
      true,
    )
    await save(
      'work',
      work,
      {
        title: 'Kitchen revised',
        location: 'Coimbatore',
        room_category_id: hall,
        status: 'published',
      },
      assets,
      assets[0],
    )
    await db.query('select showcase.reorder_media($1,$2,$3::jsonb)', [
      'work',
      work,
      JSON.stringify([assets[2], assets[0], assets[1]]),
    ])
    assert.deepEqual(
      (
        await db.query(
          'select media_asset_id from showcase.media_items where owner_id=$1 order by sort_order',
          [work],
        )
      ).rows.map((r) => r.media_asset_id),
      [assets[2], assets[0], assets[1]],
    )
    await assert.rejects(
      db.query('select showcase.reorder_media($1,$2,$3::jsonb)', [
        'work',
        work,
        JSON.stringify([assets[0], assets[0], assets[1]]),
      ]),
    )
    const other = await scalar(
      "select id from showcase.room_categories where name='Other'",
    )
    custom = await save('work', null, {
      title: 'Study shelving',
      location: 'Chennai',
      room_category_id: other,
      custom_room_name: 'Study',
      status: 'draft',
    })
    assert.equal(
      await scalar(
        'select r.name from showcase.works w join showcase.room_categories r on r.id=w.room_category_id where w.id=$1',
        [custom],
      ),
      'Study',
    )
    assert.equal(
      await scalar(
        'select r.status from showcase.works w join showcase.room_categories r on r.id=w.room_category_id where w.id=$1',
        [custom],
      ),
      'draft',
    )
    await save(
      'room',
      hall,
      { title: 'Cannot rename fixed Hall', status: 'published' },
      [],
      assets[0],
    )
    assert.equal(
      await scalar('select name from showcase.room_categories where id=$1', [
        hall,
      ]),
      'Hall',
    )
    material = await save(
      'material',
      null,
      { title: 'Oak finish', tier: 'low', status: 'published' },
      assets,
      assets[0],
    )
    assert.equal(
      await scalar('select tier from showcase.materials where id=$1', [
        material,
      ]),
      'low',
    )
    await assert.rejects(
      save('material', null, {
        title: 'Illegal tier',
        tier: 'custom',
        status: 'draft',
      }),
    )
    await assert.rejects(
      db.exec(
        "update showcase.material_collections set name='Custom' where range='cap'",
      ),
    )
    partner = await save(
      'partner',
      null,
      { title: 'Partner', status: 'published' },
      [assets[0]],
      assets[0],
    )
    const draft = await scalar('select showcase.ensure_landing_draft()')
    const sections = [
      {
        id: crypto.randomUUID(),
        section_key: 'hero',
        title: 'Hero',
        content: { heading: 'Approved heading' },
        media_asset_id: assets[0],
        is_visible: true,
      },
    ]
    await db.query(
      'select showcase.save_landing_draft($1,$2,$3,$4::jsonb,$5::jsonb)',
      [draft, 'Meta', null, JSON.stringify(sections), '[]'],
    )
    await db.query('select showcase.publish_homepage($1)', [draft])
    assert.equal(
      await scalar(
        'select status from showcase.landing_page_versions where id=$1',
        [draft],
      ),
      'published',
    )
  })
  await role('anon', null, async () => {
    assert.equal(
      await scalar('select count(*)::integer from showcase.works'),
      1,
    )
    assert.equal(
      await scalar('select count(*)::integer from showcase.materials'),
      1,
    )
    assert.equal(
      await scalar('select count(*)::integer from showcase.media_items'),
      6,
    )
    assert.equal(
      await scalar('select showcase.is_media_public($1)', [assets[0]]),
      true,
    )
    await assert.rejects(
      db.query('select * from showcase.partner_private_details'),
    )
    await assert.rejects(save('work', null, { title: 'Denied' }))
  })
  await role(
    'authenticated',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3',
    async () => {
      await assert.rejects(save('work', null, { title: 'Denied' }))
      await assert.rejects(
        db.query('select showcase.reorder_media($1,$2,$3::jsonb)', [
          'work',
          work,
          '[]',
        ]),
      )
    },
  )
  await role('authenticated', admin, async () => {
    await save(
      'work',
      work,
      {
        title: 'Kitchen revised',
        location: 'Coimbatore',
        room_category_id: hall,
        status: 'archived',
      },
      assets,
      assets[0],
    )
    assert.equal(
      await scalar('select showcase.owner_is_public($1,$2)', ['work', work]),
      false,
    )
  })
  await role('anon', null, async () => {
    assert.equal(
      await scalar('select count(*)::integer from showcase.works'),
      0,
    )
  })
  await role('authenticated', admin, async () => {
    await save(
      'work',
      work,
      {
        title: 'Kitchen revised',
        location: 'Coimbatore',
        room_category_id: hall,
        status: 'published',
      },
      assets,
      assets[0],
    )
    await save(
      'room',
      hall,
      { title: 'Hall', status: 'archived' },
      [],
      assets[0],
    )
  })
  await role('anon', null, async () => {
    assert.equal(
      await scalar('select count(*)::integer from showcase.works'),
      0,
    )
  })
  await role('authenticated', admin, async () => {
    await save(
      'room',
      hall,
      { title: 'Hall', status: 'published' },
      [],
      assets[0],
    )
    assert.equal(
      await scalar('select showcase.owner_is_public($1,$2)', ['work', work]),
      true,
    )
    await assert.rejects(
      save('partner', null, { title: 'Missing logo', status: 'published' }),
    )
  })
  await role('authenticated', admin, async () => {
    const privateId = '82000000-0000-4000-8000-000000000004'
    await db.query(
      "insert into showcase.media_assets(id,title,storage_path,kind,mime_type,original_filename,byte_size) values($1,'Private','internal/partners/private','document','application/pdf','private.pdf',10)",
      [privateId],
    )
    await assert.rejects(
      save(
        'work',
        work,
        {
          title: 'Kitchen',
          location: 'Chennai',
          room_category_id: hall,
          status: 'published',
        },
        [privateId],
      ),
    )
    assert.equal(
      await scalar(
        'select count(*)::integer from showcase.media_items where owner_id=$1',
        [work],
      ),
      3,
    )
    await db.query('delete from showcase.works where id=$1', [work])
    assert.equal(
      await scalar(
        'select count(*)::integer from showcase.media_items where owner_id=$1',
        [work],
      ),
      0,
    )
    await db.query('delete from showcase.materials where id=$1', [material])
    await db.query('delete from showcase.partners where id=$1', [partner])
    await db.query('delete from showcase.works where id=$1', [custom])
  })
  assert.equal(
    await scalar(
      'select count(*)::integer from supabase_migrations.schema_migrations',
    ),
    2,
  )
  assert.equal(
    await scalar(
      "select count(*)::integer from showcase.audit_events where table_name='media_items' and record_id is null",
    ),
    0,
  )
  // The next UI retires legacy editing permissions without deleting its data.
  await db.exec(
    await readFile(
      resolve(root, 'supabase/migrations/20261001045730_room_first_cms.sql'),
      'utf8',
    ),
  )
  for (const fn of [
    'ensure_landing_draft()',
    'save_landing_draft(uuid,text,text,jsonb,jsonb)',
    'publish_landing_version(uuid)',
    'publish_homepage(uuid)',
  ]) {
    assert.equal(
      await scalar(
        "select has_function_privilege('authenticated',$1,'execute')",
        ['showcase.' + fn],
      ),
      false,
    )
  }
  assert.equal(
    await scalar(
      "select has_table_privilege('authenticated','showcase.cms_settings','update')",
    ),
    false,
  )
  await role('anon', null, async () => {
    await assert.rejects(
      scalar('select showcase.reorder_works($1,$2::uuid[])', [hall, '{}']),
    )
  })
  await role('authenticated', admin, async () => {
    const roomIds = (
      await db.query(
        'select id from showcase.room_categories order by sort_order,name',
      )
    ).rows.map((r) => r.id)
    await scalar('select showcase.reorder_rooms($1::uuid[])', [
      `{${roomIds.toReversed().join(',')}}`,
    ])
    assert.equal(
      await scalar(
        'select sort_order from showcase.room_categories where id=$1',
        [roomIds.at(-1)],
      ),
      0,
    )
    await assert.rejects(
      scalar('select showcase.reorder_rooms($1::uuid[])', [`{${roomIds[0]}}`]),
    )
    const a = await save('work', null, {
      title: 'Album A',
      location: 'Chennai',
      room_category_id: hall,
      status: 'draft',
    })
    const b = await save('work', null, {
      title: 'Album B',
      location: 'Chennai',
      room_category_id: hall,
      status: 'draft',
    })
    assert.equal(
      await scalar('select sort_order from showcase.works where id=$1', [b]),
      1,
    )
    await scalar('select showcase.reorder_works($1,$2::uuid[])', [
      hall,
      `{${b},${a}}`,
    ])
    assert.equal(
      await scalar('select sort_order from showcase.works where id=$1', [b]),
      0,
    )
    await assert.rejects(
      scalar('select showcase.reorder_works($1,$2::uuid[])', [
        hall,
        `{${a},${a}}`,
      ]),
    )
    await assert.rejects(
      scalar('select showcase.reorder_works($1,$2::uuid[])', [hall, `{${a}}`]),
    )
    await save('work', a, {
      title: 'Album A revised',
      location: 'Chennai',
      room_category_id: hall,
      status: 'draft',
    })
    assert.equal(
      await scalar('select sort_order from showcase.works where id=$1', [a]),
      1,
    )
  })
  console.log(
    'PASS next-phase disposable database: CRUD, custom room, fixed tiers, mixed ordering, atomic validation, publication, RLS, private media, cleanup, unrelated schema preservation',
  )
} catch (error) {
  console.error(error.message, error.code, error.position, error.where)
  process.exitCode = 1
} finally {
  await db.close()
}
