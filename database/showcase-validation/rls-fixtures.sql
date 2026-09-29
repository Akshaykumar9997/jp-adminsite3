\set ON_ERROR_STOP on
insert into identity.profiles(id,role,access_revoked_at) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1','admin',null),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2','admin',now()),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3','user',null);

insert into showcase.room_categories(id,slug,name,status) values
  ('30000000-0000-0000-0000-000000000001','living','Living','published');
insert into showcase.projects(id,slug,title,status,published_at) values
  ('10000000-0000-0000-0000-000000000001','public-project','Public','published',now()),
  ('10000000-0000-0000-0000-000000000002','draft-project','Draft','draft',null),
  ('10000000-0000-0000-0000-000000000003','archived-project','Archived','archived',null);
insert into showcase.media_assets(id,storage_path,title,kind,mime_type,original_filename,byte_size,status,is_publicly_deliverable,published_at) values
  ('20000000-0000-0000-0000-000000000001','projects/10000000-0000-0000-0000-000000000001/20000000-0000-0000-0000-000000000001/public.webp','Public','image','image/webp','public.webp',1000,'published',true,now()),
  ('20000000-0000-0000-0000-000000000002','projects/10000000-0000-0000-0000-000000000002/20000000-0000-0000-0000-000000000002/draft-parent.webp','Draft parent','image','image/webp','draft-parent.webp',1000,'published',true,now()),
  ('20000000-0000-0000-0000-000000000003','unassigned/20000000-0000-0000-0000-000000000003/unassociated.webp','Unassociated','image','image/webp','unassociated.webp',1000,'published',true,now()),
  ('20000000-0000-0000-0000-000000000004','internal/partners/40000000-0000-0000-0000-000000000001/nda.pdf','NDA','document','application/pdf','nda.pdf',1000,'published',false,now()),
  ('20000000-0000-0000-0000-000000000005','projects/10000000-0000-0000-0000-000000000001/20000000-0000-0000-0000-000000000005/draft.webp','Draft media','image','image/webp','draft.webp',1000,'draft',true,null),
  ('20000000-0000-0000-0000-000000000006','projects/10000000-0000-0000-0000-000000000003/20000000-0000-0000-0000-000000000006/archived.webp','Archived media','image','image/webp','archived.webp',1000,'archived',true,null);
insert into showcase.project_media(project_id,media_asset_id,role,sort_order) values
  ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','gallery',1),
  ('10000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002','gallery',1),
  ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000005','gallery',2),
  ('10000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000006','gallery',1);
insert into showcase.partners(id,name,status,published_at,logo_asset_id) values
  ('40000000-0000-0000-0000-000000000001','Public Partner','published',now(),null);
insert into showcase.partner_private_details(partner_id,email,internal_notes) values
  ('40000000-0000-0000-0000-000000000001','private@example.test','secret');
insert into showcase.partner_private_documents(id,partner_id,media_asset_id,document_kind,title) values
  ('50000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000004','nda','Private NDA');
insert into storage.objects(id,bucket_id,name) values
  ('60000000-0000-0000-0000-000000000001','showcase-media','projects/public.webp'),
  ('60000000-0000-0000-0000-000000000002','showcase-media','internal/partners/nda.pdf');
