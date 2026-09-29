# Showcase backend operations

Target: existing Supabase project `xssjgzzhcudktrkruitb` (`JpInteriorsApp`). The showcase uses only the separate `showcase` schema, the private `showcase-media` bucket, and the `public-showcase-media` Edge Function. It does not use Supabase CLI migration history.

## Local checks

```powershell
npm test
npm run test:database
npm run test:edge
npm run typecheck
npm run build
powershell -File database/run-showcase-migrations.ps1
```

The last command is plan-only unless `-Apply` is supplied. It verifies the fixed reviewed checksums before doing anything.

## Production stage 1 — reviewed database changes

Before execution, confirm the target project ref is `xssjgzzhcudktrkruitb`. The exact changes are the seven checksum-locked SQL files under `database/showcase-migrations`, in numeric order. Migrations 001–006 are the reviewed baseline. Migration 007 adds atomic landing draft saving, serialized validated publishing, complete association auditing, and stable text audit identifiers. The package creates only the `showcase` schema and its ledger, plus four policies scoped to `storage.objects.bucket_id = 'showcase-media'`.

Security impact: anonymous and ordinary authenticated users receive published public reads only; management and all private partner data require the existing `public.is_admin()`. The shared `supabase_migrations.schema_migrations` ledger is not used.

Run with a temporary direct PostgreSQL connection string kept outside the repository:

```powershell
$env:SHOWCASE_DATABASE_URL = '<temporary direct connection string>'
powershell -File database/run-showcase-migrations.ps1 -Apply
Remove-Item Env:SHOWCASE_DATABASE_URL
```

Expected result: `showcase.schema_migrations` contains versions `001` through `007`, each with the manifest hash. A failure rolls back the active change set and stops the runner.

If the `showcase` schema already exists, the runner stops. Inspect the existing objects and ledger first; use `-ResumeKnownState` only after confirming that the recorded migrations are a trusted sequential prefix with matching hashes.

## Production stage 2 — private bucket

Exact operation: inspect Storage through the supported API, create `showcase-media` as private only when absent, and stop without changes if an existing bucket is public. No existing bucket or object is rewritten.

```powershell
npm run storage:plan
$env:SUPABASE_URL = 'https://xssjgzzhcudktrkruitb.supabase.co'
$env:SUPABASE_SECRET_KEY = '<temporary server-side secret key>'
node scripts/manage-showcase-bucket.mjs --apply
Remove-Item Env:SUPABASE_SECRET_KEY
Remove-Item Env:SUPABASE_URL
```

Expected result: one row named `showcase-media` with `public = false`. Anonymous direct downloads/listing remain unavailable; reviewed Storage RLS permits active admins only.

## Production stage 3 — Data API and Edge Function

In the project's Data API settings, add `showcase` to the exposed schemas if it is not already exposed. Do not change unrelated schemas. SQL grants and RLS in migration 003 remain the authorization layer.

Set only the Edge Function CORS secret (Supabase supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to the function runtime):

```powershell
supabase secrets set SHOWCASE_ALLOWED_ORIGINS=https://jpaluminium.com,https://www.jpaluminium.com --project-ref xssjgzzhcudktrkruitb
supabase functions deploy public-showcase-media --project-ref xssjgzzhcudktrkruitb --no-verify-jwt
```

The function accepts only a media UUID (`?id=<uuid>`), calls `showcase.is_media_public`, reads only the fixed private bucket, and returns short-lived signed URLs: 5 minutes for images/documents/CAD and 15 minutes for video/3D. It returns 404 for non-public assets, 429 on abuse, and 503 when signing is unavailable. The service-role key never enters the Vite application.

## Verification

Run `database/showcase-validation/verify-hosted.sql` read-only and compare the shared migration count with the saved preflight baseline. Then execute the existing RLS matrix as anon, non-admin, active admin, and revoked admin. Confirm direct Storage listing/download is denied to public roles and admin upload/update/delete works.

For delivery behavior, request the Edge Function with published associated assets and verify image/document expiry, video seeking and HTTP range requests, and GLB loading. Draft, archived, unassigned, internal, and private-document UUIDs must return 404.

Follow `HOSTED_VERIFICATION_CHECKLIST.md` for the complete RLS, Storage, Edge Function, range-request, and administrator workflow matrix. Finally run `npm test`, `npm run test:database`, `npm run test:edge`, `npm run typecheck`, and `npm run build`. Never commit `.env.local`, a database URL, access token, or service-role key.

Site 2 must consume only published rows from the `showcase` schema and request media through the Edge Function; see `PUBLIC_SHOWCASE_INTEGRATION.md`. Recovery and rollback boundaries are documented in `SHOWCASE_ROLLBACK.md`.
