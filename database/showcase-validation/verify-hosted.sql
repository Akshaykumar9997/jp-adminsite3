\set ON_ERROR_STOP on

with expected(version, sha256) as (values
  ('001','31c055381c8ee05c46fa44afe80b5f3f50e10a00381db8ff8ef78533e303ad04'),
  ('002','3e9d200aa62111332d20c24d79c2eb262f0df3ddfbd440a350773c3c1795d36b'),
  ('003','d36e456e96ef6b0c029d51f2e3bace42bfc4007459750abe47a6a79638d5d98b'),
  ('004','5ecfcf6e8f7eea89c5be19024f20d0917a473e1c6931bace76dc107d7001ef0c'),
  ('005','5ac37abf44e2c9d53d63c221ae3a6b5d36a045092e8960b9ca3271c28391959d'),
  ('006','4ac429b9ff04f0e876a166eab9e84d4bfbddd45fe84d3afa675141e422402ac8'),
  ('007','d4ee66ee21427e3dc19949417078af89b2cc7e3ff72d69ee08c36b2406a9c1c6')
)
select (select count(*) from showcase.schema_migrations) = 7
  and not exists (
    select version, sha256 from expected
    except
    select version, sha256 from showcase.schema_migrations
  ) as ledger_ok \gset
\if :ledger_ok
\else
  \echo 'FAIL showcase migration ledger'
  \quit 1
\endif

select data_type = 'text' as audit_identifier_ok
from information_schema.columns
where table_schema = 'showcase' and table_name = 'audit_events' and column_name = 'record_id' \gset
\if :audit_identifier_ok
\else
  \echo 'FAIL audit record identifier type'
  \quit 1
\endif

select count(*) = 19 as audit_triggers_ok
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'showcase' and not t.tgisinternal and t.tgname like 'audit_%' \gset
\if :audit_triggers_ok
\else
  \echo 'FAIL audit trigger coverage'
  \quit 1
\endif

select has_function_privilege('authenticated', 'showcase.ensure_landing_draft()', 'EXECUTE')
  and not has_function_privilege('anon', 'showcase.ensure_landing_draft()', 'EXECUTE')
  and has_function_privilege('authenticated', 'showcase.save_landing_draft(uuid,text,text,jsonb,jsonb)', 'EXECUTE')
  and not has_function_privilege('anon', 'showcase.save_landing_draft(uuid,text,text,jsonb,jsonb)', 'EXECUTE')
  as atomic_landing_rpc_ok \gset
\if :atomic_landing_rpc_ok
\else
  \echo 'FAIL atomic landing RPC grants'
  \quit 1
\endif

select count(*) = 21 and bool_and(c.relrowsecurity) as rls_ok
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'showcase' and c.relkind = 'r' \gset
\if :rls_ok
\else
  \echo 'FAIL showcase RLS/table count'
  \quit 1
\endif

select not has_table_privilege('anon','showcase.partner_private_details','select')
  and not has_table_privilege('anon','showcase.partner_private_documents','select')
  and not has_table_privilege('anon','showcase.cms_settings','select')
  and not has_table_privilege('anon','showcase.audit_events','select')
  and not has_table_privilege('anon','showcase.schema_migrations','select') as private_grants_ok \gset
\if :private_grants_ok
\else
  \echo 'FAIL anonymous private-table grant isolation'
  \quit 1
\endif

select count(*) = 4
  and bool_and(coalesce(qual, with_check) like '%showcase-media%')
  and bool_and(coalesce(qual, with_check) like '%is_admin%') as storage_policies_ok
from pg_policies
where schemaname = 'storage' and policyname like 'showcase_admins_%' \gset
\if :storage_policies_ok
\else
  \echo 'FAIL showcase Storage policies'
  \quit 1
\endif

select exists (select 1 from storage.buckets where id = 'showcase-media' and not public) as private_bucket_ok \gset
\if :private_bucket_ok
\else
  \echo 'FAIL showcase-media bucket is missing or public'
  \quit 1
\endif

select version, name, sha256, applied_at
from showcase.schema_migrations
order by version::integer;

select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'showcase' and c.relkind = 'r'
order by c.relname;

select grantee, table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'showcase'
order by table_name, grantee, privilege_type;

select policyname, schemaname, tablename, roles, cmd
from pg_policies
where schemaname in ('showcase', 'storage')
  and (schemaname = 'showcase' or policyname like 'showcase_admins_%')
order by schemaname, tablename, policyname;

select id, name, public
from storage.buckets
where id = 'showcase-media';

select count(*) as shared_supabase_migration_count
from supabase_migrations.schema_migrations;

\echo 'PASS hosted structural verification; compare shared migration count with the saved preflight baseline'
