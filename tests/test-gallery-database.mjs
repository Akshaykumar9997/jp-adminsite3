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
  for (const file of [
    'database/showcase-next/008_room_based_content.sql',
    'supabase/migrations/20261001045730_room_first_cms.sql',
    'supabase/migrations/20261001165025_gallery_trash.sql',
    'supabase/migrations/20261001175929_video_first_frame.sql',
    'supabase/migrations/20261001192454_room_visibility.sql',
  ])
    await db.exec(await readFile(resolve(root, file), 'utf8'))
  await db.query("insert into identity.profiles(id,role) values($1,'admin')", [
    admin,
  ])
  let room, work, material, asset
  const save = (kind, id, data, assets = [], cover = null) =>
    scalar('select showcase.save_content($1,$2,$3::jsonb,$4::jsonb,$5)', [
      kind,
      id,
      JSON.stringify(data),
      JSON.stringify(assets),
      cover,
    ])
  await role('authenticated', admin, async () => {
    asset = await scalar(
      "insert into showcase.media_assets(title,storage_path,kind,mime_type,original_filename,byte_size) values('Trash image','works/trash/image.jpg','image','image/jpeg','image.jpg',100) returning id",
    )
    const legacyRoom = await scalar(
      "select id from showcase.room_categories where name='Hall'",
    )
    await save('room', legacyRoom, {
      title: 'Hall renamed',
      status: 'published',
    })
    assert.equal(
      await scalar('select name from showcase.room_categories where id=$1', [
        legacyRoom,
      ]),
      'Hall renamed',
    )
    await save('room', legacyRoom, { title: 'Hall', status: 'published' })
    await assert.rejects(
      save('room', null, { title: 'Invalid room' }, [asset]),
      /Room media belongs to works/,
    )
    const compatibilityRoom = await save('room', null, {
      title: 'Legacy status',
      status: 'draft',
    })
    assert.equal(
      await scalar('select status from showcase.room_categories where id=$1', [
        compatibilityRoom,
      ]),
      'archived',
    )
    await db.query(
      'update showcase.room_categories set deleted_at=now() where id=$1',
      [compatibilityRoom],
    )
    await db.query('delete from showcase.room_categories where id=$1', [
      compatibilityRoom,
    ])
    room = await save('room', null, {
      title: 'Trash lounge',
      status: 'published',
    })
    work = await save(
      'work',
      null,
      {
        title: 'Trash work',
        location: 'Chennai',
        room_category_id: room,
        status: 'published',
      },
      [asset],
      asset,
    )
    material = await save(
      'material',
      null,
      { title: 'Trash oak', tier: 'mid', status: 'published' },
      [asset],
      asset,
    )
    assert.equal(
      await scalar('select showcase.is_media_public($1)', [asset]),
      true,
    )
    const video = await scalar(
      "insert into showcase.media_assets(title,storage_path,kind,mime_type,original_filename,byte_size,poster_asset_id) values('First frame video','works/verification/video.mp4','video','video/mp4','video.mp4',100,$1) returning id",
      [asset],
    )
    assert.equal(
      await scalar(
        'select poster_asset_id from showcase.media_assets where id=$1',
        [video],
      ),
      null,
    )
    await db.query(
      'update showcase.media_assets set poster_asset_id=$1 where id=$2',
      [asset, video],
    )
    assert.equal(
      await scalar(
        'select poster_asset_id from showcase.media_assets where id=$1',
        [video],
      ),
      null,
    )
    assert.equal(
      await scalar(
        "select has_function_privilege('authenticated','showcase.set_video_poster(uuid,uuid)','EXECUTE')",
      ),
      false,
    )
    await assert.rejects(
      db.query('delete from showcase.materials where id=$1', [material]),
      /Trash before/,
    )
    await assert.rejects(
      db.query(
        'update showcase.media_assets set deleted_at=now() where id=$1',
        [asset],
      ),
      /still in use/,
    )
    await assert.rejects(
      db.query(
        'update showcase.room_categories set deleted_at=now() where id=$1',
        [room],
      ),
      /contains works/,
    )
    await db.exec(
      "update showcase.room_categories set deleted_at=now() where name='Hall'; update showcase.room_categories set deleted_at=null where name='Hall'",
    )
    await db.query(
      'update showcase.materials set deleted_at=now() where id=$1',
      [material],
    )
    await assert.rejects(
      save(
        'material',
        material,
        { title: 'Malicious republish', status: 'published', tier: 'mid' },
        [asset],
        asset,
      ),
      /Restore this item/,
    )
    await db.query('update showcase.works set deleted_at=now() where id=$1', [
      work,
    ])
    await db.query(
      'update showcase.room_categories set deleted_at=now() where id=$1',
      [room],
    )
    await assert.rejects(
      db.query('update showcase.works set deleted_at=null where id=$1', [work]),
      /Restore the room/,
    )
    assert.equal(
      await scalar('select showcase.is_media_public($1)', [asset]),
      false,
    )
    assert.equal(
      await scalar(
        'select count(*)::integer from showcase.media_items where owner_id=$1',
        [work],
      ),
      1,
      'Trash retains associations',
    )
  })
  await role('anon', null, async () => {
    for (const [table, id] of [
      ['works', work],
      ['room_categories', room],
      ['materials', material],
    ])
      assert.equal(
        await scalar(
          `select count(*)::integer from showcase.${table} where id=$1`,
          [id],
        ),
        0,
      )
    assert.equal(
      await scalar(
        'select count(*)::integer from showcase.media_items where owner_id=$1',
        [work],
      ),
      0,
    )
    assert.equal(
      await scalar('select showcase.owner_is_public($1,$2)', ['work', work]),
      false,
    )
  })
  await role(
    'authenticated',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
    async () => {
      assert.equal(
        await scalar(
          'select count(*)::integer from showcase.materials where id=$1',
          [material],
        ),
        0,
      )
      assert.equal(
        await scalar(
          'with restored as (update showcase.materials set deleted_at=null where id=$1 returning id) select count(*)::integer from restored',
          [material],
        ),
        0,
      )
    },
  )
  await role('authenticated', admin, async () => {
    await db.query(
      "update showcase.room_categories set deleted_at=null,status='published' where id=$1",
      [room],
    )
    await db.query(
      "update showcase.works set deleted_at=null,status='published',published_at=now() where id=$1",
      [work],
    )
    assert.deepEqual(
      (
        await db.query(
          'select status,published_at,deleted_at from showcase.works where id=$1',
          [work],
        )
      ).rows[0],
      { status: 'archived', published_at: null, deleted_at: null },
    )
    await db.query(
      'update showcase.materials set deleted_at=null where id=$1',
      [material],
    )
    assert.equal(
      await scalar('select status from showcase.materials where id=$1', [
        material,
      ]),
      'archived',
    )
    await db.query('update showcase.works set deleted_at=now() where id=$1', [
      work,
    ])
    await db.query('delete from showcase.works where id=$1', [work])
    await db.query(
      'update showcase.materials set deleted_at=now() where id=$1',
      [material],
    )
    await db.query('delete from showcase.materials where id=$1', [material])
    assert.equal(
      await scalar(
        'select count(*)::integer from showcase.media_items where owner_id=$1',
        [work],
      ),
      0,
    )
    await db.query(
      'update showcase.media_assets set deleted_at=now() where id=$1',
      [asset],
    )
    await assert.rejects(
      save(
        'material',
        null,
        { title: 'Invalid reused file', tier: 'mid', status: 'archived' },
        [asset],
        asset,
      ),
      /Restore the selected file/,
    )
    await assert.rejects(
      db.query(
        "update showcase.media_assets set status='published',is_publicly_deliverable=true where id=$1",
        [asset],
      ),
      /Restore this item/,
    )
    await db.query(
      "update showcase.media_assets set deleted_at=null,status='published',is_publicly_deliverable=true where id=$1",
      [asset],
    )
    assert.equal(
      await scalar(
        'select is_publicly_deliverable from showcase.media_assets where id=$1',
        [asset],
      ),
      false,
    )
    const order = (
      await db.query(
        'select id from showcase.room_categories where deleted_at is null order by sort_order,id',
      )
    ).rows.map((row) => row.id)
    await db.query('select showcase.reorder_rooms($1)', [order])
    await db.query(
      'update showcase.room_categories set deleted_at=now() where id=$1',
      [room],
    )
    await db.query('select showcase.reorder_rooms($1)', [
      order.filter((id) => id !== room),
    ])
    await assert.rejects(
      db.query('select showcase.reorder_rooms($1)', [order]),
      /gallery changed/,
    )
    await db.query('delete from showcase.room_categories where id=$1', [room])
  })
  console.log(
    'PASS: Editable legacy rooms, room-media rejection, two-status compatibility, Trash guards, admin/non-admin/anonymous RLS, publication denial, Archived restore, parent dependencies, retained associations, permanent deletion, trash reuse denial and active-only reordering.',
  )
} finally {
  await db.close()
}
