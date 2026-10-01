# Rooms, visibility and caching — verified 2 October 2026

## Implemented

- Rooms have a name and two visibility choices; no media upload, library picker or cover selection. Assets belong to works inside rooms. Album thumbnails derive from work covers.
- Existing rooms, works and reusable files are preserved. Former predefined rooms are ordinary editable/trashable rooms; active-work dependency protection remains. The legacy `Other` name has no special creation requirements.
- Published means available to the public website through the existing publication/RLS rules. Archived means admins only. Trash is a deletion state, not a third publication status. Restore returns Archived.
- Existing Draft rows were converted to Archived, not Published. All eight content-status tables default to Archived and have two-state constraints. Legacy Draft writes are normalized for compatibility; the historical enum label remains so old database/API definitions do not break.
- Removed room-only media associations and stored room covers. No storage bytes, reusable assets or work associations were deleted. Detached files remain in Media Library and can be reassigned to works.

## Cache design and limits

The ponytail skill guided reuse of existing loaders and native browser caching rather than adding a cache framework or bulk-downloading resources. Supabase guidance informed exact signed-URL reuse, preserving private storage authorization.

- Session-local LRU/TTL: up to 8 loader-result entries, five-minute TTL. The shared Admin site workspace is reused across Rooms, Media Library, Materials, Partners and Trash.
- Up to 512 signed preview URL entries, four-minute TTL for five-minute signed URLs. Keys include asset ID, path and updated timestamp. Concurrent identical requests are deduplicated.
- Warm navigation initializes synchronously from cache; no initial loading skeleton or re-sign request while valid. Images remain lazy-loaded; videos request metadata/first-frame previews, not entire videos. Actual resource bytes use browser-managed HTTP caching; byte retention is browser-controlled, not guaranteed offline storage.
- Saves, reorder refreshes, Trash/restore/deletion and completed uploads invalidate data. Visible pages refresh quietly every minute and on window focus. Failed refresh keeps the current gallery visible with a warning; initial failures still show Retry.
- Logout, account changes and denied authorization clear memory caches. Generation checks prevent cleared in-flight results from repopulating them. Private Admin site data is not persisted to localStorage/IndexedDB or a service worker.
- This is bounded on-demand session caching, not eager loading of every asset, offline synchronization or permanent caching. Browser refresh starts a fresh data cache. Cache expiry, evictions and external updates can still require network requests.
- Signed URLs remain temporary bearer links until expiry; clearing memory does not revoke an already-issued URL. Existing access/RLS/storage policies were not weakened.

Reference: [Supabase Smart CDN and signed URLs](https://supabase.com/docs/guides/storage/cdn/smart-cdn).

## Backend rollout

Applied to the configured project `xssjgzzhcudktrkruitb` using the migration tool:

- Local source `supabase/migrations/20261001192454_room_visibility.sql`
- Live migration ledger `20261001193837`, name `room_visibility`

The tool assigns the live timestamp. Existing gallery migrations also have differing local/live versions documented in docs/gallery-verification.md. Do not blindly replay local files with CLI push against this live project without reconciling migration history first.

Post-migration verification: eight two-state constraints/defaults; zero Draft rows, protected rooms, room covers or room-only media links. A transactional live create/rename/publish/Trash/Archived-restore check passed; all its writes were rolled back. Frontend source/build is updated locally; no frontend deployment was performed.

## Tests passed

- `npm run test:cache`: LRU bounds/TTL, request deduplication, failed-load retry, stale-response rejection, logout clearing; Chrome two-option room form, no room uploads, room → work → assets, warm Media → Materials → Media navigation without refetch/re-sign/skeleton, failed background-refresh retention/recovery.
- `npm run test:gallery`: PostgreSQL admin/non-admin/anonymous RLS, editable legacy rooms, rejection of room media, legacy-status normalization, dependency guards, Archived restore; browser gallery/viewer/rename/zoom/selection/dropdown/filter tests.
- `npm run test:browser`: room/work CRUD, validation, uploads, publication, ordering, failed-save retry and responsive layouts.
- `npm run test:media`: deletion/reuse/in-use guards, cleanup retry, concurrent uploads across navigation, cancel/retry and commit recovery.
- `npm run test:gallery-rollout`: Rooms/Materials/Partners/Trash and responsive 320/390/768/1440 layouts.
- `npm run test:upload-panel`: Drive-style circular progress, completion/ETA, navigation/collapse/dismiss and responsive bounds.
- `npm run build`, `npm test`, `npm run test:security`, `git diff --check`.

Chrome headless desktop/mobile viewport testing is not physical-device Safari/Android testing. Build retains its existing non-blocking >500 kB bundle warning.

## Remaining advisor findings

Security/performance advisors were checked after rollout. No finding names either new trigger function. Existing shared-project findings remain outside this task: [CRM security-definer view](https://supabase.com/docs/guides/database/database-linter?lint=0010_security_definer_view), [mutable search paths](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable), [executable security-definer functions](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [disabled leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection), and [foreign-key index advisories](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys). Existing RLS helpers/Admin site RPCs have intentional call permissions; blanket revocation would break them. These findings mean this change is not a whole-project security certification.

## Manual check

1. Create “Dining room 2”, choose Archived or Published, save without uploading anything.
2. Open it, add a work, upload/select assets there, save and open its gallery.
3. Rename/trash an empty existing room. A room with active works should explain the dependency.
4. Publish a room/work and verify client visibility; archive the room and verify its contents disappear from the public site. Admin gallery retains them.
5. Visit Media Library, then Materials/Partners/Rooms and return. Warm cards/previews should remain available without the original loading screen.
6. Rename/upload/Trash/restore content and verify the next view reflects the change. Logout and sign in again; expired or new-session data should load normally.
