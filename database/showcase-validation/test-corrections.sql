\set ON_ERROR_STOP on
begin;

insert into showcase.landing_page_versions(id, status) values
  ('70000000-0000-0000-0000-000000000001', 'draft'),
  ('70000000-0000-0000-0000-000000000002', 'draft');
insert into showcase.landing_sections(id, version_id, section_key, title, is_visible, sort_order) values
  ('71000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', 'hero', 'Test hero', true, 0);

set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1"}';

do $block$
declare denied boolean := false;
begin
  begin
    execute $sql$update showcase.landing_page_versions
      set status = 'published', published_at = now()
      where id = '70000000-0000-0000-0000-000000000001'$sql$;
  exception when insufficient_privilege then denied := true;
  end;
  if not denied then raise exception 'admin direct landing publication was not denied'; end if;
end
$block$;

select showcase.publish_landing_version('70000000-0000-0000-0000-000000000001');
select status = 'published' and published_by = auth.uid() as publication_ok
from showcase.landing_page_versions
where id = '70000000-0000-0000-0000-000000000001' \gset
\if :publication_ok
\else
  \echo 'FAIL validated admin publication'
  \quit
\endif

do $block$
declare denied boolean := false;
begin
  begin
    execute $sql$update showcase.landing_page_versions
      set status = 'draft', published_at = null, published_by = null
      where id = '70000000-0000-0000-0000-000000000001'$sql$;
  exception when insufficient_privilege then denied := true;
  end;
  if not denied then raise exception 'admin direct landing unpublication was not denied'; end if;
end
$block$;

do $block$
declare denied boolean := false;
begin
  begin
    insert into showcase.landing_page_versions(status, published_at)
      values ('published', now());
  exception when check_violation then denied := true;
  end;
  if not denied then raise exception 'direct published landing insert was not denied'; end if;
end
$block$;

select not showcase.is_media_public('20000000-0000-0000-0000-000000000004') as private_excluded \gset
\if :private_excluded
\else
  \echo 'FAIL private document public predicate'
  \quit
\endif

do $block$
declare denied boolean := false;
begin
  begin
    update showcase.media_assets
      set storage_path = 'projects/leaked-nda.pdf', is_publicly_deliverable = true
      where id = '20000000-0000-0000-0000-000000000004';
  exception when check_violation then denied := true;
  end;
  if not denied then raise exception 'private-document asset reclassification was not denied'; end if;
end
$block$;

insert into showcase.media_assets(
  id, storage_path, title, kind, mime_type, original_filename, byte_size,
  status, is_publicly_deliverable, published_at
) values (
  '20000000-0000-0000-0000-000000000007',
  'projects/public-document.pdf', 'Public document', 'document',
  'application/pdf', 'public-document.pdf', 1000, 'published', true, now()
);

do $block$
declare denied boolean := false;
begin
  begin
    insert into showcase.partner_private_documents(
      partner_id, media_asset_id, document_kind, title
    ) values (
      '40000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000007', 'nda', 'Invalid private reference'
    );
  exception when check_violation then denied := true;
  end;
  if not denied then raise exception 'public asset was accepted as a private document'; end if;
end
$block$;

reset role;
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3"}';
do $block$
declare denied boolean := false;
begin
  begin
    perform showcase.publish_landing_version('70000000-0000-0000-0000-000000000002');
  exception when insufficient_privilege then denied := true;
  end;
  if not denied then raise exception 'non-admin publication was not denied'; end if;
end
$block$;

reset role;
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2"}';
do $block$
declare denied boolean := false;
begin
  begin
    perform showcase.publish_landing_version('70000000-0000-0000-0000-000000000002');
  exception when insufficient_privilege then denied := true;
  end;
  if not denied then raise exception 'revoked-admin publication was not denied'; end if;
end
$block$;

reset role;
rollback;
\echo 'PASS correction security tests'
