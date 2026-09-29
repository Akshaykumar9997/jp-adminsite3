# Public showcase integration contract

Site 2 is not present in this repository. When it becomes available, configure it with only the Supabase project URL and publishable key. Never provide it a secret/service-role key.

Use the `showcase` schema through the Data API. Anonymous reads are intentionally limited by RLS to published projects, rooms, works, materials, partners, and the single published landing-page version. Treat missing draft or archived rows as expected, not as an application error.

Do not construct Storage URLs or request `showcase-media` objects directly. Request `public-showcase-media?id=<media_asset_uuid>` from an allowed site origin, then use the returned short-lived signed URL. The function accepts no bucket or path parameter. Refresh an expired URL by repeating the UUID request; video players must support byte-range requests against the returned signed URL.

Suggested loading order:

1. Read the published `landing_page_versions` row.
2. Read its visible `landing_sections` and ordered `landing_featured_projects`.
3. Read referenced published content rows and associations.
4. Resolve displayed media UUIDs through the Edge Function only when needed.

Handle `404` as unavailable/non-public media, `429` with the supplied retry interval, and `503` as a temporary authorization or signing outage. Do not retry `404` aggressively.
