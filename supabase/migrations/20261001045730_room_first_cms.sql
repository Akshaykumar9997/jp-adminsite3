-- Room-first CMS. Retire copy/settings editing without destroying content or audit history.
revoke all on function showcase.ensure_landing_draft() from public, anon, authenticated;
revoke all on function showcase.save_landing_draft(uuid,text,text,jsonb,jsonb) from public, anon, authenticated;
revoke all on function showcase.publish_landing_version(uuid) from public, anon, authenticated;
revoke all on function showcase.publish_homepage(uuid) from public, anon, authenticated;
revoke insert,update,delete on showcase.cms_settings,showcase.landing_page_versions,showcase.landing_sections,showcase.landing_featured_projects from anon,authenticated;

create function showcase.reorder_works(p_room uuid,p_ids uuid[]) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not public.is_admin() then raise exception 'not_authorized' using errcode='42501'; end if;
 if p_room is null or p_ids is null or not exists(select 1 from showcase.room_categories where id=p_room) then raise exception 'invalid gallery order' using errcode='22023'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('showcase:room-order:'||p_room::text,0));
 perform 1 from showcase.works where room_category_id=p_room for update;
 if (select count(*) from showcase.works where room_category_id=p_room)<>cardinality(p_ids)
 or (select count(distinct id) from unnest(p_ids) id)<>cardinality(p_ids)
 or exists(select 1 from unnest(p_ids) id where not exists(select 1 from showcase.works w where w.id=id and w.room_category_id=p_room)) then
  raise exception 'gallery changed; reload before reordering' using errcode='23514';
 end if;
 update showcase.works w set sort_order=ordered.position::integer-1,updated_at=now(),updated_by=auth.uid()
 from unnest(p_ids) with ordinality ordered(id,position) where w.id=ordered.id and w.room_category_id=p_room;
end $$;
revoke all on function showcase.reorder_works(uuid,uuid[]) from public,anon,service_role;
grant execute on function showcase.reorder_works(uuid,uuid[]) to authenticated;

create function showcase.append_room_work() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' or new.room_category_id is distinct from old.room_category_id then
  -- Avoid lock-order inversion with save_content's per-content lock. Concurrent
  -- inserts may share a position; the gallery's stable id tie-breaker resolves it.
  select coalesce(max(sort_order)+1,0) into new.sort_order from showcase.works where room_category_id=new.room_category_id and id<>new.id;
 end if;
 return new;
end $$;
revoke all on function showcase.append_room_work() from public,anon,authenticated,service_role;
create trigger append_room_work before insert or update of room_category_id on showcase.works for each row execute function showcase.append_room_work();

create function showcase.reorder_rooms(p_ids uuid[]) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not public.is_admin() then raise exception 'not_authorized' using errcode='42501'; end if;
 if p_ids is null then raise exception 'invalid room order' using errcode='22023'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('showcase:room-order',0));
 perform 1 from showcase.room_categories order by id for update;
 if (select count(*) from showcase.room_categories)<>cardinality(p_ids)
 or (select count(distinct id) from unnest(p_ids) id)<>cardinality(p_ids)
 or exists(select 1 from unnest(p_ids) id where not exists(select 1 from showcase.room_categories r where r.id=id)) then
  raise exception 'gallery changed; reload before reordering' using errcode='23514';
 end if;
 update showcase.room_categories r set sort_order=ordered.position::integer-1,updated_at=now(),updated_by=auth.uid()
 from unnest(p_ids) with ordinality ordered(id,position) where r.id=ordered.id;
end $$;
revoke all on function showcase.reorder_rooms(uuid[]) from public,anon,service_role;
grant execute on function showcase.reorder_rooms(uuid[]) to authenticated;
