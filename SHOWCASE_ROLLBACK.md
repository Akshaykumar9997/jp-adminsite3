# Showcase deployment recovery

The migration runner applies one migration per PostgreSQL transaction. A failing migration is rolled back automatically and later migrations are not attempted. Re-run only after fixing the cause and confirming the existing `showcase.schema_migrations` rows still form the exact checksum-matching prefix.

Before production execution, take and verify a project backup and record the shared Supabase migration ledger, `public.is_admin()` definition/ACL, existing Storage policies, bucket list, exposed schemas, and Auth configuration.

Do not delete rows from `showcase.schema_migrations`, edit Supabase's platform migration ledger, drop the `showcase` schema, or weaken RLS as an automated rollback. Once the CMS contains production data, database rollback is either:

1. a reviewed forward corrective migration, preferred; or
2. a project restore from the verified pre-deployment backup, requiring explicit approval and coordinated downtime.

Configuration recovery is performed independently:

- Edge Function: redeploy the previously recorded function version or remove the new deployment.
- Data API: remove only `showcase` from exposed schemas if the deployment is abandoned.
- Storage: keep a non-empty private bucket. Delete an empty `showcase-media` bucket only after confirming no application data references it.
- Secrets: restore the previous `SHOWCASE_ALLOWED_ORIGINS` value; never print or copy service-role secrets into the repository.

On any verification failure, stop writes, preserve logs and state, and diagnose before attempting recovery.
