\set ON_ERROR_STOP on
begin;
select pg_try_advisory_xact_lock(hashtextextended('jp-adminsite:showcase-migrations', 0)) as lock_ok \gset
\if :lock_ok
\else
  rollback;
  do $$ begin raise exception 'showcase migration advisory lock is held'; end $$;
\endif
select to_regclass('showcase.schema_migrations') is not null as ledger_exists \gset
\if :ledger_exists
\else
  rollback;
  do $$ begin raise exception 'showcase migration ledger is missing'; end $$;
\endif
select exists(select 1 from showcase.schema_migrations where version=:'migration_version' and sha256=:'migration_sha256') as same \gset
\if :same
  rollback;
  \quit
\endif
select exists(select 1 from showcase.schema_migrations where version=:'migration_version') as version_exists \gset
\if :version_exists
  rollback;
  do $$ begin raise exception 'migration checksum mismatch'; end $$;
\endif
select not exists (
  select 1 from showcase.schema_migrations where version !~ '^[0-9]+$'
) as ledger_versions_are_numeric \gset
\if :ledger_versions_are_numeric
\else
  rollback;
  do $$ begin raise exception 'showcase migration ledger contains a non-numeric version'; end $$;
\endif
select :'migration_version' ~ '^[0-9]+$'
  and :'previous_version' ~ '^[0-9]+$'
  and (:'migration_version')::numeric = (:'previous_version')::numeric + 1
  as input_versions_are_sequential \gset
\if :input_versions_are_sequential
\else
  rollback;
  do $$ begin raise exception 'showcase migration versions must be numeric and sequential'; end $$;
\endif
select coalesce(max(version::numeric), 0) = (:'previous_version')::numeric as ordering_ok
from showcase.schema_migrations \gset
\if :ordering_ok
\else
  rollback;
  do $$ begin raise exception 'showcase migration ordering violation'; end $$;
\endif
\ir :migration_file
insert into showcase.schema_migrations(version,name,sha256) values (:'migration_version',:'migration_name',:'migration_sha256');
commit;
