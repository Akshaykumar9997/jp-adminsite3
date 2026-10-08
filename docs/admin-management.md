# Shared admin management

`/admins` manages the existing Flutter `identity.profiles` records. Login continues
to use Supabase Auth and the unchanged `public.is_admin()` check. No Flutter files,
database schema, policies, Auth configuration, or Edge Functions are changed.

The website calls its own `/api/admins` endpoint. This forwards the caller's JWT
and a public key to the existing `create-admin-account` function server-to-server,
avoiding its missing browser CORS support. No privileged key is needed by this site.

## Running and deploying

- `npm run dev` and `npm run preview` include the endpoint through Vite middleware.
- Vercel deploys `api/admins.mjs` as a Node function. The SPA rewrite excludes `/api/`.
- Set `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` on the server, or reuse the existing
  `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` deployment variables.
- A plain static host serving only `dist/` needs a Node/serverless endpoint for
  `/api/admins`; copying the built SPA alone does not deploy this functionality.
- Run `npm run test:admins`, `npm run test:admins:browser`, `npm run build`, and `npm run test:security`.
  The browser test needs Playwright and an installed browser. It accepts
  `PLAYWRIGHT_CHANNEL=msedge` or `chrome`, and can use bundled Playwright via `NODE_PATH`.

## Behavior and limits

All operations verify the token with Supabase Auth and check `is_admin()` using
the caller's JWT. Suspended admins and ordinary users cannot manage accounts.
Profiles are read with explicit non-password columns; passwords are never loaded,
stored by the website, or logged. Password inputs follow the existing function's
trim and minimum-six-character behavior.

Create rejects any existing profile email before invoking the existing function.
Password updates resolve the target's email and name from its admin profile on the
server. Duplicate creation never silently resets an existing administrator.
Removal deletes the admin profile, matching Flutter, and retains the Auth account.
Linked business records may prevent deletion; such failures leave the UI with an
error. Removal blocks the caller's own account and checks a fresh count of active
admins. Suspended admins do not count as remaining active administrators.

These checks cannot provide a cross-application transaction: another application
can concurrently create, remove, or change a profile after a check. The unchanged
Edge Function updates Auth before its profile RPC, and searches one page of Auth
users. These existing backend limitations can cause partial failures or failures
for existing Auth-only users outside that page. The site never retries credential
mutations automatically and reports uncertain results for manual verification.
Strict cross-app atomicity would require a separate authorized backend change.

References: [Supabase browser CORS requirements](https://supabase.com/docs/guides/functions/cors),
[server token verification](https://supabase.com/docs/reference/javascript/auth-getuser),
and [Vercel Node function configuration](https://vercel.com/docs/functions/runtimes/node-js/advanced-node-configuration).

The list refreshes on focus, visible-tab intervals, and successful mutations.
Admins can use the existing Google login with the same authorized email; the
website does not create Google accounts or change OAuth provider settings.

## Verification (2026-10-08)

Passed production build/typecheck, admin API tests, isolated browser tests in
Microsoft Edge, client secret scanning, and the existing migration/package checks.
The browser test exercises the real Node proxy and Supabase SDK against an
in-memory HTTP test double whose account function deliberately lacks CORS.
It covers creation, password changes, role conflicts, confirmation, preserved input
after an upstream failure, and desktop/mobile layout.
Screenshots are saved under the ignored `test-results/` directory.

No hosted accounts were created, modified, or deleted. No backend deployment was
performed. Real email/password and Google login across both applications still
need verification after the admin-site deployment using a designated test account.
