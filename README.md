# NEET 2027 Planner

Installable study planner (PWA) for NEET 2027: daily lectures, weekly and monthly targets, tests, revisions, mistake log.
Works offline. Data is kept on the device (IndexedDB) and, when signed in, synced to Supabase (table `planner_docs`, row-level security).

Live app: https://yelelucky.github.io/neet-planner/

## Files
- `index.html`, `app.css`, `app.js` — the app
- `storage.js` — device storage (IndexedDB) and cloud sync
- `shared-data.js` — Yakeen NEET 2027 test list + NCERT chapter list (load offline)
- `config.js` — Supabase project URL + publishable key
- `sw.js`, `manifest.webmanifest`, `icons/` — install + offline support
- `_orig/` — style sources; `node tests/build-css.js` rebuilds `app.css`

## Tests (run from this folder with `python -m http.server 5173` running)
- `node tests/week-rule.test.js` — month-plan week rule (4+ days)
- `node tests/run-perf-headless.js 4` — lag test with ~20,000 fake records at phone-like speed
- `node tests/make-icons.js` — redraw PNG icons from the SVGs

When you change any app file, bump `VERSION` in `sw.js` so installed copies update.
