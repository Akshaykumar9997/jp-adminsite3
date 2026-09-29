create policy showcase_admins_read_objects on storage.objects for select to authenticated
using (bucket_id = 'showcase-media' and (select public.is_admin()));
create policy showcase_admins_upload_objects on storage.objects for insert to authenticated
with check (bucket_id = 'showcase-media' and (select public.is_admin()) and name ~ '^(projects|works|materials|partners|landing|internal|unassigned)/');
create policy showcase_admins_replace_objects on storage.objects for update to authenticated
using (bucket_id = 'showcase-media' and (select public.is_admin()))
with check (bucket_id = 'showcase-media' and (select public.is_admin()) and name ~ '^(projects|works|materials|partners|landing|internal|unassigned)/');
create policy showcase_admins_delete_objects on storage.objects for delete to authenticated
using (bucket_id = 'showcase-media' and (select public.is_admin()));
