# JP Aluminium Admin site

Internal administration for Rooms, Works, Media Library, Materials, Partners and Trash. Published content is available to the client website; Archived content is visible only to administrators. Room assets belong to works, not directly to rooms.

## Development

1. Install Node.js compatible with the project's Vite version, then run `npm ci`.
2. Copy `.env.example` to `.env.local` and configure the project publishable key and optional public website URL. Never put privileged server credentials in Vite variables.
3. Run `npm run dev`.

`npm run build` creates `dist/`; `npm run preview` previews that build. Build output, dependencies, local environment files and generated test evidence are not committed. The package lockfile is retained for reproducible installations.

## Project layout

- `src/`: application routes, shared UI, authentication, data access and styles.
- `public/assets/`: runtime logo, login background and empty-state illustration.
- `supabase/`: application migrations, configuration and public-media Edge Function.
- `database/`: checksum-locked baseline migrations and database validation/rollback tooling. Do not remove or rewrite migration history.
- `scripts/`: maintenance, security checks and the disposable local test backend.
- `tests/`: maintained regression tests; see [test setup](tests/README.md).
- `docs/`: backend/deployment instructions and verification reports. `docs/history/` contains explicitly historical rollout records, not the current UI specification.

## Checks

Run `npm test`, `npm run typecheck`, `npm run test:security` and `npm run build` before pushing. Browser/database checks and prerequisites are documented in [tests/README.md](tests/README.md).

## Deployment and database safety

- [Backend setup](docs/showcase-backend.md)
- [Rollback procedures](docs/showcase-rollback.md)
- [Public website integration](docs/public-showcase-integration.md)
- [Current rooms, visibility and caching](docs/rooms-cache-verification.md)
- [Gallery verification](docs/gallery-verification.md)
- [Media workflow verification](docs/media-workflows-verification.md)

Some live migration timestamps differ from local source filenames because the migration tool assigns its own timestamp. Consult the verification reports before running migration push; do not blindly replay existing migrations or reconcile shared-project history. Publishing the frontend is separate from applying database migrations.

The application is branded “Admin site.” Existing internal CSS/component/API identifiers and persistent cleanup keys retain their technical names for compatibility; they are not UI branding.
