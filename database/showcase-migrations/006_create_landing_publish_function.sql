create function showcase.enforce_landing_version_draft_insert()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if new.status <> 'draft'::showcase.content_status
     or new.published_at is not null
     or new.published_by is not null then
    raise exception 'landing versions must be inserted as unpublished drafts'
      using errcode = '23514';
  end if;
  return new;
end
$function$;

alter function showcase.enforce_landing_version_draft_insert() owner to postgres;
revoke all on function showcase.enforce_landing_version_draft_insert() from public, anon, authenticated, service_role;

create trigger enforce_landing_version_draft_insert
before insert on showcase.landing_page_versions
for each row execute function showcase.enforce_landing_version_draft_insert();

create function showcase.publish_landing_version(p_version_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if not public.is_admin() then raise exception 'not_authorized' using errcode = '42501'; end if;
  if not exists (select 1 from showcase.landing_page_versions where id = p_version_id and status = 'draft') then
    raise exception 'landing version must exist and be draft' using errcode = '23514';
  end if;
  if exists (
    select 1 from showcase.landing_featured_projects fp
    join showcase.projects p on p.id = fp.project_id
    where fp.version_id = p_version_id and p.status <> 'published'
  ) then raise exception 'featured projects must be published' using errcode = '23514'; end if;
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
  ) then raise exception 'visible landing media must be approved for public delivery' using errcode = '23514'; end if;
  update showcase.landing_page_versions set status = 'archived', updated_at = now()
    where status = 'published' and id <> p_version_id;
  update showcase.landing_page_versions
    set status = 'published', published_at = now(), published_by = auth.uid(), updated_at = now()
    where id = p_version_id;
end
$function$;
alter function showcase.publish_landing_version(uuid) owner to postgres;
revoke all on function showcase.publish_landing_version(uuid) from public, anon, authenticated, service_role;
grant execute on function showcase.publish_landing_version(uuid) to authenticated;
