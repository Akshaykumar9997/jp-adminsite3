-- Preserve content and files; rooms are containers, media belongs to works.
do $$
declare definition text; original text;
begin
 select pg_get_functiondef('showcase.save_content(text,uuid,jsonb,jsonb,uuid)'::regprocedure) into original;
 definition := replace(original, 'name=case when is_custom then v_title else name end', 'name=v_title');
 definition := replace(definition, 'v_status:=coalesce(p_data->>''status'',''draft'')', 'v_status:=coalesce(p_data->>''status'',''archived'')');
 definition := replace(definition, 'if exists(select 1 from showcase.room_categories where id=v_room and name=''Other'') then', 'if false then');
 definition := replace(definition, 'if p_kind<>''partner'' then', 'if p_kind not in (''partner'',''room'') then');
 definition := replace(definition, 'if v_title is null then', 'if p_kind=''room'' and (jsonb_array_length(p_assets)>0 or p_cover is not null) then raise exception ''Room media belongs to works.'' using errcode=''23514''; end if; if v_title is null then');
 if definition=original or position('name=case when is_custom' in definition)>0 or position('Room media belongs to works.' in definition)=0 or position('if p_kind not in (''partner'',''room'') then' in definition)=0 or position('name=''Other''' in definition)>0 then raise exception 'Unexpected save_content definition; review migration'; end if;
 execute definition;
 select pg_get_functiondef('showcase.gallery_trash_guard()'::regprocedure) into definition;
 definition := replace(definition, 'new.status := ''draft'';', 'new.status := ''archived'';');
 definition := replace(definition, 'if not new.is_custom then raise exception ''Default rooms cannot be moved to Trash.'' using errcode=''23514''; end if;', '');
 if position('Default rooms cannot' in definition)>0 or position('new.status := ''draft'';' in definition)>0 then raise exception 'Unexpected Trash guard definition; review migration'; end if;
 execute definition;
end $$;

create function showcase.two_state_visibility() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if new.status='draft' then new.status:='archived'; end if;
 if tg_table_name='room_categories' then new.is_custom:=true; new.cover_asset_id:=null; end if;
 return new;
end $$;
revoke all on function showcase.two_state_visibility() from public,anon,authenticated;

do $$
declare t text;
begin
 -- The final trigger normalizes legacy client writes after existing validation.
 foreach t in array array['media_assets','room_categories','works','projects','materials','partners','material_collections','landing_page_versions'] loop
  execute format('create trigger zz_two_state_visibility before insert or update on showcase.%I for each row execute function showcase.two_state_visibility()',t);
  execute format('alter table showcase.%I alter column status set default ''archived''::showcase.content_status',t);
  -- Trash guards disallow editing already-trashed rows. Only suspend that guard
  -- inside this transaction while normalizing status; client RLS is unchanged.
  if t in ('media_assets','room_categories','works','materials','partners') then execute format('alter table showcase.%I disable trigger gallery_trash_guard',t); end if;
  execute format('update showcase.%I set status=''archived'' where status=''draft''',t);
  if t in ('media_assets','room_categories','works','materials','partners') then execute format('alter table showcase.%I enable trigger gallery_trash_guard',t); end if;
  execute format('alter table showcase.%I add constraint two_state_visibility check(status in (''published'',''archived''))',t);
 end loop;
end $$;
alter table showcase.room_categories alter column is_custom set default true;
update showcase.room_categories set is_custom=true,cover_asset_id=null where deleted_at is null;
-- Detach room-only links, never remove reusable assets or storage bytes.
delete from showcase.media_items where owner_kind='room';
create function showcase.work_only_room_media() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if new.owner_kind='room' then raise exception 'Room media belongs to works.' using errcode='23514'; end if;
 return new;
end $$;
revoke all on function showcase.work_only_room_media() from public,anon,authenticated;
create trigger work_only_room_media before insert or update on showcase.media_items for each row execute function showcase.work_only_room_media();
