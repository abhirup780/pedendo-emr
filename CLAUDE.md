# Project notes

EMR and prescription-writing web app for ONE pediatric endocrinologist (about 500 patients a
month). Everything must stay on free tiers. Owner works from different devices, so the repo is
the single source of truth — commit and push finished work.

## Decisions already made

- **Stack**: React + TypeScript + Vite, plain CSS (`src/styles.css`, tokens in `:root`), no UI
  library. Fonts self-hosted through `@fontsource` (IBM Plex Sans / Mono).
- **Database and sign-in**: Supabase free plan (Postgres, Google sign-in). Every table has
  `owner_id default auth.uid()` and a row-level-security policy `owner_id = auth.uid()`.
- **Photographs** (stage 6): the doctor's Google Drive through the Drive API with the
  `drive.file` permission; the database stores only file IDs. Compress in the browser first.
  Photos are optional and never go into exports.
- **Excel export** (stage 7): built in the browser, no server.
- **Hosting**: static (Cloudflare Pages). No server code of our own.
- **Backups**: the free Supabase plan has none; stage 7 must add an in-app backup to Drive.
- The prescription symbol is ℞, not "Rx".

## Layout

- `src/lib/store.ts` — the `Store` interface every screen uses. Two implementations:
  `store.supabase.ts` (real) and `store.demo.ts` (localStorage sample data, used only when the
  `VITE_SUPABASE_*` variables are missing; shows a warning banner).
- `src/lib/age.ts` — dates, age, mid-parental height (unit-tested).
- `src/lib/tags.ts` — tag colours and the starter condition list.
- `src/lib/clinical.ts` — BMI, height velocity, dose per kg, BP check, review dates, printed
  directions (unit-tested). `src/lib/medicines.ts` — starter medicine list.
- `src/pages/` — one file per screen. `src/components/` — shell, tags.
- `supabase/migrations/` — SQL, numbered, run in order. Add a new file per stage; never edit one
  that has been applied.

- `scripts/make-preview.mjs` + `npm run build:preview` — one-file demo build (sample data,
  in-memory routing) that can be published as a Claude artifact to show progress.

## Rules

- New data access goes through `Store`; add the method to both implementations.
- Supabase returns at most 1,000 rows per request: search and filter on the server, never by
  loading every patient.
- Calculated clinical values (SDS, velocity, mg/kg/day) must come from published reference
  tables (IAP 2015 for 5–18 y, WHO for under 5), each with a unit test. The design mockup's
  centile curves were approximations and must not be copied.
- Touch targets at least 44 px; every screen must work at phone width without sideways scroll.
- Verify before pushing: `npm run build`, `npm test`, and click through the changed screens.
  Stage 1's database code was tested against a local Postgres + PostgREST, including that a
  second account can neither read nor change the first account's rows.

## Stage 2 notes

- A visit's prescription is a JSON array on the `visits` row (`medicines`), saved with the visit
  in one write. Stage 7's export flattens it in the browser.
- Height velocity uses the most recent earlier height at least 85 days old; shorter gaps are
  skipped. Dose per kg is per dose, and only when the dose reads as one number and a unit.
- Starter medicines leave weight-based doses blank on purpose; the doctor fills them in.
- Row-level security checks both ends of a link: a visit or tag link must point at the signed-in
  doctor's own patient. Keep that pattern for every new child table.
- Printing uses `window.print()` with `@page` A4 and the `.sheet` layout in `styles.css`; the
  artifact preview cannot print, so `PrintRx` hides the button when `VITE_PREVIEW` is set.

## Build order

1. ~~Sign-in, patients, condition tags, search~~ (done)
2. ~~Visit and prescription: measurements, notes, medicines, templates, A4 print~~ (done)
3. Investigations: grouped master list, one-click panels, result entry
4. Growth: reference tables, SDS and velocity, chart
5. Tanner staging per visit
6. Photographs on Google Drive, compare view
7. Excel export per condition group; backup
8. Trial run alongside the current system

The clickable design for all screens is a Claude design canvas titled "Pediatric Endocrine EMR".
