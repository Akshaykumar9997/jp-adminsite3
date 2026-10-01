-- Gallery trash. Apply after the existing room-first CMS migrations.
alter table showcase.media_assets add column deleted_at timestamptz;
alter table showcase.room_categories add column deleted_at timestamptz;
alter table showcase.works add column deleted_at timestamptz;
alter table showcase.materials add column deleted_at timestamptz;
alter table showcase.partners add column deleted_at timestamptz;

-- Existing admin RLS remains authoritative. Restrictive policies additionally hide
-- trash from public readers even if a stale client attempts to republish a record.
do $$
declare t text;
begin
 foreach t in array array['media_assets','room_categories','works','materials','partners'] loop
  execute format('create policy hide_trash_anon on showcase.%I as restrictive for select to anon using (deleted_at is null)',t);
  execute format('create policy hide_trash_admin on showcase.%I as restrictive for select to authenticated using (deleted_at is null or (select public.is_admin()))',t);
  execute format('create index %I on showcase.%I(deleted_at) where deleted_at is not null',t||'_trash_idx',t);
 end loop;
end $$;

create function showcase.gallery_trash_guard() returns trigger
language plpgsql security invoker set search_path='' as $$
declare asset_id uuid; asset_deleted timestamptz;
begin
 if tg_op='DELETE' then
  if current_user='authenticated' and old.deleted_at is null then
   raise exception 'Move this item to Trash before permanently deleting it.' using errcode='23514';
  end if;
  return old;
 end if;
 if tg_op='UPDATE' and old.deleted_at is not null and new.deleted_at is not null then
  if to_jsonb(new)-array['updated_at','updated_by'] is distinct from to_jsonb(old)-array['updated_at','updated_by'] then
   raise exception 'Restore this item from Trash before editing it.' using errcode='23514';
  end if;
 end if;
 if tg_op='UPDATE' and old.deleted_at is not null and new.deleted_at is null then
  new.status := 'draft';
  if tg_table_name<>'room_categories' then new.published_at := null; end if;
  if tg_table_name='media_assets' then new.is_publicly_deliverable := false; end if;
 end if;
 if new.deleted_at is not null then
  new.status := 'draft';
  if tg_table_name<>'room_categories' then new.published_at := null; end if;
  if tg_table_name='media_assets' then
   new.is_publicly_deliverable := false;
   if exists(select 1 from showcase.media_items where media_asset_id=new.id)
    or exists(select 1 from showcase.work_media where media_asset_id=new.id)
    or exists(select 1 from showcase.project_media where media_asset_id=new.id)
    or exists(select 1 from showcase.project_room_media where media_asset_id=new.id)
    or exists(select 1 from showcase.partner_private_documents where media_asset_id=new.id)
    or exists(select 1 from showcase.landing_sections where media_asset_id=new.id)
    or exists(select 1 from showcase.projects where cover_asset_id=new.id)
    or exists(select 1 from showcase.works where cover_asset_id=new.id)
    or exists(select 1 from showcase.room_categories where cover_asset_id=new.id)
    or exists(select 1 from showcase.materials where cover_asset_id=new.id)
    or exists(select 1 from showcase.partners where logo_asset_id=new.id)
    or exists(select 1 from showcase.media_assets where poster_asset_id=new.id)
   then raise exception 'This file is still in use. Remove its associations before moving it to Trash.' using errcode='23503'; end if;
  elsif tg_table_name='room_categories' then
   if not new.is_custom then raise exception 'Default rooms cannot be moved to Trash.' using errcode='23514'; end if;
   if exists(select 1 from showcase.works where room_category_id=new.id and deleted_at is null)
    or exists(select 1 from showcase.project_rooms where room_category_id=new.id)
   then raise exception 'This room still contains works. Move or trash those works first.' using errcode='23503'; end if;
  end if;
 elsif tg_table_name='works' then
  select deleted_at into asset_deleted from showcase.room_categories where id=new.room_category_id for share;
  if asset_deleted is not null then
   raise exception 'Restore the room before restoring or saving this work.' using errcode='23514';
  end if;
 end if;
 if new.deleted_at is null then
  asset_id := case when tg_table_name='partners' then (to_jsonb(new)->>'logo_asset_id')::uuid
                  when tg_table_name='media_assets' then (to_jsonb(new)->>'poster_asset_id')::uuid
                  else (to_jsonb(new)->>'cover_asset_id')::uuid end;
  if asset_id is not null then
   select deleted_at into asset_deleted from showcase.media_assets where id=asset_id for share;
   if asset_deleted is not null then raise exception 'Restore the selected file from Trash before using it.' using errcode='23514'; end if;
  end if;
 end if;
 return new;
end $$;
revoke all on function showcase.gallery_trash_guard() from public,anon,authenticated;
do $$
declare t text;
begin
 foreach t in array array['media_assets','room_categories','works','materials','partners'] loop
  execute format('create trigger gallery_trash_guard before insert or update or delete on showcase.%I for each row execute function showcase.gallery_trash_guard()',t);
 end loop;
end $$;

create function showcase.gallery_media_guard() returns trigger
language plpgsql security invoker set search_path='' as $$
declare d timestamptz;
begin
 select deleted_at into d from showcase.media_assets
 where id=coalesce((to_jsonb(new)->>'media_asset_id')::uuid,(to_jsonb(new)->>'cover_asset_id')::uuid) for share;
 if d is not null then raise exception 'Restore the selected file from Trash before using it.' using errcode='23514'; end if;
 return new;
end $$;
revoke all on function showcase.gallery_media_guard() from public,anon,authenticated;
create trigger gallery_media_guard before insert or update on showcase.media_items for each row execute function showcase.gallery_media_guard();
create trigger gallery_work_media_guard before insert or update on showcase.work_media for each row execute function showcase.gallery_media_guard();
create trigger gallery_project_media_guard before insert or update on showcase.project_media for each row execute function showcase.gallery_media_guard();
create trigger gallery_project_room_media_guard before insert or update on showcase.project_room_media for each row execute function showcase.gallery_media_guard();
create trigger gallery_document_media_guard before insert or update on showcase.partner_private_documents for each row execute function showcase.gallery_media_guard();
create trigger gallery_landing_media_guard before insert or update on showcase.landing_sections for each row execute function showcase.gallery_media_guard();
create trigger gallery_project_cover_guard before insert or update on showcase.projects for each row execute function showcase.gallery_media_guard();

create or replace function showcase.owner_is_public(p_kind text,p_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select case p_kind
 when 'work' then exists(select 1 from showcase.works w join showcase.room_categories r on r.id=w.room_category_id where w.id=p_id and w.deleted_at is null and r.deleted_at is null and w.status='published' and r.status='published' and nullif(btrim(w.location),'') is not null and (w.project_id is null or exists(select 1 from showcase.projects p where p.id=w.project_id and p.status='published')))
 when 'room' then exists(select 1 from showcase.room_categories where id=p_id and deleted_at is null and status='published')
 when 'material' then exists(select 1 from showcase.materials m join showcase.material_collections c on c.id=m.collection_id where m.id=p_id and m.deleted_at is null and m.status='published' and c.status='published' and m.tier in ('low','mid','top'))
 else false end
$$;
create or replace function showcase.reorder_works(p_room uuid,p_ids uuid[]) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not public.is_admin() then raise exception 'not_authorized' using errcode='42501'; end if;
 if p_room is null or p_ids is null or not exists(select 1 from showcase.room_categories where id=p_room) then raise exception 'invalid gallery order' using errcode='22023'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('showcase:room-order:'||p_room::text,0));
 perform 1 from showcase.works where deleted_at is null and room_category_id=p_room for update;
 if (select count(*) from showcase.works where deleted_at is null and room_category_id=p_room)<>cardinality(p_ids)
 or (select count(distinct id) from unnest(p_ids) id)<>cardinality(p_ids)
 or exists(select 1 from unnest(p_ids) id where not exists(select 1 from showcase.works w where w.deleted_at is null and w.id=id and w.room_category_id=p_room)) then
  raise exception 'gallery changed; reload before reordering' using errcode='23514';
 end if;
 update showcase.works w set sort_order=ordered.position::integer-1,updated_at=now(),updated_by=auth.uid()
 from unnest(p_ids) with ordinality ordered(id,position) where w.deleted_at is null and w.id=ordered.id and w.room_category_id=p_room;
end $$;
create or replace function showcase.reorder_rooms(p_ids uuid[]) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not public.is_admin() then raise exception 'not_authorized' using errcode='42501'; end if;
 if p_ids is null then raise exception 'invalid room order' using errcode='22023'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('showcase:room-order',0));
 perform 1 from showcase.room_categories where deleted_at is null order by id for update;
 if (select count(*) from showcase.room_categories where deleted_at is null)<>cardinality(p_ids)
 or (select count(distinct id) from unnest(p_ids) id)<>cardinality(p_ids)
 or exists(select 1 from unnest(p_ids) id where not exists(select 1 from showcase.room_categories r where r.deleted_at is null and r.id=id)) then
  raise exception 'gallery changed; reload before reordering' using errcode='23514';
 end if;
 update showcase.room_categories r set sort_order=ordered.position::integer-1,updated_at=now(),updated_by=auth.uid()
 from unnest(p_ids) with ordinality ordered(id,position) where r.deleted_at is null and r.id=ordered.id;
end $$;
create or replace function showcase.is_media_public(p_asset_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from showcase.media_assets a where a.id=p_asset_id and a.deleted_at is null and a.status='published' and a.processing_status='ready' and a.is_publicly_deliverable
 and a.storage_path not like 'internal/%' and a.storage_path not like 'unassigned/%'
 and not exists(select 1 from showcase.partner_private_documents d where d.media_asset_id=a.id)
 and (showcase.media_has_public_owner(a.id) or exists(select 1 from showcase.media_assets video where video.poster_asset_id=a.id and video.deleted_at is null and video.status='published' and video.processing_status='ready' and video.is_publicly_deliverable and video.storage_path not like 'internal/%' and video.storage_path not like 'unassigned/%' and not exists(select 1 from showcase.partner_private_documents d where d.media_asset_id=video.id) and showcase.media_has_public_owner(video.id))))
$$;
