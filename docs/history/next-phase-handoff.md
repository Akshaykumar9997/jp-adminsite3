> Historical implementation record. This is not the current UI specification; see the root README and current verification reports.

# Site 3 Admin site and Site 2 showcase — next-phase handoff

Implementation date: 1 October 2026. This document describes the actual local source, not a claim about the hosted deployment.

## Scope and safety

The later implementation prompt superseded the initial “inspection only” restriction for local code. Production migration execution, production data writes, bucket changes, Edge Function deployment and website deployment remain **unauthorized and unperformed**. The completed production preflight was not repeated.

Site 3: `D:/jp-aluminium/jp-adminsite`. Site 2: `D:/jp-aluminium/jpdemo/dist`.
The supplied `jpdemo(1).zip` filename was not present; the existing extracted `jpdemo` reference was used. Its original `style.css`, typography, layouts, navigation and viewer concept were retained. A separate small `showcase.css` changes only the loading line from simulated completion to indeterminate activity.

Existing migrations 001–007 remain checksum-locked and unchanged. The new migration is deliberately outside that folder at `database/showcase-next/008_room_based_content.sql`; existing deployment commands do not silently pick it up.

## Current navigation and functionality map

| Section | Purpose and supported actions | Backend workflow |
| --- | --- | --- |
| Dashboard | Real counts for works, published works, rooms and media; links into content workflows; shared loading/error/empty states. No illustrative project statistics. | Reads through `loadCms`. |
| Works | Search title/location; filter visibility and room; create/edit; select room and location; upload/reuse mixed media; arrange it visually; choose an image cover; preview assets; save draft, publish with confirmation, archive, restore by changing visibility, delete with confirmation. No project selection. | `save_content('work')`, `reorder_media`, table delete; required location/room and media checks in SQL as well as UI. |
| Rooms | Eight seeded defaults plus custom categories. Defaults cannot be renamed/deleted through the Admin site. Add/edit custom room; upload/reuse mixed media; choose cover from this room's media or its existing works' image assets; change visibility; remove unused custom rooms. | `save_content('room')`, mixed associations, category delete with foreign-key protection. |
| Media Library | Upload many files once; search title/filename; filter image/video/3D; preview cards; edit media title/image alternative text/optional video cover; delete unused assets with confirmation. Visibility is inherited from the content using an asset, not a technical media-public toggle. | Media metadata update, `set_video_poster`, signed admin previews, database deletion and Storage removal. Used assets are protected by references. |
| Materials | Create/edit material; choose exactly Low — Essentials, Mid — Signature or Top — Premium; reuse the same mixed media editor; cover, visibility, archive/restore, delete. No editable tiers or technical specifications in the new form. | `save_content('material')`; stable fixed collection IDs; authenticated collection insert/update/delete privileges revoked. |
| Partners | Name, logo and visibility only; upload clean SVG or image logo, choose existing image, preview, publish with confirmation, archive/restore, delete. Published partners populate the approved carousel. | `save_content('partner')`; publishing requires a ready image logo. Private partner details/documents are not fetched by this workflow. |
| Homepage | Edit approved Hero, Navigation cards and Collaborator carousel copy; select hero image; toggle section visibility; edit search metadata; save draft; authenticated saved-draft preview; publish with confirmation; read the latest ten version-history entries. Previous live version is archived atomically. | `ensure_landing_draft`, `save_landing_draft`, `publish_homepage` → protected `publish_landing_version`. No project picker or featured-project dependency. |
| Settings | Workspace name that is reflected in the top bar; supported-media/publishing guidance; latest twenty audit events. | `cms_settings` upsert; administrator-only `audit_events` reads. |
| Authentication | Existing email/password and Google sign-in; current profile-based administrator check; role revalidation; protected routes; sign-out safeguard for dirty forms and active uploads. | Supabase Auth plus existing `public.is_admin()`; no new role infrastructure. |
| Global Upload Center | Accessible across navigation and inside modal dialogs; expand/collapse; file-by-file queued/uploading/processing/ready/failed/cancelled state; actual transferred-byte progress; retry only the affected file; cancellation where safe; dismiss completed/failed jobs. | Private `showcase-media` uploads with current administrator session, followed by stable-ID media metadata upsert. |

Legacy `/projects` redirects to Works; `/collaborations` redirects to Partners. Legacy backend helpers/tables are preserved, not presented as the new workflow. Assignment to projects, private-document administration and arbitrary homepage layout building are not part of the simplified navigation.

## Complete current form-field inventory

Every new content item defaults to **Draft — only admins**. The visibility dropdown has precisely Draft, Published and Archived, with explanatory labels. Restoring an archived item means selecting Draft or Published and saving; there is no misleading separate restore button. Publishing a previously non-published item asks for confirmation.

| Form | Editable fields, defaults and validation |
| --- | --- |
| Work | **Title**: blank, required, whitespace trimmed. **Room**: unselected, required; Hall, Kitchen, Bedroom, Dining, Bathroom, Balcony, Pooja Room, Other and stored custom rooms. **Custom room name**: appears and is required when Other is selected; the RPC reuses an existing matching category or creates a custom category. A category created from a draft Work also starts as Draft; a category created during confirmed Work publication is published in the same transaction. **Location**: blank, required, trimmed. **Visibility**: Draft. **Media**: empty mixed collection; optional. **Cover image**: initially first selected image; may be explicitly selected or reset to first available. Publishing requires a published room. |
| Default room | **Title**: existing default name, read-only. **Visibility**: stored status. **Media**: existing collection. **Cover**: current image or first image; the dropdown also includes images from works in this room. No delete control. |
| Custom room | **Title**: blank on create, required. **Visibility**: Draft. **Media/cover**: same room editor. Existing custom rooms can be renamed or deleted, subject to dependencies. |
| Material | **Title**: blank, required. **Category**: Mid — Signature by default; only Low — Essentials / Mid — Signature / Top — Premium. **Visibility**: Draft. **Media/cover**: same mixed editor. No code, finish, JSON, description, custom category or manual order input. |
| Partner | **Name**: blank, required. **Visibility**: Draft. **Logo**: upload/choose ready image; SVG is sanitized and rasterized to safe WebP. **Selected logo**: explicit selection, otherwise first selected image. Publishing without a logo is rejected. There are no contact, NDA, assignment, biography or internal-note fields here. |
| Media metadata | **Title**: existing filename-derived title, required. **Alternative text**: images only, optional, blank by default. **Video cover**: videos only, optional; ready image dropdown, defaults to browser first-frame fallback. Content publication manages media eligibility. |
| Homepage — Hero | Eyebrow: `ALUMINIUM. CRAFT. CHARACTER.`; Heading: `Beautiful spaces.\nBuilt around you.`; Body: approved UAE introduction; Button: `Discover our work`; Image label: `Spaces that tell your story.`; Image eyebrow: `THE ART OF FEELING AT HOME`; Foot left: `DESIGNED WITH PURPOSE`; Foot right: `MADE TO LAST`; selected cover image; section visibility true. A visible hero must have a nonblank heading and ready image before publication. |
| Homepage — Navigation cards | Heading: `What brings you here?`; Body: `A space for every possibility.`; Works title/body: `Our works` / `Find inspiration, room by room.`; Materials title/body: `Materials` / `The right finish. Your kind of budget.`; Enquiry title/body: `Start a project` / `Good things start with a conversation.`; Support title/body: `Client care` / `Here for you, long after handover.`; visibility true. Visible section heading required for publication. Destinations/layout are fixed to the approved demo. |
| Homepage — Carousel | Heading: `Great spaces. Great collaborators.`; Body: blank; visibility true. Visible heading required. Names/logos/individual visibility come from Partners, not duplicate homepage fields. |
| Homepage — search metadata | Page title and page description: existing values or blank. Optional. Header/button copy uses single-line inputs; heading/body/description use text areas. |
| Legacy homepage sections | Existing additional section records are retained and editable as heading/body plus visibility. They are **not automatically mapped to new public layout blocks**; review these before production migration rather than implying they will appear. |
| Settings | **Workspace name**: existing setting or `JP Aluminium Interior Works`, required and trimmed. Other former demo toggles have been removed instead of pretending to change behavior. |
| Email login | Email address: blank, required, email syntax; Password: blank, required. Existing authorized accounts only. Google login is an alternative. OAuth and hosted login-provider configuration are not changed by this implementation. |

Common form buttons: Cancel, Save changes / Saving changes / Retry save; publish visibility invokes confirmation and Publishing state; delete invokes confirmation and Deleting state. Homepage has Save draft, Publish, Preview saved draft and Version history. Media editor buttons: Upload files/logo, Choose existing, drag handle, move earlier/later, View, Remove association, Use as cover. Upload Center: expand/collapse, Cancel, Retry upload, Remove or Dismiss. Loading failures have Retry; empty lists have a creation action.

Required-field errors appear beside the input, update as it is corrected, focus the first invalid field and prevent API calls. Dialog close, Cancel, route navigation and browser unload guard unsaved input. Save failures keep entered text and selections. Operations use synchronous locks, not only disabled-looking buttons.

## Technical fields removed, hidden or simplified

| Former/confusing concept | Treatment |
| --- | --- |
| Project / project room relationship | Removed from new Work UI. Legacy links retained until that Work is explicitly saved standalone. Existing project tables remain. |
| Slug, material code, UUID, section key | Internally generated or fixed; not editable. |
| Numeric sort order and independent media type order | Replaced by one visual mixed collection and internally persisted contiguous order. |
| Storage bucket/path, MIME, uploaded/created/updated actor and timestamps | Determined by the application/session; not entered by administrators. Public delivery accepts validated asset IDs, not arbitrary paths. |
| Media “publicly deliverable” switch | Removed; publication RPCs and public-owner predicates control delivery. |
| Work description/specification and material technical JSON | Removed from simplified forms and Work cards. Existing stored columns are not dropped. |
| Editable material ranges/collections | Replaced with three fixed tiers, backed by database privilege restrictions. |
| Collaborator descriptions, NDA/contact details and project assignments | Removed from the public-carousel workflow; private legacy tables remain protected. |
| Fake statistics, inert header search/notification controls, unimplemented settings toggles | Removed. |
| Homepage arbitrary layout/order/featured project tools | Replaced with approved fixed structure and human-readable content fields. |
| Exact processing percentages | Not shown unless bytes are measured. Optimization, validation and metadata finalization use indeterminate activity. |

## Relationships and publication boundaries

```text
Room category ──< Works (each has its own location)
Work / Room / Material ──< media_items >── media_assets
Material ──> one of three fixed collections
Work / Room / Material ──> image cover
Video asset ──> optional image poster
Partner ──> image logo ──> published homepage carousel
Homepage version ──< approved sections ──> hero image
```

Assets are reusable. Removing a media card detaches its association; it does not delete the shared file. Deleting content removes its mixed associations, not reusable library assets. A room still referenced by works cannot be deleted. Deleting a referenced media asset is blocked; optional cover/poster references follow the existing database's null-on-delete behavior.

New Work workflows do not read or require projects. Migration backfills existing location from **showcase** projects where available and copies existing ordered work-media links and otherwise-unlinked cover images into `media_items`. Existing material collection ranges become low/mid/top tiers, and existing material covers enter their collection. Existing nondefault rooms become custom. No identity/CRM/catalog/quoting/business-project/workforce schemas are modified.

Legacy project publication restrictions are preserved while old Work links exist. Saving that Work through the new form explicitly removes its legacy project linkage and replaces its old `work_media` association with the mixed collection. Existing works with no usable location require an owner-supplied location before public display. Archiving a room hides its works publicly until the room is restored.

Private storage stays private. An asset must be published, ready, deliverable, outside internal/unassigned prefixes, not linked to a private partner document, and have a legitimate published owner to be served publicly. Posters inherit a valid published video's eligibility. Media reused by another published owner can remain public after one owner is archived; this is intentional reuse, not permanent revocation of every copy. Already issued signed URLs have a short expiry and are not instantly revoked.

Publication validates and promotes selected assets within the database transaction. Homepage publication preserves the existing single-live-version rule and archives the previous live version. Admin authorization is checked inside mutation RPCs; client validation is not the security boundary. Private partner details, documents, settings and audit data remain unavailable to anonymous readers.

## API/RPC and backend dependencies

Source anchors: [content forms and filters](D:/jp-aluminium/jp-adminsite/src/pages/ContentPage.tsx), [homepage editor](D:/jp-aluminium/jp-adminsite/src/pages/LandingPage.tsx), [shared feedback](D:/jp-aluminium/jp-adminsite/src/components/Feedback.tsx), [upload manager](D:/jp-aluminium/jp-adminsite/src/components/UploadManager.tsx), [mixed media editor](D:/jp-aluminium/jp-adminsite/src/components/MediaEditor.tsx), [Admin site API](D:/jp-aluminium/jp-adminsite/src/lib/cms.ts), [migration proposal](D:/jp-aluminium/jp-adminsite/database/showcase-next/008_room_based_content.sql), [public data adapter](D:/jp-aluminium/jpdemo/dist/showcase.js), [approved-design integration](D:/jp-aluminium/jpdemo/dist/app.js).

`loadCms` reads showcase works, room_categories, materials, partners, media_assets and media_items. Content mutations use `save_content`, `reorder_media`, `set_video_poster` and authorized table deletions. Existing helpers handle media metadata, file deletion and settings. Homepage draft creation/save reuse existing protected RPCs; `publish_homepage` adds ready-media validation before the existing publication function. Auth continues to depend on the existing `public.is_admin()` and profile policy.

Browser uploads use actual XHR transfer events to private `showcase-media` Storage with the current user token and public publishable key. File paths and stable asset IDs are generated internally. Two files are processed concurrently. Retry uses the same asset ID/path to avoid duplicates after an ambiguous response. Preparing/validating media and final metadata writes are separate processing stages. Cancellation is disabled during final metadata commit. Files remain in memory across Admin site navigation; a browser refresh cannot resume the underlying File objects and is warned against.

Site 2 uses `dist/showcase.js` to read published showcase rows under anonymous RLS and requests short-lived media delivery from the **existing** `public-showcase-media` Edge Function using asset IDs. There is no new production Node backend; `scripts/local-test-server.mjs` is exclusively a loopback, disposable test double. Draft preview requires an administrator session on the Site 2 origin and administrator authorization; no tokens are placed in query strings or public config.

Images decode and optimize to one WebP file at up to 1920 pixels. H.264 MP4 is checked for container/codec markers and actual browser-playable video metadata. GLB 2.0 headers/JSON/self-contained resources are checked. This is not a complete glTF semantic validator. SVG logos reject active/external content and use a rasterized fallback. Native video controls use an optional poster or browser first frame. Interactive 3D previews use the same pinned Google model-viewer dependency already used by the public viewer.

## Test execution and limits

Automated verification is kept under `scripts/` and browser screenshots under ignored `test-results/`.

- `npm test`: checksum-locked migrations, client isolation and existing media/storage contracts.
- `npm run test:database`: original disposable PostgreSQL/RLS/atomic landing tests.
- `npm run test:edge`: five tests of the real Edge handler's CORS/method/identifier/config failure behavior.
- `npm run test:next`: new pure-function/file/config checks plus disposable PostgreSQL CRUD, mixed ordering, custom room, fixed tiers, legacy data bridge, public/private role matrix, atomic validation, deletion cleanup and audit identifiers.
- `npm run test:browser`: real Chrome browser against a disposable local Postgres/Storage API double; requires the documented local-only Vite configuration. It refuses to run against a different frontend connection.
- `npm run typecheck`, `npm run build`, `npm run test:security`: TypeScript, production bundle and credential-pattern scan of source and both client outputs.
- `node check.cjs` in `D:/jp-aluminium/jpdemo`: public room/location/media filter behavior.

The local browser test creates/uploads/edits/publishes/deletes work; uses mixed image/MP4/GLB; tests failed save, retry, duplicate clicks, unsaved changes, custom room, existing-work room cover, upload failure/retry/cancel, actual offline save, materials, partner logo, homepage publication, Site 2 cards/viewer, desktop/tablet/mobile overflow, dialog focus and reduced motion. It also exercises ordering with mouse, keyboard and browser touch input. These checks passed locally on 1 October 2026, including mouse/keyboard/touch ordering, interactive 3D loading, protected-route sign-in validation/sign-out and the media-card containment assertion. Database archive/restore and room visibility boundaries also passed. The real Edge-handler suite passed all five tests.

Run local integration tests in separate PowerShell terminals:

```powershell
# Terminal 1 — disposable, loopback-only database/storage test double
npm run test:local-server

# Terminal 2 — process-local overrides, never edit production .env
$env:VITE_SUPABASE_URL='http://127.0.0.1:54321'
$env:VITE_SUPABASE_PUBLISHABLE_KEY='local-publishable-test-key'
$env:VITE_SHOWCASE_SITE_URL='http://127.0.0.1:54321'
npm run dev -- --host 127.0.0.1 --port 5174

# Terminal 3 — installed Playwright required; this machine uses Codex's bundled runtime
$env:NODE_PATH='C:\Users\ADMIN\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules'
npm run test:browser
```

PGlite tests validate real SQL/RLS locally; the browser Storage API is simulated. These do **not** verify hosted Supabase infrastructure, actual production media latency, Google OAuth redirects, all browser/GPU combinations, or a deployed Site 2. No claim of hosted end-to-end verification is made. The build succeeds with a Vite bundle-size advisory: the current main JavaScript chunk is about 607 kB minified / 178 kB gzip; route splitting is a follow-up optimization, not an ignored build failure. Unit tests use Node 24's experimental TypeScript stripping and emit its informational warning.

## Hosted approval and verification update — 1 October 2026

The owner subsequently approved migration 008. It is now applied to project `xssjgzzhcudktrkruitb` as `showcase_room_based_content`. Authenticated live Site 3 creation, uploads, edits and loading were verified; temporary test content was removed with explicit approval. Publication tests ran in a rolled-back hosted transaction. See [docs/history/hosted-admin-site-verification.md](D:/jp-aluminium/jp-adminsite/docs/history/hosted-admin-site-verification.md) for current evidence and limits. The historical local-only descriptions above describe the earlier implementation stage, not the current migration status. Site 2 configuration/preview and frontend deployment remain outstanding.

## Owner decisions and approval blockers

1. Review/approve migration 008 and its legacy data bridge before any hosted execution. Confirm missing legacy locations, custom-room naming, and room visibility hiding associated works. Confirm how existing extra homepage sections should be retired or mapped; they are retained locally but are not new design blocks.
2. Approve Site 3 and Site 2 deployment together with the schema update. The new Admin site expects the new tables/RPCs and deliberately reports a backend-version mismatch against an older backend.
3. Supply/review Site 2's real public configuration and website URL, allowed origins and existing media-delivery function configuration. `showcase-config.example.json` is a template only; no production config file was invented.
4. Choose a secure draft-preview deployment model. A same-origin authenticated session works. Separate Site 2/Site 3 origins do not share localStorage, and Site 2 does not yet have its own administrator login screen. A cross-origin preview cannot be called complete merely by passing a version ID.
5. Decide whether to commission server-side video transcoding. None is installed: unsupported formats are rejected with H.264 export guidance, not converted. There are no responsive image derivatives beyond the optimized single WebP, nor server-generated poster thumbnails; first-frame fallback is browser-provided.
6. Confirm production logos/images/copy and publication choices. The approved reference is UAE-oriented; no geographical content redesign was assumed.
7. Enquiry/support/visitor-introduction forms remain the approved demonstration workflow; enquiries are explicitly not sent or booked. CRM/service-request integration would need its own approved scope.
8. Review fixed-tier slug/ID collisions against existing showcase collections before production execution; that hosted data inspection was intentionally not repeated here. Confirm whether a separate restricted legacy private-partner workspace is still required. Optional subsequent hardening: production-scale pagination/performance measurement, a resumable large-file transfer service, orphaned-upload cleanup after abandoned/cancelled jobs, comprehensive glTF validation and cross-browser/device media testing. These are not silently installed infrastructure.

The Supabase skill influenced the private-bucket/public-owner boundary, server-authorized RPCs, scoped local migration review, RLS tests and indexed cover/poster relationships. The simplicity guidance kept the solution on existing React/Supabase/browser APIs without new runtime npm dependencies or a production application server.
