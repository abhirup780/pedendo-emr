# Guideline protocols

One JSON file per group of conditions. Each holds, for every condition, the investigations to
advise (in named sets, with when to do them), the medicines used, advice lines for families,
and the guideline each item was taken from. `npm run build:protocols` turns them into
`src/lib/protocol-data.ts`.

## Status: DRAFT, not yet reviewed by the doctor

The content was compiled by an automated research pass on the date in each file
(`compiled_on`). Rules it worked to:

- Nothing from memory: every medicine, dose and investigation had to be supported by a source
  opened during the research, Indian guidelines first (ISPAE, IAP), international otherwise.
- Every dose carries a supporting quote and URL. Where no dose could be read from a source the
  medicine is marked `"verified": false` and the app shows no dose guide for it.
- Doses are written as the guideline writes them. Nothing is converted or computed.

Known limits (see each condition's `caveats` and the file's `not_found` list):

- Sources were read through a summarising web reader, so "quotes" must be checked against the
  original documents. Some papers could be read only as abstracts (ISPAE 2018), and the IAP
  hyperthyroidism guideline only through a published summary.
- Tablet strengths are from an Indian drug index, not from a formulary.

## What the app does with it

- A patient's condition tags pick the protocols (by the tag's name, or by links set under
  Settings, Condition tags). Their investigation sets, medicines and advice lines are then
  offered first on the visit screen. Nothing is added unless the doctor picks it.
- A protocol medicine goes onto the prescription with the DOSE BLANK. The guideline's dose
  wording is shown under the medicine as a guide with its source. It is never printed and the
  app never works out a dose.
- Settings, Protocols shows everything here in readable form for review.

## Files

| File | Conditions | Compiled |
| --- | --- | --- |
| `thyroid.json` | Congenital hypothyroidism; acquired hypothyroidism; Graves disease / hyperthyroidism | 2026-10-08 |

Still to research: diabetes, growth, adrenal, puberty, bone and mineral, obesity, water balance.

## Adding or correcting

Edit the JSON (keep `source_ids`, `quote` and `url` for every dose), run
`npm run build:protocols`, then `npm test`: the tests refuse a medicine with a dose on the
prescription, a dose guide without a source, or a citation to a source that is not listed.
When the doctor has checked a file against the originals, change its `review` line to say so,
with the date and who checked.
