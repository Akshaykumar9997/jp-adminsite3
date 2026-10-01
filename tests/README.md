# Regression tests

Tests are source code, not generated deployment assets. They protect authorization, deletion safety, uploads, rooms, visibility, galleries and cache invalidation. The obsolete browser script for the retired Homepage/Works UI was removed.

## Source/database checks

After `npm ci`:

```powershell
npm test
npm run typecheck
npm run test:security
npm run test:database
npm run test:next
node tests/test-gallery-database.mjs
node tests/test-cache-unit.mjs
node tests/test-deletion-unit.mjs
```

Database tests use disposable PGlite instances and do not connect to production. Baseline/next-stage tests also protect historical migration contracts. `npm run test:edge` requires network access for its pinned Deno runtime.

## Browser checks

Prerequisites: Playwright must be resolvable by Node.js (`playwright` package in your development tooling or `NODE_PATH`) and Google Chrome must be installed. The tests use Chrome headless with desktop/mobile viewports.

Start `npm run test:local-server` in one terminal. In a separate PowerShell terminal, start Vite explicitly against the disposable backend:

```powershell
$env:VITE_SUPABASE_URL='http://127.0.0.1:54321'
$env:VITE_SUPABASE_PUBLISHABLE_KEY='local-publishable-test-key'
npm run dev -- --host 127.0.0.1 --port 5174 --strictPort
```

Run the browser suites sequentially because they share/reset the same disposable backend:

```powershell
npm run test:browser
npm run test:gallery
npm run test:gallery-rollout
npm run test:media
npm run test:upload-panel
npm run test:cache
```

Browser scripts refuse mutation unless the frontend is configured for the disposable loopback backend. Generated screenshots go to ignored `test-results/`; they can be deleted and regenerated. Stop the test backend/Vite terminals when finished. No fixture media is uploaded to production by these tests.
