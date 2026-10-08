# Growth reference tables

These files are the published numbers the app's growth chart and SDS are built from. They are
reference tables only: no patient data. `npm run build:growth` turns them into
`src/lib/growth-data.ts` without changing a digit, and the unit tests re-read these files and
hold the app to them.

| File | What it is | Taken from |
| --- | --- | --- |
| `who2006-lhfa-boys.csv`, `who2006-lhfa-girls.csv` | WHO Child Growth Standards 2006, length/height-for-age, one row per day of age from 0 to 1856, with L, M, S and WHO's own SD columns (−4 to +4) | WHO expanded z-score tables (`lhfa-boys/girls-zscore-expanded-tables.xlsx`) |
| `iap2015-lms.csv` | IAP 2015 L, M, S for height, weight and BMI, boys and girls, one row per month from 5 to 18 years | Sheet `IAP15` of the IAP growth and SDS calculator workbook (Khadilkar group) |
| `iap2015-paper-tables.csv` | The centile tables printed in the paper (Tables II–VII), half-yearly. `c1…c7` are the seven printed columns in order. Height and weight rows check the L, M, S above; the BMI rows are what the BMI chart draws | Khadilkar V et al. Revised IAP growth charts for height, weight and body mass index for 5- to 18-year-old Indian children. Indian Pediatrics 2015;52:47-55 (indianpediatrics.net/jan2015/jan-47-55.htm) |

The three workbooks were copied from `growth-source/` in the owner's repository
`abhirup780/drsayan-web` (commit `13c7f9f`). SHA-256 of the workbooks they were read from:

```
a1e395ccd2be26d9cec3b99a94977ae27e6a30e1c334d9851cf40d2dccbab2b7  iap-2015-growth-sds-calculator.xlsx
c4b1c9029ab9751a5f0888e32f35c7c0287a16d361885cf911ecf23b3f7f6b4f  who-lhfa-boys-zscore-expanded.xlsx
6aa2876319449a6b1f4d825848128902114ff53c67b92b86a0c5140846013059  who-lhfa-girls-zscore-expanded.xlsx
```

The workbooks themselves are not kept here: the IAP one also carries thousands of rows of
example measurements, which do not belong in this repository.

## What was checked (and is re-checked by `npm test`)

**WHO.** L is 1 on every day. M × (1 + S × z) reproduces all nine of WHO's printed SD columns
on all 1857 days for both sexes to within 0.0005 cm, which is the rounding of the printed
value. The app looks the table up by the child's exact age in days, so nothing is interpolated.
The table drops by about 0.67 cm between day 730 and day 731, where WHO changes from recumbent
length to standing height; the app keeps that step and never draws a line across it.

**IAP height and weight.** The L, M, S from the calculator reproduce the 756 values
printed in the paper's height and weight tables to within 0.051 (they are printed to 0.1; 754
round to the printed digit exactly and two girls' weights sit a hair past the half) — but
only when the seven columns are read as −2, −1⅓, −⅔, 0, +⅔, +1⅓ and +2 SD. The paper and the
printed charts head those columns 3, 10, 25, 50, 75, 90 and 97. The exact 3rd and 97th centiles
(±1.88 SD) would be up to 1 cm and 2.4 kg away from the printed lines. So on the IAP chart the
"3rd centile" line is the −2 SD line, and the app draws it there and labels it as IAP does.

**IAP BMI.** The owner's instruction: follow the paper as closely as possible; the SDS from
the calculator are genuine. So the two are kept apart:

- *Chart lines and overweight/obesity* come straight from the paper's printed BMI tables
  (Tables VI and VII): the 3rd, 5th, 10th, 25th and 50th centiles and the "23 adult equivalent"
  and "27 adult equivalent" lines, half-yearly, joined by straight lines. A BMI at or above
  the 23 line is shown as "overweight range", at or above the 27 line as "obese range", as the
  paper recommends. The tables were transcribed from the journal's web page twice,
  independently, and the two copies were identical.
- *BMI SDS* comes from the calculator's L, M, S, exactly as the IAP calculator gives it.

The two are close but not the same fit: the calculator's L, M, S put the centile lines within
0.22 kg/m² of the printed ones. The calculator's own SDS cut-offs for overweight and obesity
(boys 0.55 and 1.34, girls 0.67 and 1.64) are not used: its boys' obesity cut-off runs up to
0.62 kg/m² above the paper's printed 27 line.

## Choices that are the app's, not the tables'

- **Age between two months (IAP).** The calculator uses the row for the last completed month.
  The app takes L, M and S in proportion between the two neighbouring months, so SDS does not
  jump on the day a month completes. Given the same L, M and S the two give the same SDS; in
  between months the calculator can read up to 0.1 SDS higher for height, 0.08 for weight and
  0.03 for BMI (a child late in the month is compared with slightly younger children). The
  calculator also matches ages against its three-decimal printed ages, which moves some
  month boundaries by a fraction of a day.
- **Decimal age** is whole days ÷ 365.25. WHO applies under 5.0 years (up to day 1826), IAP
  from then to 18.0 years (the 18th birthday itself always counts as 18.0). Nothing is shown
  outside the published ages. On the fifth birthday itself most children are still on day
  1826, so height uses WHO and weight and BMI start the next day.
- **Under 2 years** the WHO table assumes recumbent length, from 2 years standing height. The
  app has one height box per visit and assumes the child was measured the standard way for
  their age.
- **Not held:** WHO weight-for-age and BMI-for-age under 5 years (not supplied), so weight and
  BMI have no SDS before the fifth birthday. No correction is made for prematurity.
