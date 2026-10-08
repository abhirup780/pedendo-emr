# Going live: one-time setup

About half an hour, in this order. Menu names in these consoles change from time to time; the
steps are what matter. Everything lives in one free Supabase project: the records, the sign-in
and the photographs. No Google Cloud Console is needed.

## 1. Database (Supabase)

1. Create a free project at supabase.com. Choose the Mumbai region.
2. Open the SQL editor. Run every file in `supabase/migrations/` **in number order**, from
   `0001` to the highest, pasting each (or all of them, in order, in one go) and pressing Run.
   Each should finish with "Success". A file that has been run is never run again; when the
   app is updated, only the new, higher-numbered files are run.
3. From Project settings → API, note the **Project URL** and the **anon public key**. Never
   use or share the `service_role` key.

## 2. The doctor's account

1. In Supabase → Authentication → Sign In / Providers → Email, switch **off** "Allow new users
   to sign up" (it may be under Authentication → Settings). The database already keeps each
   account's rows private; this stops anyone else creating an account at all.
2. In Authentication → Users, press **Add user → Create new user**. Enter the clinic's email
   address and a long password (three or four unrelated words), and tick **Auto Confirm User**.
   The email is only a sign-in name: no message is ever sent to it.
3. Keep the password in a password manager or written down somewhere safe.

## 3. Put the app online (Cloudflare Pages)

1. In Cloudflare → Workers & Pages → Create application, follow the small "Looking to deploy
   Pages?" link at the foot of the screen (the main choices there make a Worker instead) and
   connect this GitHub repository. Framework preset None, build command `npm run build`, build
   output directory `dist`.
2. Add these under Environment variables. They are read while the app is being built, so
   after changing one, deploy again:

   | Name | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | the Project URL |
   | `VITE_SUPABASE_ANON_KEY` | the anon public key |
   | `VITE_ALLOWED_EMAIL` | the clinic email address from step 2 (optional; leave it out if more than one account signs in) |

3. Deploy, open the `pages.dev` address, and sign in with the email and password. Open a
   patient and reload the page: it should come back, not "not found".
4. Own address (optional; the live app is at `emr.drsayan.in`). In the Pages project → Custom
   domains, add the address. Then, where the domain's DNS is kept (GoDaddy for `drsayan.in`),
   add one record: type CNAME, name `emr`, value the project's `pages.dev` address. Nothing
   else on the domain changes. Cloudflare first, the DNS record second.

After an update, a browser that had the app open may show the old copy until a hard reload
(Ctrl+Shift+R).

No `public/_redirects` file is needed: Pages sends unknown addresses to the app by itself.
Use Pages, not a Worker: a Worker takes a custom address only when the whole domain's DNS is
moved to Cloudflare.

## 4. Lock the door

1. In the app, open **Settings → Sign-in** and press **Set up an authenticator app**. Scan the
   square with Google Authenticator, Microsoft Authenticator or a similar app on the doctor's
   phone, and type the code. From then on every sign-in needs the password and the code, and
   the database itself refuses a sign-in that did not give the code. Other devices that were
   signed in are signed out and ask for the code next time.
2. The same screen changes the password. That also signs the other devices out.
3. In Supabase → Authentication, leave "Secure password change" off (it is off by default; it
   works by email, which this setup does not use).

**Forgotten password.** Supabase → Authentication → Users → the user's menu → reset or set a
new password. (The "forgot password" email is not used: the free plan sends very few emails.)

**Lost phone.** Nobody, including the doctor, can sign in without the code, so the
authenticator has to be removed from the Supabase side; the password then works alone again
and the new phone is set up in the app. In Supabase → Authentication → Users, open the user's
menu and remove their MFA factors if that choice is offered. If it is not, run this in the SQL
editor, with the clinic email in place of the example:

```sql
delete from auth.mfa_factors
where user_id = (select id from auth.users where email = 'clinic@example.com');
```

## 5. First run in the app

The patient list shows a "Still to set up" card until these are done. The cross beside a line
hides that reminder on this device for good, the backup reminder included:

- **Settings → Letterhead**: doctor and clinic details, optional logo and signature.
- **Settings → Print layouts**: one layout for each paper or pre-printed pad. Measure the pad's
  printed header and footer with a ruler, enter them as the top and bottom margins, then use
  "Save and print a sample" on a real sheet with margin guides on, and adjust.
- **Settings → Condition tags, Medicines, Investigations**: each offers a starter list. Review
  the starter medicines' default directions and the investigation panels before relying on them.
- **Settings → This device**: how long before the app signs itself out when left untouched.

## 6. Photographs (optional)

Nothing more to set up: migration `0013` made a private place for them in the same Supabase
project. Try it with a test image before a real one.

- The free plan holds **1 GB** of files, about 3,000 photographs at the size the app stores.
- Deleting a photograph, or a patient, erases the files for good. There is no bin.
- Files are private: each can be opened only by the signed-in account that added it.

## 7. Backups

The free database plan keeps **no backups**. On Registry & export → Backup, download the full
backup at least weekly and keep the file somewhere other than the clinic computer. The same
screen can restore a backup into an empty account.

Photograph files are not in that backup, and the photograph store keeps no backups either.
On the same screen, **Download all photographs** saves one zip file with a folder per patient;
do it whenever new photographs matter. There is no "restore photographs" yet: after a restore
into a new project the photograph records remain but their pictures would have to be added
again from the zip.

A free Supabase project is also **paused after a week with no use**. After a long break, open
the Supabase dashboard and press Restore.

## 8. Trial run

Before relying on the app, run it beside the current system for two weeks. Things that could
not be tried during development and need a look on the live site:

- [ ] Sign-in works with the email and password; a wrong password is turned away; after the
      authenticator app is set up, a sign-in on another device asks for the code.
- [ ] Settings → Sign-in shows "On" with no warning that the database is not checking the code.
- [ ] A patient, a visit and a result save and reappear after signing out and in.
- [ ] A prescription prints correctly on each clinic's printer and pad (try a two-page one). In
      the print window: the same paper size as the layout, margins "Default", scale 100%.
- [ ] A photograph uploads, shows again after a reload, and can be deleted. (Photograph
      storage is the one part never run against the real service during development.)
- [ ] "Download all photographs" gives a zip that opens, with the test image inside.
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
