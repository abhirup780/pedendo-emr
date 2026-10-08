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
- Verify before pushing: `npm run lint`, `npm run build`, `TZ=Asia/Kolkata npm test`,
  `npm run test:db`, and click through the changed screens (Playwright + the built app).
- `tests/contract.ts` is the single list of what a `Store` must do. It runs against the demo
  store (`npm test`) and the Supabase store (`npm run test:db`, local Postgres + PostgREST,
  two accounts). Every new `Store` method gets a case there, so the demo cannot drift.
- Give each screen that holds unsaved input a `key` from its route params (see `VisitPage`),
  or state leaks from one record to the next.

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

## Stage 3 notes

- Investigations advised at a visit are a JSON array of names on the `visits` row; results are
  rows in `results`, keyed to the patient (not the visit) because reports arrive later.
- A result's value is text ("142", "<0.1", "7y 6m") and its low/high flag is set by the doctor
  against the reporting lab's range. The app holds no reference ranges and must not invent any.
- `src/lib/investigations.ts` holds the starter list, panels, `bestMatch` (what Enter adds) and
  `latestPerTest`. Starter units are common ones only and stay editable per result.
- `components/Results.tsx` is deliberately not a `<form>`: it sits inside the visit form. The
  visit form also blocks Enter-in-a-text-box from saving the visit.

## Stage 5 notes

- Staging is one JSON object on the visit (`tanner`), null when not staged. Rules live in
  `src/lib/tanner.ts`: onset is genital stage 2 or a testis of 4 mL in boys, breast stage 2 in
  girls; pubic hair alone never decides. The early/late prompt uses 8/13 years (girls) and
  9/14 years (boys) and is worded as "consider", never as a diagnosis.
- The tiles are schematic pictograms built from plain shapes in CSS (`TannerPicker.tsx`).

## Stage 7 notes

- `src/lib/export.ts`: `buildSheets` is pure and unit-tested; `toWorkbook` writes the .xlsx with
  `write-excel-file` (loaded on demand). Dates are written as midnight UTC, otherwise Excel
  shows them a day early in India. Run the tests under `TZ=Asia/Kolkata` after touching dates.
- De-identified exports replace name and MRN with a study ID (MRN order within that export) and
  drop date of birth, guardian, phone and address. Visit dates are kept.
- `store.dump()` pages through Supabase 1,000 rows at a time (tested with 2,300 visits).
- Backup (`src/lib/backup.ts`) is one JSON file of everything except photographs. There is no
  restore screen yet; the "last backup" note is per browser, a reminder only.
- The artifact preview cannot download files, so the Registry builds the file and says so.

## Stage 6 notes

- `src/lib/photofiles.ts`: `PhotoFiles` interface with a Google Drive implementation (Google
  Identity Services token in memory, `drive.file` scope, one-hour tokens, reconnect on 401) and
  an in-memory demo one. `driveClient` takes `fetch` as a parameter so it is testable.
- Images are resized to 1600 px and re-encoded as JPEG in the browser (`src/lib/image.ts`),
  which also strips camera metadata. The database row holds the Drive file ID, never the image.
- Consent is two columns on `patients`, read and written through `getPhotoConsent` /
  `setPhotoConsent`, deliberately outside the `Patient` type. Uploading is blocked without it.
- Deleting a photo moves the Drive file to the bin. Deleting a patient removes the records but
  leaves the Drive files; nothing cleans those up yet.
- Demo photos and consent are memory-only and vanish on reload.

## Growth chart notes

- `src/lib/growth-reference.ts` is EMPTY on purpose; its header documents the table format.
  Fill it only from numbers the owner supplies from the published sources. Never from memory.
- `src/lib/growth.ts`: `sds()` returns null until a table with L, M, S covers the age, and the
  UI then shows "needs the reference tables". `checkReference` runs in the tests on every table.
- `components/GrowthChart.tsx` draws centile curves when a table is present. That path has only
  been exercised by unit tests on the maths, not by eye: look at it when the first table lands.

## Audit round (after stage 7)

- `supabase/migrations/0007`: a trigger keeps `last_visit_on`, `next_review_on`, `visit_count`
  on each patient; the patient list sorts and filters on them ("overdue" = review date passed
  and no visit since). The demo store computes the same in `withSummary`.
- `0008`: `sync_patient_mrn_sequence()` for restore. `0009`: letterhead logo and signature as
  small data URLs on `clinic_settings`.
- `src/lib/backup.ts`: `parseBackup` validates a file before `store.restore`, which refuses
  unless the account has no patients and empties it again if it fails part-way.
- `src/lib/device.ts`: idle sign-out minutes, visit drafts (sessionStorage, cleared on a
  deliberate sign-out, kept on idle sign-out), one-off sign-in notices.
- `friendly()` in `store.supabase.ts` rewords database errors; UI code still matches
  `/duplicate key/` for unique violations, so leave that message alone.
- Timestamps are shown with `localDate()`; plain dates never go through `new Date(string)`.
- `public/_headers`: security headers for Cloudflare Pages. The CSP is report-only until the
  owner's trial run shows a clean console with live Google sign-in and Drive.
- An axe-core scan (wcag2a/aa + best-practice) was clean on every screen; keep it that way.

## Print layouts

- A print layout is plain data (`PrintConfig` in `src/lib/printlayout.ts`): paper size, margins
  (first page and later pages separately, for pre-printed pads), type size and spacing, accent
  colour, optional side column, the ordered list of sections with show / space-above / side,
  and per-section options. `normalize()` brings any stored config to the current shape and
  clamps it; both stores call it on read and write. Adding an option = add it to the type,
  `STANDARD`, `normalize`, the editor and `RxSheet`; old saved layouts then keep working.
- `components/RxSheet.tsx` is the only thing that draws a prescription: the print screen, the
  sample page (`/print-sample/:layoutId`) and the editor's live preview all use it.
- The page size and margins go to the browser as an injected `<style>` from `pageCss()`
  (`@page` + `@page :first`). Margins belong to the page, not the sheet, so later pages keep
  them. `--inner-h` keeps a one-page prescription's signature at the foot without a blank page.
- Layouts live in `print_layouts` (migration 0010), at most one default per account; each
  device also remembers the layout it last printed with (`rememberLayout`), which wins.
- Check a layout change by printing to PDF with Playwright (`prefer_css_page_size=True`) and
  looking at the pages; wait for `.sheet-wrap .sheet`, not `.sheet` (the editor preview has one).

## Phones and tablets

- One breakpoint: `@media (max-width: 700px)` at the end of `styles.css`, plus
  `@media (pointer: coarse)` for 16px form fields on any touch screen (smaller text makes
  iPhones and iPads zoom the page when a field is tapped).
- On a phone: the header is one row; the patient list and visit history turn from table rows
  into cards by CSS grid areas (cell order in the markup matters: check `nth-child` rules
  before adding a column); chip rows and tabs scroll sideways; `.actions` bars stick to the
  foot of long forms; the investigation list starts folded; the print layout editor's preview
  opens as a full-screen panel.
- `components/FitSheet.tsx` shrinks a prescription sheet as a whole to fit the screen (CSS
  `zoom`), so the phone preview is the true layout; `@media print` cancels the shrink. A PDF
  printed from a phone-sized window was pixel-identical to one from a desktop window.
- `GrowthChart` lays itself out for the width it gets (fewer ticks, shorter axes) instead of
  scaling the picture down.
- `.wide-only` / `.narrow-only` swap long and short labels.
- Check with Playwright at 390 px (`is_mobile`, `has_touch`), 820 px and desktop: no sideways
  page scroll on any screen, no form field under 16px on touch, axe clean at both widths.

## Build order

1. ~~Sign-in, patients, condition tags, search~~ (done)
2. ~~Visit and prescription: measurements, notes, medicines, templates, A4 print~~ (done)
3. ~~Investigations: grouped master list, one-click panels, result entry~~ (done)
4. Growth: chart frame done (child's own points, velocity, MPH). STILL WAITING for the owner to
   supply the published reference tables; then fill `src/lib/growth-reference.ts`
5. ~~Tanner staging per visit~~ (done)
6. ~~Photographs on Google Drive, compare view~~ (done; Drive calls unit-tested with a stand-in, never run against Google)
7. ~~Excel export per condition group; backup~~ (done, with restore; backup is a downloaded file, not yet sent to Drive)
8. Trial run alongside the current system — checklist in `docs/SETUP.md`

The clickable design for all screens is a Claude design canvas titled "Pediatric Endocrine EMR".
