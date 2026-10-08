# Pediatric Endocrinology EMR

Patient records and prescription writing for a single pediatric endocrinologist.
A web app: the doctor signs in with a dedicated Google account from any browser.

**Status** — built: sign-in, patients, condition tags, visits, prescriptions with A4 ℞ print,
investigations and results, Tanner staging, photographs on Google Drive, Excel export and
backup. Waiting: growth chart reference tables (the chart plots the child's own points).
Not yet tried against the real services: Google sign-in and Google Drive.

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

## Photographs on Google Drive (optional, once)

Photographs are stored in the clinic's Google Drive, in a folder called "PedEndo EMR
photographs" with one subfolder per patient. The app asks only for permission to use files it
created itself. This part could not be tested against Google from the development machine, so
try it with a test image first.

1. In the same Google Cloud project as the sign-in, enable the **Google Drive API**.
2. On the OAuth consent screen, add the scope `.../auth/drive.file`.
3. On the OAuth client, add the app's address (and `http://localhost:5173` for local work)
   under *Authorised JavaScript origins*.
4. Put the client ID in `VITE_GOOGLE_CLIENT_ID` (see `.env.example`) and redeploy.

Use a dedicated clinic Google account with two-step verification, and never share the folder.

## Deploy

Any static host works. On Cloudflare Pages: connect this repository, build command
`npm run build`, output directory `dist`, and add the two `VITE_` variables under
environment variables. `public/_redirects` makes page refreshes work.

## Never commit

Secrets (`.env*`), patient exports, backups or photographs. `.gitignore` blocks the usual names.
