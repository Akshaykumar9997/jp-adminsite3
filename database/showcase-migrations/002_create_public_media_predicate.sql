create function showcase.is_media_public(p_asset_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1 from showcase.media_assets ma
    where ma.id = p_asset_id
      and ma.status = 'published'::showcase.content_status
      and ma.is_publicly_deliverable
      and ma.storage_path not like 'internal/%'
      and ma.storage_path not like 'unassigned/%'
      and not exists (
        select 1 from showcase.partner_private_documents ppd
        where ppd.media_asset_id = ma.id
      )
      and (
        exists (select 1 from showcase.projects p where p.cover_asset_id = ma.id and p.status = 'published')
        or exists (select 1 from showcase.project_media pm join showcase.projects p on p.id = pm.project_id where pm.media_asset_id = ma.id and p.status = 'published')
        or exists (select 1 from showcase.project_room_media prm join showcase.project_rooms pr on pr.id = prm.project_room_id join showcase.projects p on p.id = pr.project_id where prm.media_asset_id = ma.id and p.status = 'published')
        or exists (select 1 from showcase.works w left join showcase.projects p on p.id = w.project_id where w.cover_asset_id = ma.id and w.status = 'published' and (w.project_id is null or p.status = 'published'))
        or exists (select 1 from showcase.work_media wm join showcase.works w on w.id = wm.work_id left join showcase.projects p on p.id = w.project_id where wm.media_asset_id = ma.id and w.status = 'published' and (w.project_id is null or p.status = 'published'))
        or exists (select 1 from showcase.materials m join showcase.material_collections mc on mc.id = m.collection_id where m.cover_asset_id = ma.id and m.status = 'published' and mc.status = 'published')
        or exists (select 1 from showcase.partners p where p.logo_asset_id = ma.id and p.status = 'published')
        or exists (select 1 from showcase.landing_sections ls join showcase.landing_page_versions lv on lv.id = ls.version_id where ls.media_asset_id = ma.id and ls.is_visible and lv.status = 'published')
      )
  )
$function$;

alter function showcase.is_media_public(uuid) owner to postgres;
revoke all on function showcase.is_media_public(uuid) from public, anon, authenticated, service_role;
grant execute on function showcase.is_media_public(uuid) to anon, authenticated, service_role;

create function showcase.enforce_private_document_asset()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_asset_id uuid;
begin
  if tg_table_name = 'media_assets' then
    v_asset_id := new.id;
  else
    v_asset_id := new.media_asset_id;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('showcase:private-document-asset:' || v_asset_id::text, 0)
  );

  if tg_table_name = 'partner_private_documents' then
    if not exists (
      select 1
      from showcase.media_assets ma
      where ma.id = new.media_asset_id
        and ma.storage_path like 'internal/partners/%'
        and not ma.is_publicly_deliverable
    ) then
      raise exception 'private-document assets must use internal/partners/ and cannot be publicly deliverable'
        using errcode = '23514';
    end if;
  elsif exists (
    select 1
    from showcase.partner_private_documents ppd
    where ppd.media_asset_id = new.id
  ) and (
    new.storage_path not like 'internal/partners/%'
    or new.is_publicly_deliverable
  ) then
    raise exception 'private-document assets must remain under internal/partners/ and cannot be publicly deliverable'
      using errcode = '23514';
  end if;

  return new;
end
$function$;

alter function showcase.enforce_private_document_asset() owner to postgres;
revoke all on function showcase.enforce_private_document_asset() from public, anon, authenticated, service_role;

create trigger enforce_private_document_asset_reference
before insert or update on showcase.partner_private_documents
for each row execute function showcase.enforce_private_document_asset();

create trigger enforce_private_document_asset_classification
before insert or update on showcase.media_assets
for each row execute function showcase.enforce_private_document_asset();
