-- PROPOSAL ONLY. Apply after review/approval; never run against production as part of development.
-- Depends on the checksum-locked showcase migrations 001–007.
alter table showcase.works add column location text;
alter table showcase.room_categories add column cover_asset_id uuid references showcase.media_assets(id) on delete set null;
alter table showcase.room_categories add column is_custom boolean not null default false;
alter table showcase.materials add column tier text not null default 'mid' check (tier in ('low','mid','top'));
alter table showcase.media_assets add column processing_status text not null default 'ready' check (processing_status in ('processing','ready','failed'));
alter table showcase.media_assets add column poster_asset_id uuid references showcase.media_assets(id) on delete set null;
alter table showcase.media_assets add constraint media_no_self_poster check (poster_asset_id is distinct from id);
create index media_assets_poster_asset_idx on showcase.media_assets(poster_asset_id) where poster_asset_id is not null;
create index room_categories_cover_asset_idx on showcase.room_categories(cover_asset_id) where cover_asset_id is not null;

-- Carry forward existing showcase values without consulting unrelated business schemas.
-- Legacy parent publication checks remain until an administrator explicitly saves a standalone work.
update showcase.works w set location=p.location from showcase.projects p where p.id=w.project_id and nullif(btrim(p.location),'') is not null;
update showcase.materials m set tier=case c.range when 'low_cap' then 'low' when 'cap' then 'top' else 'mid' end from showcase.material_collections c where c.id=m.collection_id;
update showcase.room_categories set is_custom=true where name not in ('Hall','Kitchen','Bedroom','Dining','Bathroom','Balcony','Pooja Room','Other');

insert into showcase.room_categories(slug,name,status,sort_order) values
 ('hall','Hall','published',0),('kitchen','Kitchen','published',1),('bedroom','Bedroom','published',2),
 ('dining','Dining','published',3),('bathroom','Bathroom','published',4),('balcony','Balcony','published',5),
 ('pooja-room','Pooja Room','published',6),('other','Other','published',7)
on conflict (name) do nothing;
insert into showcase.material_collections(id,slug,name,range,status) values
 ('81000000-0000-4000-8000-000000000001','essentials','Low — Essentials','low_cap','published'),
 ('81000000-0000-4000-8000-000000000002','signature','Mid — Signature','mid_cap','published'),
 ('81000000-0000-4000-8000-000000000003','premium','Top — Premium','cap','published') on conflict (id) do nothing;
-- Legacy collections remain intact. Normal administrators cannot rename/create/delete tiers.
revoke insert,update,delete on showcase.material_collections from authenticated;

create table showcase.media_items (
 owner_kind text not null check (owner_kind in ('work','room','material')),
 owner_id uuid not null,
 media_asset_id uuid not null references showcase.media_assets(id) on delete restrict,
 sort_order integer not null check (sort_order >= 0),
 primary key(owner_kind,owner_id,media_asset_id),
 unique(owner_kind,owner_id,sort_order) deferrable initially immediate
);
create index media_items_asset_idx on showcase.media_items(media_asset_id);
alter table showcase.media_items enable row level security;
grant select on showcase.media_items to anon,authenticated;

insert into showcase.media_items(owner_kind,owner_id,media_asset_id,sort_order)
select 'work',work_id,media_asset_id,(row_number() over(partition by work_id order by sort_order,media_asset_id)-1)::integer from (
 select work_id,media_asset_id,sort_order from showcase.work_media
 union all select w.id,w.cover_asset_id,-1 from showcase.works w where w.cover_asset_id is not null and not exists(select 1 from showcase.work_media m where m.work_id=w.id and m.media_asset_id=w.cover_asset_id)
) existing_media;
insert into showcase.media_items(owner_kind,owner_id,media_asset_id,sort_order)
select 'material',id,cover_asset_id,0 from showcase.materials where cover_asset_id is not null;

create function showcase.owner_is_public(p_kind text,p_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select case p_kind
 when 'work' then exists(select 1 from showcase.works w join showcase.room_categories r on r.id=w.room_category_id where w.id=p_id and w.status='published' and r.status='published' and nullif(btrim(w.location),'') is not null and (w.project_id is null or exists(select 1 from showcase.projects p where p.id=w.project_id and p.status='published')))
 when 'room' then exists(select 1 from showcase.room_categories where id=p_id and status='published')
 when 'material' then exists(select 1 from showcase.materials m join showcase.material_collections c on c.id=m.collection_id where m.id=p_id and m.status='published' and c.status='published' and m.tier in ('low','mid','top'))
 else false end
$$;
revoke all on function showcase.owner_is_public(text,uuid) from public;
grant execute on function showcase.owner_is_public(text,uuid) to anon,authenticated,service_role;

create function showcase.cleanup_media_items() returns trigger language plpgsql security definer set search_path='' as $$
begin
 delete from showcase.media_items where owner_id=old.id and owner_kind=case tg_table_name when 'works' then 'work' when 'room_categories' then 'room' else 'material' end;
 return old;
end $$;
revoke all on function showcase.cleanup_media_items() from public,anon,authenticated;
create trigger cleanup_work_media_items after delete on showcase.works for each row execute function showcase.cleanup_media_items();
create trigger cleanup_room_media_items after delete on showcase.room_categories for each row execute function showcase.cleanup_media_items();
create trigger cleanup_material_media_items after delete on showcase.materials for each row execute function showcase.cleanup_media_items();

create function showcase.media_has_public_owner(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from showcase.media_items mi where mi.media_asset_id=p_id and showcase.owner_is_public(mi.owner_kind,mi.owner_id))
 or exists(select 1 from showcase.room_categories r where r.cover_asset_id=p_id and r.status='published')
 or exists(select 1 from showcase.partners p where p.logo_asset_id=p_id and p.status='published')
 or exists(select 1 from showcase.landing_sections s join showcase.landing_page_versions v on v.id=s.version_id where s.media_asset_id=p_id and s.is_visible and v.status='published')
 or exists(select 1 from showcase.projects p where p.cover_asset_id=p_id and p.status='published')
 or exists(select 1 from showcase.project_media m join showcase.projects p on p.id=m.project_id where m.media_asset_id=p_id and p.status='published')
 or exists(select 1 from showcase.project_room_media m join showcase.project_rooms r on r.id=m.project_room_id join showcase.projects p on p.id=r.project_id where m.media_asset_id=p_id and p.status='published')
 or exists(select 1 from showcase.work_media m where m.media_asset_id=p_id and showcase.owner_is_public('work',m.work_id))
 or exists(select 1 from showcase.works w where w.cover_asset_id=p_id and showcase.owner_is_public('work',w.id))
 or exists(select 1 from showcase.materials m join showcase.material_collections c on c.id=m.collection_id where m.cover_asset_id=p_id and m.status='published' and c.status='published')
$$;
revoke all on function showcase.media_has_public_owner(uuid) from public;
grant execute on function showcase.media_has_public_owner(uuid) to anon,authenticated,service_role;

create or replace function showcase.is_media_public(p_asset_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from showcase.media_assets a where a.id=p_asset_id and a.status='published' and a.processing_status='ready' and a.is_publicly_deliverable
 and a.storage_path not like 'internal/%' and a.storage_path not like 'unassigned/%'
 and not exists(select 1 from showcase.partner_private_documents d where d.media_asset_id=a.id)
 and (showcase.media_has_public_owner(a.id) or exists(select 1 from showcase.media_assets video where video.poster_asset_id=a.id and video.status='published' and video.processing_status='ready' and video.is_publicly_deliverable and video.storage_path not like 'internal/%' and video.storage_path not like 'unassigned/%' and not exists(select 1 from showcase.partner_private_documents d where d.media_asset_id=video.id) and showcase.media_has_public_owner(video.id))))
$$;
create policy public_media_items on showcase.media_items for select to anon,authenticated using(showcase.owner_is_public(owner_kind,owner_id) and showcase.is_media_public(media_asset_id));
create policy admins_read_media_items on showcase.media_items for select to authenticated using((select public.is_admin()));
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
    when 'media_items' then concat_ws(':', row_data ->> 'owner_kind', row_data ->> 'owner_id', row_data ->> 'media_asset_id')
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
create trigger audit_media_items after insert or update or delete on showcase.media_items for each row execute function showcase.write_audit_event();

create function showcase.save_content(p_kind text,p_id uuid,p_data jsonb,p_assets jsonb,p_cover uuid default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare
 v_id uuid:=coalesce(p_id,gen_random_uuid()); v_status showcase.content_status; v_room uuid; v_title text; v_location text; v_tier text; v_collection uuid; v_custom text;
begin
 if not public.is_admin() then raise exception 'not_authorized' using errcode='42501'; end if;
 if p_kind not in ('work','room','material','partner') then raise exception 'invalid content type' using errcode='22023'; end if;
 if jsonb_typeof(p_assets) <> 'array' or p_assets is null then raise exception 'media must be an array' using errcode='22023'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('showcase:content:'||v_id::text,0));
 v_title:=nullif(btrim(p_data->>'title'),''); v_status:=coalesce(p_data->>'status','draft')::showcase.content_status;
 if v_title is null then raise exception 'title required' using errcode='23514'; end if;
 if p_id is not null and not coalesce((p_data->>'create')::boolean,false) and not (case p_kind when 'work' then exists(select 1 from showcase.works where id=p_id) when 'room' then exists(select 1 from showcase.room_categories where id=p_id) when 'material' then exists(select 1 from showcase.materials where id=p_id) else exists(select 1 from showcase.partners where id=p_id) end) then raise exception 'item no longer exists' using errcode='23514'; end if;
 if (select count(*) from jsonb_array_elements_text(p_assets)) <> (select count(distinct value) from jsonb_array_elements_text(p_assets)) then raise exception 'duplicate media' using errcode='23514'; end if;
 if exists(select 1 from jsonb_array_elements_text(p_assets) ids left join showcase.media_assets a on a.id=ids.value::uuid where a.id is null or a.processing_status<>'ready' or a.storage_path like 'internal/%' or a.kind not in ('image','video','model_3d') or exists(select 1 from showcase.partner_private_documents d where d.media_asset_id=a.id)) then raise exception 'media is private or not ready' using errcode='23514'; end if;
 if p_cover is not null and not exists(select 1 from showcase.media_assets a where a.id=p_cover and a.kind='image' and a.processing_status='ready' and a.storage_path not like 'internal/%' and not exists(select 1 from showcase.partner_private_documents d where d.media_asset_id=a.id) and (p_assets @> to_jsonb(array[a.id::text]) or (p_kind='room' and exists(select 1 from showcase.media_items mi join showcase.works w on w.id=mi.owner_id where mi.owner_kind='work' and w.room_category_id=v_id and mi.media_asset_id=a.id)))) then raise exception 'cover must be an image from this collection' using errcode='23514'; end if;
 if p_kind='work' then
  v_location:=nullif(btrim(p_data->>'location'),''); v_room:=(p_data->>'room_category_id')::uuid;
  if v_location is null then raise exception 'location required' using errcode='23514'; end if;
  if v_room is null or not exists(select 1 from showcase.room_categories where id=v_room) then raise exception 'room required' using errcode='23514'; end if;
  if exists(select 1 from showcase.room_categories where id=v_room and name='Other') then
   v_custom:=nullif(btrim(p_data->>'custom_room_name'),'');
   if v_custom is null then raise exception 'custom room name required' using errcode='23514'; end if;
   select id into v_room from showcase.room_categories where lower(name)=lower(v_custom);
   if v_room is null then insert into showcase.room_categories(name,slug,is_custom,status,created_by,updated_by) values(v_custom,'custom-'||gen_random_uuid()::text,true,case when v_status='published' then 'published'::showcase.content_status else 'draft'::showcase.content_status end,auth.uid(),auth.uid()) returning id into v_room; end if;
  end if;
  if v_status='published' and not exists(select 1 from showcase.room_categories where id=v_room and status='published') then raise exception 'publish the selected room before publishing this work' using errcode='23514'; end if;
  insert into showcase.works(id,title,location,room_category_id,status,published_at,cover_asset_id,created_by,updated_by)
  values(v_id,v_title,v_location,v_room,v_status,case when v_status='published' then now() end,p_cover,auth.uid(),auth.uid())
  on conflict(id) do update set title=excluded.title,location=excluded.location,room_category_id=excluded.room_category_id,status=excluded.status,published_at=excluded.published_at,cover_asset_id=excluded.cover_asset_id,project_id=null,project_room_id=null,updated_at=now(),updated_by=auth.uid();
 elsif p_kind='room' then
  if not exists(select 1 from showcase.room_categories where id=v_id) then insert into showcase.room_categories(id,name,slug,is_custom,status,cover_asset_id,created_by,updated_by) values(v_id,v_title,'custom-'||v_id::text,true,v_status,p_cover,auth.uid(),auth.uid());
  else update showcase.room_categories set name=case when is_custom then v_title else name end,status=v_status,cover_asset_id=p_cover,updated_at=now(),updated_by=auth.uid() where id=v_id; end if;
 elsif p_kind='material' then
  v_tier:=p_data->>'tier'; v_collection:=case v_tier when 'low' then '81000000-0000-4000-8000-000000000001'::uuid when 'mid' then '81000000-0000-4000-8000-000000000002'::uuid when 'top' then '81000000-0000-4000-8000-000000000003'::uuid end;
  if v_collection is null then raise exception 'invalid material tier' using errcode='23514'; end if;
  insert into showcase.materials(id,name,code,category,collection_id,tier,status,published_at,cover_asset_id,created_by,updated_by) values(v_id,v_title,'material-'||v_id::text,v_tier,v_collection,v_tier,v_status,case when v_status='published' then now() end,p_cover,auth.uid(),auth.uid()) on conflict(id) do update set name=excluded.name,collection_id=excluded.collection_id,tier=excluded.tier,status=excluded.status,published_at=excluded.published_at,cover_asset_id=excluded.cover_asset_id,updated_at=now(),updated_by=auth.uid();
 else
  if v_status='published' and p_cover is null then raise exception 'partner logo required for publishing' using errcode='23514'; end if;
  insert into showcase.partners(id,name,status,published_at,logo_asset_id,created_by,updated_by) values(v_id,v_title,v_status,case when v_status='published' then now() end,p_cover,auth.uid(),auth.uid()) on conflict(id) do update set name=excluded.name,status=excluded.status,published_at=excluded.published_at,logo_asset_id=excluded.logo_asset_id,updated_at=now(),updated_by=auth.uid();
 end if;
 if p_kind<>'partner' then
  if p_kind='work' then delete from showcase.work_media where work_id=v_id; end if;
  delete from showcase.media_items where owner_kind=p_kind and owner_id=v_id;
  insert into showcase.media_items(owner_kind,owner_id,media_asset_id,sort_order) select p_kind,v_id,value::uuid,ordinality::integer-1 from jsonb_array_elements_text(p_assets) with ordinality;
 end if;
 -- Paths are generated by the application and checked by Storage RLS; never elevate browser paths.
 if v_status='published' and exists(select 1 from showcase.media_assets a where (p_assets @> to_jsonb(array[a.id::text]) or a.id=p_cover) and a.storage_path like 'unassigned/%') then raise exception 'unassigned media cannot be published' using errcode='23514'; end if;
 update showcase.media_assets set status='published',is_publicly_deliverable=true,published_at=coalesce(published_at,now()),updated_by=auth.uid(),updated_at=now() where v_status='published' and (p_assets @> to_jsonb(array[id::text]) or id=p_cover or id in(select poster_asset_id from showcase.media_assets where p_assets @> to_jsonb(array[id::text])));
 return v_id;
end $$;
revoke all on function showcase.save_content(text,uuid,jsonb,jsonb,uuid) from public,anon,service_role;
grant execute on function showcase.save_content(text,uuid,jsonb,jsonb,uuid) to authenticated;

create function showcase.reorder_media(p_kind text,p_owner uuid,p_assets jsonb) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_admin() then raise exception 'not_authorized' using errcode='42501'; end if;
 if p_assets is null or jsonb_typeof(p_assets)<>'array' then raise exception 'invalid media order' using errcode='22023'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('showcase:content:'||p_owner::text,0));
 if (select count(*) from showcase.media_items where owner_kind=p_kind and owner_id=p_owner)<>(select count(*) from jsonb_array_elements_text(p_assets)) or exists(select 1 from jsonb_array_elements_text(p_assets) i where not exists(select 1 from showcase.media_items m where m.owner_kind=p_kind and m.owner_id=p_owner and m.media_asset_id=i.value::uuid)) or (select count(*) from jsonb_array_elements_text(p_assets))<>(select count(distinct value) from jsonb_array_elements_text(p_assets)) then raise exception 'collection changed; reload before reordering' using errcode='23514'; end if;
 set constraints showcase.media_items_owner_kind_owner_id_sort_order_key deferred;
 update showcase.media_items m set sort_order=i.ordinality::integer-1 from jsonb_array_elements_text(p_assets) with ordinality i where m.owner_kind=p_kind and m.owner_id=p_owner and m.media_asset_id=i.value::uuid;
end $$;
revoke all on function showcase.reorder_media(text,uuid,jsonb) from public,anon,service_role;
grant execute on function showcase.reorder_media(text,uuid,jsonb) to authenticated;

drop policy public_works on showcase.works;
create policy public_works on showcase.works for select to anon,authenticated using(showcase.owner_is_public('work',id));
drop policy public_materials on showcase.materials;
create policy public_materials on showcase.materials for select to anon,authenticated using(showcase.owner_is_public('material',id));

drop policy public_work_media on showcase.work_media;
create policy public_work_media on showcase.work_media for select to anon,authenticated using(showcase.owner_is_public('work',work_id) and showcase.is_media_public(media_asset_id));
drop policy public_work_materials on showcase.work_materials;
create policy public_work_materials on showcase.work_materials for select to anon,authenticated using(showcase.owner_is_public('work',work_id) and showcase.owner_is_public('material',material_id));

create function showcase.publish_homepage(p_version_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_admin() then raise exception 'not_authorized' using errcode='42501'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('showcase:landing-publish',0));
 if not exists(select 1 from showcase.landing_page_versions where id=p_version_id and status='draft' for update) then raise exception 'landing version must be draft' using errcode='23514'; end if;
 if exists(select 1 from showcase.landing_sections s where s.version_id=p_version_id and s.is_visible and s.section_key in ('hero','categories','partners') and nullif(btrim(s.content->>'heading'),'') is null) then raise exception 'visible sections require headings' using errcode='23514'; end if;
 if exists(select 1 from showcase.landing_sections s left join showcase.media_assets a on a.id=s.media_asset_id where s.version_id=p_version_id and s.is_visible and ((s.section_key='hero' and (a.id is null or a.kind<>'image')) or (a.id is not null and (a.processing_status<>'ready' or a.storage_path like 'internal/%' or a.storage_path like 'unassigned/%' or exists(select 1 from showcase.partner_private_documents d where d.media_asset_id=a.id))))) then raise exception 'visible homepage media is invalid or not ready' using errcode='23514'; end if;
 update showcase.media_assets a set status='published',is_publicly_deliverable=true,published_at=coalesce(a.published_at,now()),updated_at=now(),updated_by=auth.uid() where exists(select 1 from showcase.landing_sections s where s.version_id=p_version_id and s.is_visible and s.media_asset_id=a.id);
 perform showcase.publish_landing_version(p_version_id);
end $$;
revoke all on function showcase.publish_homepage(uuid) from public,anon,service_role;
grant execute on function showcase.publish_homepage(uuid) to authenticated;

create function showcase.set_video_poster(p_video uuid,p_poster uuid) returns void language plpgsql security definer set search_path='' as $$
declare v_status showcase.content_status;
begin
 if not public.is_admin() then raise exception 'not_authorized' using errcode='42501'; end if;
 select status into v_status from showcase.media_assets where id=p_video and kind='video' for update;
 if v_status is null then raise exception 'video not found' using errcode='23514'; end if;
 if p_poster is not null and not exists(select 1 from showcase.media_assets a where a.id=p_poster and a.kind='image' and a.processing_status='ready' and a.storage_path not like 'internal/%' and a.storage_path not like 'unassigned/%' and not exists(select 1 from showcase.partner_private_documents d where d.media_asset_id=a.id)) then raise exception 'invalid video cover' using errcode='23514'; end if;
 update showcase.media_assets set poster_asset_id=p_poster,updated_at=now(),updated_by=auth.uid() where id=p_video;
 update showcase.media_assets set status='published',published_at=coalesce(published_at,now()),is_publicly_deliverable=true,updated_at=now(),updated_by=auth.uid() where id=p_poster and v_status='published';
end $$;
revoke all on function showcase.set_video_poster(uuid,uuid) from public,anon,service_role;
grant execute on function showcase.set_video_poster(uuid,uuid) to authenticated;
