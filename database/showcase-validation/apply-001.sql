\set ON_ERROR_STOP on
begin;
select pg_try_advisory_xact_lock(hashtextextended('jp-adminsite:showcase-migrations', 0)) as lock_ok \gset
\if :lock_ok
\else
  rollback;
  do $$ begin raise exception 'showcase migration advisory lock is held'; end $$;
\endif
select to_regnamespace('showcase') is null as clean_install \gset
\if :clean_install
  \ir ../showcase-migrations/001_create_showcase_schema.sql
  insert into showcase.schema_migrations(version,name,sha256) values ('001','create_showcase_schema',:'migration_sha256');
  commit;
\else
  select to_regclass('showcase.schema_migrations') is not null as ledger_exists \gset
  \if :ledger_exists
    select exists(select 1 from showcase.schema_migrations where version='001' and sha256=:'migration_sha256') as same \gset
    \if :same
      rollback;
      \quit
    \else
      rollback;
      do $$ begin raise exception 'migration 001 checksum mismatch'; end $$;
    \endif
  \else
    rollback;
    do $$ begin raise exception 'unexpected showcase schema without migration ledger'; end $$;
  \endif
\endif
