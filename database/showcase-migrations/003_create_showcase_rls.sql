grant usage on schema showcase to anon, authenticated, service_role;
grant select on showcase.media_assets to service_role;

grant select on showcase.projects, showcase.room_categories, showcase.project_rooms, showcase.works,
  showcase.media_assets, showcase.project_media, showcase.project_room_media, showcase.work_media,
  showcase.material_collections, showcase.materials, showcase.work_materials,
  showcase.partners, showcase.project_partners, showcase.landing_page_versions,
  showcase.landing_sections, showcase.landing_featured_projects to anon, authenticated;

grant select, insert, update, delete on showcase.projects, showcase.room_categories,
  showcase.project_rooms, showcase.works, showcase.media_assets, showcase.project_media,
  showcase.project_room_media, showcase.work_media, showcase.material_collections,
  showcase.materials, showcase.work_materials, showcase.partners,
  showcase.partner_private_details, showcase.partner_private_documents,
  showcase.project_partners, showcase.landing_sections,
  showcase.landing_featured_projects, showcase.cms_settings to authenticated;
grant select, insert, delete on showcase.landing_page_versions to authenticated;
grant update (meta_title, meta_description, updated_at, updated_by)
  on showcase.landing_page_versions to authenticated;
grant select on showcase.audit_events to authenticated;
grant usage, select on sequence showcase.landing_page_versions_version_number_seq to authenticated;

create policy public_projects on showcase.projects for select to anon, authenticated using (status = 'published');
create policy public_room_categories on showcase.room_categories for select to anon, authenticated using (status = 'published');
create policy public_project_rooms on showcase.project_rooms for select to anon, authenticated using (exists (select 1 from showcase.projects p where p.id = project_id and p.status = 'published'));
create policy public_works on showcase.works for select to anon, authenticated using (status = 'published' and (project_id is null or exists (select 1 from showcase.projects p where p.id = project_id and p.status = 'published')));
create policy public_media_assets on showcase.media_assets for select to anon, authenticated using ((select showcase.is_media_public(id)));
create policy public_project_media on showcase.project_media for select to anon, authenticated using ((select showcase.is_media_public(media_asset_id)) and exists (select 1 from showcase.projects p where p.id = project_id and p.status = 'published'));
create policy public_project_room_media on showcase.project_room_media for select to anon, authenticated using ((select showcase.is_media_public(media_asset_id)) and exists (select 1 from showcase.project_rooms pr join showcase.projects p on p.id = pr.project_id where pr.id = project_room_id and p.status = 'published'));
create policy public_work_media on showcase.work_media for select to anon, authenticated using ((select showcase.is_media_public(media_asset_id)) and exists (select 1 from showcase.works w left join showcase.projects p on p.id = w.project_id where w.id = work_id and w.status = 'published' and (w.project_id is null or p.status = 'published')));
create policy public_material_collections on showcase.material_collections for select to anon, authenticated using (status = 'published');
create policy public_materials on showcase.materials for select to anon, authenticated using (status = 'published' and exists (select 1 from showcase.material_collections mc where mc.id = collection_id and mc.status = 'published'));
create policy public_work_materials on showcase.work_materials for select to anon, authenticated using (exists (select 1 from showcase.works w left join showcase.projects p on p.id = w.project_id where w.id = work_id and w.status = 'published' and (w.project_id is null or p.status = 'published')) and exists (select 1 from showcase.materials m join showcase.material_collections mc on mc.id = m.collection_id where m.id = material_id and m.status = 'published' and mc.status = 'published'));
create policy public_partners on showcase.partners for select to anon, authenticated using (status = 'published');
create policy public_project_partners on showcase.project_partners for select to anon, authenticated using (exists (select 1 from showcase.projects p where p.id = project_id and p.status = 'published') and exists (select 1 from showcase.partners p where p.id = partner_id and p.status = 'published'));
create policy public_landing_versions on showcase.landing_page_versions for select to anon, authenticated using (status = 'published');
create policy public_landing_sections on showcase.landing_sections for select to anon, authenticated using (is_visible and exists (select 1 from showcase.landing_page_versions lv where lv.id = version_id and lv.status = 'published'));
create policy public_landing_featured on showcase.landing_featured_projects for select to anon, authenticated using (exists (select 1 from showcase.landing_page_versions lv where lv.id = version_id and lv.status = 'published') and exists (select 1 from showcase.projects p where p.id = project_id and p.status = 'published'));

do $block$
declare t text;
begin
  foreach t in array array[
    'projects','room_categories','project_rooms','works','media_assets','project_media',
    'project_room_media','work_media','material_collections','materials','work_materials',
    'partners','partner_private_details','partner_private_documents','project_partners',
    'landing_page_versions','landing_sections','landing_featured_projects','cms_settings'
  ] loop
    execute format('create policy %I on showcase.%I for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()))', 'admins_manage_' || t, t);
  end loop;
end
$block$;
create policy admins_read_audit on showcase.audit_events for select to authenticated using ((select public.is_admin()));
