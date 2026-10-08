# Pediatric Endocrinology EMR

Patient records and prescription writing for a single pediatric endocrinologist.
A web app: the doctor signs in with a dedicated Google account from any browser.

**Status** — built: sign-in, patients with follow-up tracking, condition tags, visits with draft
recovery, prescriptions with A4 ℞ print, investigations and results, Tanner staging, photographs
on Google Drive, Excel export, backup and restore. Waiting: growth chart reference tables (the
chart plots the child's own points). Not yet tried against the real services: Google sign-in
and Google Drive.

## Run it

```
npm install
npm run dev
```

With no settings file the app opens in **demo mode**: sample patients kept only in
that browser. It is for trying the screens, never for real patients.

`npm run build:preview` writes `dist-preview/preview.html`, the whole demo as one file, for
sharing a clickable preview without any hosting.

Checks: `npm run build` (type-check and build), `npm test`, `npm run lint`.

## Going live

`docs/SETUP.md` is the step-by-step guide: database, Google sign-in, hosting, first-run
settings, photographs, backups and the trial-run checklist.

## Tests

- `npm test` — unit tests, plus the store contract run against the demo store.
- `npm run test:db` — the same contract against the real Supabase store, talking to a throwaway
  local Postgres + PostgREST with every migration applied (needs PostgreSQL installed). It also
  proves a second account can neither read nor change the first account's records.
- GitHub runs both on every push (`.github/workflows/ci.yml`).

## Never commit

Secrets (`.env*`), patient exports, backups or photographs. `.gitignore` blocks the usual names.
