\set ON_ERROR_STOP on
begin;

set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select count(*) = 1 as ok from showcase.projects where id::text like '10000000-%' \gset
\if :ok
\else
  \echo 'FAIL anon projects'
  \quit
\endif
select count(*) = 1 as ok from showcase.media_assets where id::text like '20000000-%' \gset
\if :ok
\else
  \echo 'FAIL anon media'
  \quit
\endif
select count(*) = 1 as ok from showcase.project_media where project_id::text like '10000000-%' \gset
\if :ok
\else
  \echo 'FAIL anon associations'
  \quit
\endif
select not has_table_privilege('anon','showcase.partner_private_details','select') as ok \gset
\if :ok
\else
  \echo 'FAIL anon private grant'
  \quit
\endif
reset role;

set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3"}';
select count(*) = 1 as ok from showcase.projects where id::text like '10000000-%' \gset
\if :ok
\else
  \echo 'FAIL nonadmin projects'
  \quit
\endif
select count(*) = 1 as ok from showcase.media_assets where id::text like '20000000-%' \gset
\if :ok
\else
  \echo 'FAIL nonadmin media'
  \quit
\endif
select count(*) = 0 as ok from showcase.partner_private_details \gset
\if :ok
\else
  \echo 'FAIL nonadmin private details'
  \quit
\endif
select count(*) = 0 as ok from showcase.partner_private_documents \gset
\if :ok
\else
  \echo 'FAIL nonadmin private documents'
  \quit
\endif
reset role;

set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1"}';
select public.is_admin() and count(*) = 3 as ok from showcase.projects where id::text like '10000000-%' \gset
\if :ok
\else
  \echo 'FAIL active admin projects'
  \quit
\endif
select count(*) = 6 as ok from showcase.media_assets where id::text like '20000000-%' \gset
\if :ok
\else
  \echo 'FAIL active admin media'
  \quit
\endif
select count(*) = 1 as ok from showcase.partner_private_details \gset
\if :ok
\else
  \echo 'FAIL active admin private details'
  \quit
\endif
select count(*) = 1 as ok from showcase.partner_private_documents \gset
\if :ok
\else
  \echo 'FAIL active admin private documents'
  \quit
\endif
select count(*) = 2 as ok from storage.objects where bucket_id='showcase-media' \gset
\if :ok
\else
  \echo 'FAIL active admin storage'
  \quit
\endif
reset role;

set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2"}';
select not public.is_admin() and count(*) = 1 as ok from showcase.projects where id::text like '10000000-%' \gset
\if :ok
\else
  \echo 'FAIL revoked admin projects'
  \quit
\endif
select count(*) = 0 as ok from showcase.partner_private_details \gset
\if :ok
\else
  \echo 'FAIL revoked admin private details'
  \quit
\endif
select count(*) = 0 as ok from storage.objects where bucket_id='showcase-media' \gset
\if :ok
\else
  \echo 'FAIL revoked admin storage'
  \quit
\endif
reset role;

rollback;
\echo 'PASS rls matrix and private media isolation'
