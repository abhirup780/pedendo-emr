# Going live: one-time setup

About an hour, in this order. Menu names in these consoles change from time to time; the steps
are what matter. Do it all signed in to the **dedicated clinic Google account**, with two-step
verification switched on for that account first.

## 1. Database (Supabase)

1. Create a free project at supabase.com. Choose the Mumbai region.
2. Open the SQL editor. Run every file in `supabase/migrations/` **in number order**, one at a
   time, from `0001` to the highest. Each should finish with "Success".
3. From Project settings → API, note the **Project URL** and the **anon public key**.

## 2. Google sign-in

1. In Google Cloud Console create a project. Configure the OAuth consent screen as *External*.
2. **Publish the app to "In production".** Left in "Testing", the sign-in expires every 7 days.
3. Create an OAuth client of type *Web application*:
   - Authorised redirect URI: `https://YOUR-PROJECT.supabase.co/auth/v1/callback`
   - Authorised JavaScript origins: the address the app will be served from (add
     `http://localhost:5173` too if you will run it locally).
4. In Supabase → Authentication → Providers, enable Google with that client ID and secret.
5. In Supabase → Authentication → URL configuration, set the Site URL to the app's address.

## 3. Put the app online (Cloudflare Pages)

1. Connect this GitHub repository. Build command `npm run build`, output directory `dist`.
2. Add environment variables:

   | Name | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | the Project URL |
   | `VITE_SUPABASE_ANON_KEY` | the anon public key |
   | `VITE_ALLOWED_EMAIL` | the clinic Google account's address |
   | `VITE_GOOGLE_CLIENT_ID` | the OAuth client ID (only needed for photographs) |

3. Deploy, open the address, and sign in with the clinic account.

## 4. Lock the door

After that first sign-in, in Supabase → Authentication turn **off** "Allow new users to sign
up". The database already keeps each account's rows private; this stops anyone else creating
an account at all. `VITE_ALLOWED_EMAIL` is a convenience on top, not the lock.

## 5. First run in the app

The patient list shows a "Still to set up" card until these are done:

- **Settings → Letterhead**: doctor and clinic details, optional logo and signature.
- **Settings → Print layouts**: one layout for each paper or pre-printed pad. Measure the pad's
  printed header and footer with a ruler, enter them as the top and bottom margins, then use
  "Save and print a sample" on a real sheet with margin guides on, and adjust.
- **Settings → Condition tags, Medicines, Investigations**: each offers a starter list. Review
  the starter medicines' default directions and the investigation panels before relying on them.
- **Settings → This device**: how long before the app signs itself out when left untouched.

## 6. Photographs (optional)

1. In the same Google Cloud project, enable the **Google Drive API**.
2. On the OAuth consent screen add the scope `.../auth/drive.file` (the app can then use only
   the files it creates itself).
3. Make sure `VITE_GOOGLE_CLIENT_ID` is set and redeploy.
4. Try it with a test image before a real one. Images go to a Drive folder called
   "PedEndo EMR photographs", one subfolder per patient. Never share that folder.

## 7. Backups

The free database plan keeps **no backups**. On Registry & export → Backup, download the full
backup at least weekly and keep the file somewhere other than the clinic computer. The same
screen can restore a backup into an empty account. Photograph files are not in the backup;
they stay in Google Drive.

A free Supabase project is also **paused after a week with no use**. After a long break, open
the Supabase dashboard and press Restore.

## 8. Trial run

Before relying on the app, run it beside the current system for two weeks. Things that could
not be tried during development and need a look on the live site:

- [ ] Google sign-in works, and a different Google account is turned away.
- [ ] A patient, a visit and a result save and reappear after signing out and in.
- [ ] A prescription prints correctly on each clinic's printer and pad (try a two-page one). In
      the print window: the same paper size as the layout, margins "Default", scale 100%.
- [ ] A photograph uploads, shows, and appears in the Drive folder.
- [ ] The Excel export opens in Excel with correct dates.
- [ ] A backup downloads. (If you ever need it: restore into a spare, empty Supabase project.)
- [ ] The browser console (F12) shows no "Content Security Policy" messages while doing all of
      the above. If it is clean, rename `Content-Security-Policy-Report-Only` to
      `Content-Security-Policy` in `public/_headers` to switch that protection on.

## Growth chart and SDS

Built in: WHO 2006 length/height-for-age under 5 years and IAP 2015 height, weight and BMI
from 5 to 18 years. Where the numbers came from and how they were checked is written up in
`reference-data/README.md`. During the trial, please also check by hand:

- [ ] Three or four children aged 5–18: height, weight and BMI SDS against the IAP calculator
      you already use. Expect agreement within about 0.1 SDS, the app equal or slightly
      lower (it uses the exact age; the calculator uses the last whole month).
- [ ] One child under 5: height SDS against WHO Anthro or the WHO chart.
- [ ] A child plotted on the paper IAP chart sits in the same place on the screen.

Not included: WHO weight and BMI under 5 years (send the WHO weight-for-age and BMI-for-age
expanded tables to add them), and correction for prematurity.
