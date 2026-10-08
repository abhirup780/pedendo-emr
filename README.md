# AuxoEMR

Patient records and prescription writing for a single pediatric endocrinologist.
A web app: the doctor signs in from any browser with an email, a password and (optionally) an
authenticator-app code. Everything is held in one free Supabase project.

**Status** — built: sign-in, patients with follow-up tracking, condition tags, visits with draft
recovery, prescriptions with customisable print layouts (any paper, pre-printed pads), investigations and results, Tanner staging, photographs
in Supabase Storage, Excel export, backup and restore, growth charts and SDS (WHO 2006 under 5 years,
IAP 2015 from 5 to 18 years; sources and checks in `reference-data/README.md`). Sign-in is tested against Supabase's own auth server run locally. Not yet tried against
the real project: photograph storage (its access rules are tested, the upload itself is not).

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

`docs/SETUP.md` is the step-by-step guide: database, sign-in, hosting, first-run
settings, photographs, backups and the trial-run checklist.

## Tests

- `npm test` — unit tests, plus the store contract run against the demo store.
- `npm run test:db` — the same contract against the real Supabase store, talking to a throwaway
  local Postgres behind PostgREST and Supabase's own auth server, with every migration applied
  (needs PostgreSQL installed). Both accounts sign in with a real email and password; the
  authenticator-app step is tested end to end. It also
  proves a second account can neither read nor change the first account's records.
- GitHub runs both on every push (`.github/workflows/ci.yml`).

## Never commit

Secrets (`.env*`), patient exports, backups or photographs. `.gitignore` blocks the usual names.
