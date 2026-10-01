# One UI-inspired responsive Admin site gallery

Media Library, Rooms/work albums, Materials and Partners now share a gallery interaction
pattern: large headings, rounded album covers, compact photo grids, search,
filters, explicit selection mode, desktop Ctrl/Shift selection, long-touch
selection, and bulk actions with per-item failure results. Mobile navigation and
selection actions stay at the bottom. Media editing now changes the filename inline
inside File details; alternative text remains readable, not editable in that screen.
Content editing in Rooms, Materials and Partners remains;
photo cropping, retouching, filters and other image-editing tools are not included.

The viewer supports keyboard/previous/next navigation, horizontal image swipes,
wheel and pinch image zoom, bounded panning, metadata details and download. There
is no Zoom button. After the reviewed Media Library pilot, native popover dropdowns
now cover all Admin site filters, bulk actions and editor fields (room/category/visibility,
partner logo). Rooms now have name/visibility only; covers derive from works. Non-scrolling segmented filters cover Media Library
and Material categories. Shared empty states use the original local SVG asset.
Videos decode their own first frame; manual video poster selection is retired.
Material and Partner albums open into their files. Partner logo previews use contain
sizing rather than cropping. Rooms, Materials and Partners have visibility filters
and comfortable/compact layouts; Materials and Partners also sort by newest, oldest
or name. Empty filtered results offer Clear filters, while genuinely empty collections
offer creation actions. Trash distinguishes filtered-empty from genuinely empty.
All five sections, including Partners, are reachable in mobile bottom navigation.
Editor previews use the same gesture-enabled viewer and inline filename editing;
renaming preserves storage paths and associations, and refreshes shared content.
Only file names are edited in that viewer; content names, location, category and
publication remain in the content editor. Used files remain protected from Trash.
The media picker also handles zero eligible files, not just a zero-row library.
Bulk content editing changes visibility and material category using the existing
validated save operation; it preserves media membership and covers. It is not an
atomic multi-record transaction: successful items complete, failed items remain
selected for retry. Search/filter changes restrict selection to visible results.

## Trash behaviour and backend prerequisite

The connected backend `xssjgzzhcudktrkruitb` has now been updated under the user's
explicit request. `gallery_trash` was applied with live history version
`20261001174918`, followed by `video_first_frame` version `20261001180513`.
Their source files are `supabase/migrations/20261001165025_gallery_trash.sql` and
`supabase/migrations/20261001175929_video_first_frame.sql`. The MCP-assigned live
versions differ from the generated local filenames: do not blindly reapply these
files via CLI push; reconcile migration history first. Local database tests load
the source files in order after the room-first migrations.

Live checks confirmed all five Trash columns and the new triggers. A temporary
media row was trashed/restored inside a transaction that was rolled back, leaving
no test records or audit data. One active manual video-cover association was cleared;
the image asset and its stored bytes were not deleted. The poster column/function
remain for schema compatibility, but the authenticated manual-poster RPC is revoked.
Trashed legacy videos retain old associations until restored, at which point the
first-frame trigger clears the poster link. No frontend deployment was performed.

Trash retains records, files and associations until restore or deliberate permanent
deletion; there is no automatic expiry. Restored content is Archived and needs review
before publication. Public RLS/media predicates exclude trashed content. Trashed
records cannot be edited or republished, and trashed media cannot be attached.
All rooms are editable. Rooms with active works are protected;
restore a room before its work. Media with existing associations is protected,
including associations belonging to trashed content. Detach those associations or
permanently delete the owning content before trashing the file. Permanent room
deletion still requires dependent works to be removed. Content deletion preserves
reusable media. Permanent media deletion reuses the existing durable storage cleanup
warning/retry flow. Previously issued signed media URLs may remain valid until
their existing expiry; Trash does not revoke already issued URLs.

Confirmed operations immediately evict active cards and completed upload entries.
Repeated Trash/restore requests check existing state to recover a lost response.
The existing global upload queue remains independent of page navigation. Browser
refresh/close still cannot continue its in-memory transfers.

## Verification

- `npm run test:gallery`: isolated PostgreSQL tests cover admin/non-admin/anonymous
  RLS, public hiding, republish/reuse denial, parent dependencies, Archived restores,
  retained associations, permanent deletion and active-only reordering. Chrome
  tests cover viewer/navigation/zoom/details/download, keyboard/range/long-touch
  selection, search pruning, partial failure/retry, retained bytes/restore/reload,
  material bulk category/association preservation and album viewing. The pilot also
  tests actual browser wheel/two-pointer pinch events, inline rename validation,
  extension/storage-path preservation, action-specific spinners (including shared
  editor Save and Trash requests independently), keyboard/bounds
  of custom dropdowns, compact mobile filters, illustrated empty states and a real
  H.264 fixture whose decoded first frame is checked. Database checks assert poster
  writes are cleared and the retired manual-poster RPC is not executable.
- `npm run test:media`: updated regression suite covers Trash, permanent storage
  cleanup/retry, stale-card/reuse/in-use protection, upload concurrency/navigation,
  cancellation/retry, metadata response recovery and editor reattachment.
- `npm run test:browser`: existing room/work CRUD, publication, reordering, failed
  save, previews, navigation and public Site 2 regression checks.
- `npm run test:gallery-rollout`: Rooms, Materials, Partners and Trash at
  320/390/768/1440px, dropdown keyboard/bounds, no native selects, clear-filter
  actions, illustrated empty states, density and multi-selection layouts,
  shared Material/Partner viewer rename, in-use media Trash rejection, form
  validation/unsaved-dropdown-change protection, Partner Trash/restore and
  preserved logo association. Additional checks exercise dropdowns in modal editors.
- Layout assertions and visually inspected screenshots at 320/390/768/1440px.
- `npm run test:next`, `npm run test:database`, `npm test`, production build and
  client/bundle secret scan remain regression checks for the existing modules.

Browser suites require the disposable backend at localhost:54321 and a Vite
instance at localhost:5174 configured with the local test URL and publishable key.
See `docs/media-workflows-verification.md` for setup. Tests refuse a non-disposable
frontend configuration. Playwright/Chrome came from the bundled desktop runtime;
no extra frontend dependency was introduced. These are emulated phone viewports,
not hardware-device tests. Generated screenshots are under `test-results/`.

## Backend advisor findings outside this change

The live advisor reports no new gallery guard search-path/RLS issues. Existing
public authorization predicates and admin-checked Admin site RPCs are intentionally
security-definer APIs and therefore still appear in the generic executable-function
warnings. Do not revoke these indiscriminately: public media/RLS and Admin site depend on
them. Other findings in the shared database were not modified by this task:

- [`crm.business_details_public` security-definer view](https://supabase.com/docs/guides/database/database-linter?lint=0010_security_definer_view).
- [Five existing public functions with mutable search paths](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable).
- [Existing publicly executable security-definer functions](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable).
- [Leaked-password protection disabled](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
- The internal `showcase.schema_migrations` ledger has RLS enabled and no client
  policies, intentionally denying client access.

Production build passes with the existing non-blocking >500kB bundle warning.

Samsung reference patterns were adapted for the web and this Admin site, not copied as
a pixel-identical Samsung application or a complete DeX desktop shell:

- https://www.samsung.com/us/support/answer/ANS10002535/
- https://developer.samsung.com/one-ui/comp/app-bar.html
- https://developer.samsung.com/samsung-dex/modify-optimizing.html
