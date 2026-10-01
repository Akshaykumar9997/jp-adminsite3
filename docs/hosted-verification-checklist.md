# Hosted verification checklist

Use only against project `xssjgzzhcudktrkruitb` after the corresponding production stage has explicit approval. Save command output and timestamps. Stop on any checksum, object, grant, RLS, authorization, or data-isolation mismatch; do not reset, drop, repair, or reconcile automatically.

## 1. Before any write

- Confirm the dashboard project name/ref is `JpInteriorsApp` / `xssjgzzhcudktrkruitb`.
- Re-run `npm test`, `npm run typecheck`, `npm run build`, `npm run storage:plan`, and `database/run-showcase-migrations.ps1` without `-Apply`.
- Compare the current `supabase_migrations.schema_migrations` row count and versions with the saved preflight baseline.
- Capture the definition, owner, ACL, and a hash of `public.is_admin()`; do not replace or alter it.
- Capture current schemas, Storage buckets, `storage.objects` policies, and Auth configuration for comparison.
- Confirm the Data API change will expose only `showcase`; do not alter existing exposed schemas or default privileges.

## 2. Database after the approved migration stage

- Run `database/showcase-validation/verify-hosted.sql` read-only.
- Verify `showcase.schema_migrations` contains exactly `001` through `007`, in order, with the repository hashes.
- Verify the shared `supabase_migrations.schema_migrations` baseline is unchanged.
- Verify every `showcase` table has RLS enabled, including `schema_migrations`, private partner tables, settings, and audit events.
- Verify `anon` has no grants on `partner_private_details`, `partner_private_documents`, `cms_settings`, `audit_events`, or `schema_migrations`.
- Verify authenticated management policies call `public.is_admin()` and include both `USING` and `WITH CHECK` where applicable.
- Verify no grants, policies, functions, triggers, or default privileges changed in `identity`, `crm`, `catalog`, `quoting`, `projects`, or `workforce`.

## 3. Authorization matrix

Use existing approved test identities; creating or revoking users is a separate production operation.

- Anonymous: published public rows only; draft/archived rows absent; all mutations denied; private partner tables denied.
- Authenticated non-admin: same public reads as anonymous; all showcase mutations, private rows, audit rows, and Storage management denied.
- Active admin: draft/published/archived rows visible; authorized CRUD, settings, audit reads, and Storage management succeed.
- Revoked admin: new reads fall back to public visibility; mutations/private data/Storage management fail; the Admin site route guard signs out on focus or within 60 seconds.
- Confirm direct updates to landing publication status are denied, while `showcase.publish_landing_version(uuid)` succeeds only for the active admin.
- Confirm `showcase.save_landing_draft(...)` rejects non-admin and revoked-admin sessions. Force an invalid media UUID in a disposable draft and verify metadata, sections, and featured projects all roll back together.

## 4. Private Storage bucket

- Through the Storage API, verify `showcase-media` exists once and `public = false`.
- Anonymous and non-admin: bucket listing, direct object download, upload, overwrite, move, and delete all fail.
- Active admin: upload under each approved prefix, signed admin preview, overwrite, move, and delete succeed.
- Attempts outside `projects|works|materials|partners|landing|internal|unassigned` fail.
- Upload a temporary private partner document under `internal/partners/...`; verify its media row remains non-deliverable and the database rejects reclassification to a public path or public-deliverable state.

## 5. Public media Edge Function

- Confirm only `SHOWCASE_ALLOWED_ORIGINS` is user-configured; the secret/service-role key remains an injected server secret and is absent from browser bundles, responses, and logs.
- Valid published and associated asset UUID: `200`, JSON contains a short-lived URL, 5-minute expiry for image/document/CAD and 15-minute expiry for video/3D.
- Missing/invalid UUID, draft asset, archived asset, unassigned asset, unpublished parent, internal asset, and private partner document: `404` with no path or metadata disclosure.
- Add caller-controlled `bucket`, `path`, and filename parameters; confirm they are ignored and cannot change the fixed `showcase-media` lookup.
- Allowed Origin preflight succeeds with the configured origin. An unlisted Origin preflight fails and receives no permissive CORS header.
- Send more than 60 requests from one stable source within a minute and confirm `429`. Repeat from multiple regions/connections to document the per-isolate limiter ceiling.
- Database authorization outage and signing failure should return generic `503` responses without internal error details. Induce these only in a local/staging runtime, not production.

## 6. Video, document, and 3D delivery

- Fetch a video signed URL, then request `Range: bytes=0-1023`; expect `206`, `Content-Range`, and playable bytes.
- Seek near the middle and end of the video before URL expiry; confirm repeated range requests work.
- Open a public document before expiry and confirm it fails after expiry.
- Load a GLB/GLTF asset from the real public site origin; verify MIME type, CORS, dependent resources, and rendering.
- Confirm no signed URL is issued for a private partner document under any media kind.

## 7. Real administrator workflows

- Verify password login, Google PKCE callback, refresh persistence, deep-route protection, local logout, and failed/non-admin login messaging.
- Exercise each route: `/`, `/projects`, `/rooms`, `/media`, `/materials`, `/collaborations`, `/landing`, `/settings`.
- Create/edit/publish/archive/delete temporary project, work, room, material collection/material, partner/private details, media association, landing draft, and settings records where constraints permit.
- Confirm editing records does not clear existing cover/logo asset IDs or reset an existing publication timestamp.
- Confirm landing publication archives the prior live version and never publishes an unpublished featured project or private/unapproved media.
- Verify audit actor/action/entity data for base and junction tables. Confirm `cms_settings` uses its key, private details use `partner_id`, and composite associations use both IDs; confirm no password, access token, secret key, or document contents appear.
- Remove temporary verification records through normal Admin site operations only after preserving evidence.

## 8. Stop conditions

- Stop immediately on a checksum mismatch, existing unknown `showcase` state, changed shared migration ledger, unexpected public bucket, missing RLS, over-broad grant, private-data visibility, non-admin mutation, or Edge Function authorization failure.
- Preserve the database state and logs. Propose a reviewed forward correction; do not drop/reset schemas, repair Supabase migration history, or weaken a policy.
