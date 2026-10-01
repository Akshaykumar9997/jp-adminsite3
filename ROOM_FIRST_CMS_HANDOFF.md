# Room-first CMS — implementation and verification

Implemented 1 October 2026 in Site 3; the scoped database migration is applied to Supabase project `xssjgzzhcudktrkruitb`. Frontend changes are local, not deployed.

## Navigation and workflow

- Dashboard, Rooms, Media Library, Materials, Partners. No separate Works, Homepage or Settings navigation/editor.
- Rooms opens room-category tiles. Open a room to see its work albums and all assigned photos, videos and 3D models. Add work inherits the selected room; editing can move work to another room.
- Room details controls the room cover and visibility. Custom rooms remain creatable/editable; default room names remain protected.
- Arrow controls arrange rooms, work albums within a room, and media inside an album. Ordering is persisted; work edits retain album position. Search temporarily disables album-order buttons to prevent reordering a partial list.
- Publish by selecting Published and pressing Publish work/room/material/partner. No second publication-confirmation dialog. Required fields, selected-room publication, ready/public-eligible media and partner-logo validation remain enforced.
- Archive/restore through Visibility. Unsaved-change and permanent-delete confirmations remain, with compact dialogs.

## Uploads, feedback and mobile

- Sonner 2.0.8 replaces custom success/error toasts, following the [official shadcn/ui Sonner pattern](https://ui.shadcn.com/docs/components/radix/sonner).
- Notifications occupy a separate viewport-positioned top-layer popover, not the form layout. Its DOM host follows the active native dialog so notifications remain dismissible rather than becoming inert behind a modal.
- Completed/cancelled uploads leave the upload-status panel. Only active uploads and failures remain; uploaded files stay in the selected collection and Media Library where they are needed. Duplicate filename/state histories beneath the editor are removed.
- Reused Lucide icons, native system fonts, 44px action targets, mobile photo grids, full-height phone editors, sticky actions, safe-area spacing and keyboard-managed navigation. Removed duplicate work/material cover dropdowns; covers are chosen on image cards.
- Mobile navigation traps focus while open, closes with Escape, restores focus and makes hidden/offscreen content inert. Closed sidebar shadows no longer spill into the page.

## Backend changes

Migration source: `supabase/migrations/20261001045730_room_first_cms.sql`, applied as `room_first_cms`.

- Revokes CMS-role execution of legacy Homepage create/save/publish functions.
- Revokes CMS-role insert/update/delete on Settings and legacy landing-version/section/featured-project tables.
- Adds `showcase.reorder_rooms(uuid[])` and `showcase.reorder_works(uuid,uuid[])`. Both require `public.is_admin()`, validate complete distinct sets, use transaction locks and preserve auditing.
- Adds an append-position trigger for new/moved work; ordinary work edits keep their position. Simultaneous inserts can share a position and are deterministically ordered by ID until explicitly reordered.
- No tables, existing content, files, audit history or unrelated business data were deleted. Legacy tables/read-only compatibility remain because they can still participate in media/publication safeguards.
- Existing private Storage, signed URLs, RLS, public-owner checks and private collaborator-document exclusions are retained. Removing the redundant confirmation does not bypass backend publication validation.

Before and after migration: **1 work, 9 rooms, 4 media assets, 1 material, 1 partner, 84 audit events**. A subsequent hosted role-simulated ordering test was entirely rolled back.

## Static homepage / Site 2 alignment

Local Site 2 adapter no longer fetches landing-page copy/layout configuration. Approved copy/layout remains in its static template. Published room/work covers supply the hero image; the first ordered room with a cover wins, with first ordered work cover and existing static image as fallbacks. Published partner logos remain dynamic.

This establishes a deterministic default, not a separate hero-curation editor. Owner review can choose a different static hero-selection rule later. Site 2 configuration, deployment and its future room-first navigation are not completed by this change.

## Verification performed

- `npm run typecheck`, `npm run build`, `npm test`, `npm run test:database`, `npm run test:next`, `npm run test:edge` (5 tests), `npm run test:security`: passed.
- `npm run test:browser`: passed against disposable loopback PostgreSQL/Storage. Covers room/work ordering and reload, navigation, required fields, image uploads, dismissible external notifications, direct publication, failed-save retry, previews, custom room/material/partner creation, archive/restore, failed-upload retry, retired-route redirects, static Site 2 adapter loading without a landing version, and gallery/editor layout at 320/390/768/1440px.
- Hosted checks: retired editing grants are disabled, anonymous ordering grants denied, admin ordering works in a rolled-back transaction, and content counts remain unchanged.
- Signed-in browser on local Site 3 connected to real Supabase: existing room/work/media load, mobile gallery and existing work editor verified at 390px without saving or changing content.
- Browser screenshots: `test-results/hosted-room-gallery-mobile.png`, `test-results/hosted-room-editor-mobile.png`, plus disposable responsive screenshots.

The tests do not establish universal device coverage. This turn did not repeat hosted video/GLB uploads, OAuth, or every possible network/concurrent-edit failure. Build still warns about a ~636kB JS chunk (~186kB gzip); code splitting remains a performance follow-up, not a build failure.

## Reproducing the local browser suite

1. Start `npm run test:local-server` (in-memory backend on 127.0.0.1:54321; no `.env` or production writes).
2. Start a separate Vite process on 5174 with process-only `VITE_SUPABASE_URL=http://127.0.0.1:54321` and `VITE_SUPABASE_PUBLISHABLE_KEY=local-publishable-test-key`.
3. Run `npm run test:browser` with Playwright available on Node's package path. The suite checks the frontend connection before allowing any writes.

The original seven reviewed migrations remain checksum-locked and unchanged. Simplicity and Supabase skills guided reuse of existing forms, native dialogs and security boundaries rather than replacement of the CMS or destructive schema redesign.
