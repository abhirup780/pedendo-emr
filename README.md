# Pediatric Endocrinology EMR

Patient records and prescription writing for a single pediatric endocrinologist.
A web app: the doctor signs in with a dedicated Google account from any browser.

**Status: stage 3 of 8** — sign-in, patient records, condition tags, visits with measurements
and notes, prescription writing with a medicine list and templates, A4 ℞ print, a grouped
investigation list with one-tap panels, and result entry.

## Run it

```
npm install
npm run dev
```

With no settings file the app opens in **demo mode**: sample patients kept only in
that browser. It is for trying the screens, never for real patients.

`npm run build:preview` writes `dist-preview/preview.html`, the whole demo as one file, for
sharing a clickable preview without any hosting.

Checks: `npm run build` (type-check and build), `npm test` (unit tests), `npm run lint`.

## Connect the real database (once)

Menu names in these consoles change from time to time; the steps are what matter.

1. **Supabase** — create a free project (choose the Mumbai region). Open the SQL editor and
   run every file in `supabase/migrations/` in order.
2. **Google Cloud** — create a project, configure the OAuth consent screen as *External* and
   publish it to *In production* (in *Testing* the sign-in expires every 7 days). Create an
   OAuth client of type *Web application* with this authorised redirect URI:
   `https://YOUR-PROJECT.supabase.co/auth/v1/callback`
3. **Supabase → Authentication** — enable the Google provider with that client ID and secret.
   Set the Site URL to the address the app is served from.
4. **Settings for the app** — copy `.env.example` to `.env.local` and fill in the project URL
   and anon key (Supabase → Project settings → API).
5. **Lock the door** — after the doctor has signed in once, turn off *Allow new users to sign
   up* in Supabase Authentication settings. Row-level security already keeps each account's
   rows private; this stops strangers creating accounts at all.

## Deploy

Any static host works. On Cloudflare Pages: connect this repository, build command
`npm run build`, output directory `dist`, and add the two `VITE_` variables under
environment variables. `public/_redirects` makes page refreshes work.

## Never commit

Secrets (`.env*`), patient exports, backups or photographs. `.gitignore` blocks the usual names.
