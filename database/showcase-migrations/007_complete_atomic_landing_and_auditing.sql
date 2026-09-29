alter table showcase.audit_events
  alter column record_id type text using record_id::text;

create or replace function showcase.write_audit_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  old_row jsonb;
  new_row jsonb;
  row_data jsonb;
  row_id text;
begin
  old_row := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  new_row := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  row_data := coalesce(new_row, old_row);
  row_id := case tg_table_name
    when 'partner_private_details' then row_data ->> 'partner_id'
    when 'cms_settings' then row_data ->> 'key'
    when 'project_media' then concat_ws(':', row_data ->> 'project_id', row_data ->> 'media_asset_id')
    when 'project_room_media' then concat_ws(':', row_data ->> 'project_room_id', row_data ->> 'media_asset_id')
    when 'work_media' then concat_ws(':', row_data ->> 'work_id', row_data ->> 'media_asset_id')
    when 'work_materials' then concat_ws(':', row_data ->> 'work_id', row_data ->> 'material_id')
    when 'project_partners' then concat_ws(':', row_data ->> 'project_id', row_data ->> 'partner_id')
    when 'landing_featured_projects' then concat_ws(':', row_data ->> 'version_id', row_data ->> 'project_id')
    else row_data ->> 'id'
  end;

  insert into showcase.audit_events(actor_id, action, table_name, record_id, old_data, new_data)
  values (auth.uid(), lower(tg_op), tg_table_name, row_id, old_row, new_row);
  return case when tg_op = 'DELETE' then old else new end;
end
$function$;

do $block$
declare
  t text;
begin
  foreach t in array array[
    'project_media', 'project_room_media', 'work_media', 'work_materials',
    'project_partners', 'landing_featured_projects'
  ] loop
    execute format(
      'create trigger audit_%I after insert or update or delete on showcase.%I for each row execute function showcase.write_audit_event()',
      t,
      t
    );
  end loop;
end
$block$;

alter table showcase.landing_sections
  drop constraint landing_sections_version_id_sort_order_key,
  add constraint landing_sections_version_id_sort_order_key
    unique (version_id, sort_order) deferrable initially immediate;

alter table showcase.landing_featured_projects
  drop constraint landing_featured_projects_version_id_sort_order_key,
  add constraint landing_featured_projects_version_id_sort_order_key
    unique (version_id, sort_order) deferrable initially immediate;

create function showcase.ensure_landing_draft()
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_draft_id uuid;
  v_published_id uuid;
  v_meta_title text;
  v_meta_description text;
begin
  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('showcase:landing-draft', 0));

  select id into v_draft_id
  from showcase.landing_page_versions
  where status = 'draft'
  order by created_at desc
  limit 1;
  if v_draft_id is not null then return v_draft_id; end if;

  select id, meta_title, meta_description
  into v_published_id, v_meta_title, v_meta_description
  from showcase.landing_page_versions
  where status = 'published'
  limit 1;

  insert into showcase.landing_page_versions(meta_title, meta_description, created_by, updated_by)
  values (v_meta_title, v_meta_description, v_actor, v_actor)
  returning id into v_draft_id;

  if v_published_id is not null then
    insert into showcase.landing_sections(
      id, version_id, section_key, title, description, content, media_asset_id,
      is_visible, sort_order, created_by, updated_by
    )
    select
      gen_random_uuid(), v_draft_id, section_key, title, description, content,
      media_asset_id, is_visible, sort_order, v_actor, v_actor
    from showcase.landing_sections
    where version_id = v_published_id;

    insert into showcase.landing_featured_projects(
      version_id, project_id, sort_order, display_title, display_description
    )
    select v_draft_id, project_id, sort_order, display_title, display_description
    from showcase.landing_featured_projects
    where version_id = v_published_id;
  end if;

  return v_draft_id;
end
$function$;

alter function showcase.ensure_landing_draft() owner to postgres;
revoke all on function showcase.ensure_landing_draft() from public, anon, authenticated, service_role;
grant execute on function showcase.ensure_landing_draft() to authenticated;

create function showcase.save_landing_draft(
  p_version_id uuid,
  p_meta_title text,
  p_meta_description text,
  p_sections jsonb,
  p_featured jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
begin
  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_sections is null or p_featured is null
     or jsonb_typeof(p_sections) <> 'array'
     or jsonb_typeof(p_featured) <> 'array' then
    raise exception 'landing sections and featured projects must be arrays' using errcode = '22023';
  end if;
  if not exists (
    select 1 from showcase.landing_page_versions
    where id = p_version_id and status = 'draft'
    for update
  ) then
    raise exception 'landing version must exist and be draft' using errcode = '23514';
  end if;
  if exists (
    select 1
    from jsonb_to_recordset(p_sections) as s(id uuid)
    where s.id is null
  ) then
    raise exception 'each landing section requires an id' using errcode = '23502';
  end if;
  if exists (
    select 1
    from jsonb_to_recordset(p_sections) as s(id uuid)
    join showcase.landing_sections existing on existing.id = s.id
    where existing.version_id <> p_version_id
  ) then
    raise exception 'landing section belongs to another version' using errcode = '23514';
  end if;

  set constraints showcase.landing_sections_version_id_sort_order_key deferred;
  set constraints showcase.landing_featured_projects_version_id_sort_order_key deferred;

  update showcase.landing_page_versions
  set meta_title = p_meta_title,
      meta_description = p_meta_description,
      updated_at = now(),
      updated_by = v_actor
  where id = p_version_id;

  insert into showcase.landing_sections(
    id, version_id, section_key, title, description, content, media_asset_id,
    is_visible, sort_order, created_at, updated_at, created_by, updated_by
  )
  select
    (s.value ->> 'id')::uuid,
    p_version_id,
    s.value ->> 'section_key',
    s.value ->> 'title',
    s.value ->> 'description',
    coalesce(s.value -> 'content', '{}'::jsonb),
    (s.value ->> 'media_asset_id')::uuid,
    coalesce((s.value ->> 'is_visible')::boolean, true),
    s.ordinality::integer - 1,
    now(), now(), v_actor, v_actor
  from jsonb_array_elements(p_sections) with ordinality as s(value, ordinality)
  on conflict (id) do update set
    section_key = excluded.section_key,
    title = excluded.title,
    description = excluded.description,
    content = excluded.content,
    media_asset_id = excluded.media_asset_id,
    is_visible = excluded.is_visible,
    sort_order = excluded.sort_order,
    updated_at = excluded.updated_at,
    updated_by = excluded.updated_by;

  delete from showcase.landing_sections existing
  where existing.version_id = p_version_id
    and not exists (
      select 1 from jsonb_to_recordset(p_sections) as s(id uuid)
      where s.id = existing.id
    );

  insert into showcase.landing_featured_projects(
    version_id, project_id, sort_order, display_title, display_description
  )
  select
    p_version_id,
    (f.value ->> 'project_id')::uuid,
    f.ordinality::integer - 1,
    f.value ->> 'display_title',
    f.value ->> 'display_description'
  from jsonb_array_elements(p_featured) with ordinality as f(value, ordinality)
  on conflict (version_id, project_id) do update set
    sort_order = excluded.sort_order,
    display_title = excluded.display_title,
    display_description = excluded.display_description;

  delete from showcase.landing_featured_projects existing
  where existing.version_id = p_version_id
    and not exists (
      select 1 from jsonb_to_recordset(p_featured) as f(project_id uuid)
      where f.project_id = existing.project_id
    );
end
$function$;

alter function showcase.save_landing_draft(uuid, text, text, jsonb, jsonb) owner to postgres;
revoke all on function showcase.save_landing_draft(uuid, text, text, jsonb, jsonb) from public, anon, authenticated, service_role;
grant execute on function showcase.save_landing_draft(uuid, text, text, jsonb, jsonb) to authenticated;

create or replace function showcase.publish_landing_version(p_version_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if not public.is_admin() then raise exception 'not_authorized' using errcode = '42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('showcase:landing-publish', 0));
  if not exists (
    select 1 from showcase.landing_page_versions
    where id = p_version_id and status = 'draft'
    for update
  ) then
    raise exception 'landing version must exist and be draft' using errcode = '23514';
  end if;
  if not exists (
    select 1 from showcase.landing_sections
    where version_id = p_version_id and is_visible
  ) then
    raise exception 'landing version must contain a visible section' using errcode = '23514';
  end if;
  if exists (
    select 1 from showcase.landing_featured_projects fp
    join showcase.projects p on p.id = fp.project_id
    where fp.version_id = p_version_id and p.status <> 'published'
  ) then
    raise exception 'featured projects must be published' using errcode = '23514';
  end if;
  if exists (
    select 1 from showcase.landing_sections ls
    join showcase.media_assets ma on ma.id = ls.media_asset_id
    where ls.version_id = p_version_id and ls.is_visible and ls.media_asset_id is not null
      and (
        ma.status <> 'published'
        or not ma.is_publicly_deliverable
        or ma.storage_path like 'internal/%'
        or ma.storage_path like 'unassigned/%'
        or exists (
          select 1 from showcase.partner_private_documents ppd
          where ppd.media_asset_id = ma.id
        )
      )
  ) then
    raise exception 'visible landing media must be approved for public delivery' using errcode = '23514';
  end if;

  update showcase.landing_page_versions
  set status = 'archived', updated_at = now(), updated_by = auth.uid()
  where status = 'published' and id <> p_version_id;

  update showcase.landing_page_versions
  set status = 'published', published_at = now(), published_by = auth.uid(),
      updated_at = now(), updated_by = auth.uid()
  where id = p_version_id;
end
$function$;
