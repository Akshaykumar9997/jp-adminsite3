# Site 3 hosted Supabase verification — 1 October 2026

## Outcome

The authenticated CMS at `http://localhost:5173` is connected to the hosted Supabase project `xssjgzzhcudktrkruitb` (JpInteriorsApp). The original loading error was a schema-version mismatch, not a disconnected account. The approved `database/showcase-next/008_room_based_content.sql` was applied through Supabase migration history as `showcase_room_based_content`. No frontend deployment was performed.

Before the update, existing Works REST reads returned 200, while `media_items`, the new fields and the five new functions were absent. Afterward, all eight tested public REST table endpoints returned 200: works, room_categories, materials, partners, media_assets, media_items, landing_page_versions and landing_sections. A zero-row public read proves route/schema availability, not administrator access; the authenticated browser tests below establish the normal administrator workflow.

## Live browser tests against hosted services

The owner signed in normally in the Codex browser. No password or session token was copied into scripts or this report.

| Workflow | Verified result |
| --- | --- |
| Authentication and loading | Existing admin session accepted; Works loading error gone; Dashboard, Works, Rooms, Materials, Partners, Media Library, Homepage and Settings loaded. |
| Work validation | Empty save blocked with inline title, room and location errors. |
| Image upload | Repository test image decoded/optimized to WebP, uploaded to private showcase-media Storage, and metadata finalized as Draft/ready. |
| MP4 upload | CC0 test MP4 uploaded to real Storage and metadata finalized as Draft/ready. |
| Work create/reload/edit | Labelled draft Work saved; hard reload retained fields and image/video associations; title edit persisted. |
| Custom rooms | Other created a separate draft room; standalone Add custom room also saved successfully. |
| Room cover | Image reused from a Work in that room saved as the room cover. |
| Mixed-media order | Video moved before image; reorder persisted and was independently verified in hosted media_items. |
| Archive/restore | Work changed from Draft to Archived, then back to Draft; stored status and returned UI confirmed. |
| Materials | Draft Material saved with reused image in Low — Essentials; edit moved it to Top — Premium. |
| Partners | Draft Partner saved with reused image logo. |
| Video metadata/poster | Video title changed; image poster saved through set_video_poster. |
| Homepage | Draft workspace loaded; the three approved default sections saved without publication; database contained three draft sections. |
| Settings | Settings and real audit activity loaded; saving the unchanged workspace name succeeded. |
| Deletion | Work deletion succeeded through the CMS. Test media deletion removed both metadata and real Storage objects. Other labelled content was removed by exact-ID, title- and status-restricted SQL under the authenticated database role. |

Test content never became publicly committed content. Live browser publication was deliberately not used to replace the homepage or display test content.

## Hosted transaction tests (fully rolled back)

Using the actual installed functions and an authenticated database-role test context with the existing administrator's ID, a single transaction exercised:

- Room and Work creation, edit and publication; published Work rejected while its room was still Draft.
- Mixed image/video/model metadata associations and exact-set reordering.
- Video poster persistence; published-owner media eligibility.
- Room archive hiding its Work and room restoration restoring visibility.
- Material creation/publication and tier editing; Partner creation/publication.
- Homepage draft creation, save and publish through the real RPCs.
- Required location rejection and association cleanup after content deletion.

All assertions passed and the transaction ended with ROLLBACK. This verifies hosted SQL behavior; it is not a substitute for a signed-in browser, Auth gateway, actual GLB upload, or successful public signed-media delivery test. These publication tests did not commit a live homepage.

## Security verification

- Anonymous REST calls to save_content, reorder_media, publish_homepage and set_video_poster returned 401 / permission denied.
- Anonymous reads returned no draft test Work or draft test media, and no settings, audit, private partner details or private documents.
- Actual public-showcase-media GET for the draft test image returned 404 / not_found. An earlier POST probe returned 405 because this endpoint intentionally supports GET; that result was not counted as a privacy test.
- media_items has RLS; authenticated users have the save function grant but its body requires public.is_admin(); anonymous users have neither its execute grant nor association insertion permission.
- showcase-media remains private (`public = false`). No auth role, bucket-public setting or unrelated business-schema policy was changed.
- Supabase security advisors were checked. They flag intentional security-definer publication/visibility helpers and existing broader-project issues. In particular, the existing `crm.business_details_public` security-definer view and disabled leaked-password protection remain separate follow-ups; this report does not claim the entire project has no security advisories. See [view advisory guidance](https://supabase.com/docs/guides/database/database-linter?lint=0010_security_definer_view) and [password protection guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Cleanup and retained changes

After explicit owner approval, the one Work, two custom Rooms, one Material, one Partner and two test files were permanently deleted. Exact-ID database and Storage catalog checks showed zero remaining test records or objects. Test mutations remain in the administrator audit log intentionally; audit history was not erased.

All eight default rooms remain. Workspace name remains JP Aluminium Interior Works. The approved homepage default copy is saved as Draft, with no selected hero image and no live homepage. Existing unrelated content and schemas were not edited. The migration's approved location/tier backfill, room/tier seeds, permissions and publication logic remain installed.

Screenshot: [connected dashboard](D:/jp-aluminium/jp-adminsite/test-results/hosted-cms-connected.jpg).

## Regression checks and remaining limits

This verification run also passed `npm test`, `npm run test:next` and `npm run typecheck`. Earlier local browser, database, Edge-handler, build and credential-isolation checks are recorded in NEXT_PHASE_HANDOFF.md; they should not be confused with hosted tests.

Still not verified or connected in production:

- Site 2 public URL/configuration and cross-origin administrator preview. Preview currently correctly reports that the website URL is not configured. Site 2 integration remains its own next step.
- Successful public signed-media delivery and allowed-origin/CORS behavior for the eventual Site 2 origin. Draft denial was tested; no test asset was committed as public content.
- Hosted GLB file upload/rendering, SVG upload, upload failure/retry/cancellation and Google OAuth. Those have local test coverage where documented, but were not re-run against hosted services in this session.
- A deployed Site 3 build, every browser/device, large-file latency and simultaneous administrators. The authenticated frontend tested here was the local development site with the real hosted backend.

For normal use now: create content as Draft, upload ready media, and explicitly publish the room before publishing a Work assigned to that room. The Homepage requires an approved hero image before publication.
