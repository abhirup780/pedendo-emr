import { IAP_BMI_PRINTED, IAP_LMS, WHO_LHFA } from './growth-data'
import type { Sex } from './types'

/**
 * Which published reference applies to a child of a given age, and its L, M and S there.
 *
 *   Under 5 years   WHO Child Growth Standards 2006, length/height-for-age. Looked up by the
 *                   child's exact age in days, as WHO publishes it: nothing is interpolated.
 *                   Recumbent length to day 730, standing height from day 731 (WHO builds a
 *                   0.7 cm drop into the table there).
 *   5 to 18 years   IAP 2015 (Khadilkar V et al., Indian Pediatrics 2015;52:47-55) for height,
 *                   weight and BMI. Published by month of age; between two months L, M and S
 *                   are taken in proportion.
 *
 * Weight and BMI have no reference under 5 years here (the WHO weight and BMI tables have not
 * been supplied) and nothing has one after 18 years. In those cases the answer is null and the
 * screens say so. Nothing is extended beyond the published ages.
 *
 * The numbers live in growth-data.ts, generated from reference-data/*.csv. Never type a
 * reference value by hand: change the CSV and run `npm run build:growth`.
 */
export type Measure = 'height' | 'weight' | 'bmi'
export type RefId = 'who2006' | 'iap2015'

export const DAYS_PER_YEAR = 365.25
/** WHO's last day of recumbent length; standing height starts the day after. */
export const WHO_LAST_LENGTH_DAY = 730
export const IAP_FROM_YEARS = 5
export const IAP_TO_YEARS = 18

export const REFS: Record<RefId, { short: string; label: string; source: string }> = {
  who2006: { short: 'WHO 2006', label: 'WHO 2006 standard', source: 'WHO Child Growth Standards 2006, length/height-for-age, birth to 5 years' },
  iap2015: { short: 'IAP 2015', label: 'IAP 2015 reference', source: 'IAP growth charts 2015, 5 to 18 years. Khadilkar V et al., Indian Pediatrics 2015;52:47-55' },
}

export interface RefPoint {
  L: number
  M: number
  S: number
  ref: RefId
  /** WHO only: whether the table at this age is for a child measured lying down or standing. */
  posture?: 'length' | 'height'
}

/** WHO length/height-for-age on one day of age (a whole number, 0 to 1856). */
export function whoHeightAt(sex: Sex, day: number): RefPoint | null {
  const t = WHO_LHFA[sex]
  if (!Number.isInteger(day) || day < 0 || day >= t.M.length) return null
  return { L: 1, M: t.M[day], S: t.S[day], ref: 'who2006', posture: day <= WHO_LAST_LENGTH_DAY ? 'length' : 'height' }
}

/** IAP 2015 at an age in years, 5 to 18 inclusive. */
export function iapAt(sex: Sex, measure: Measure, years: number): RefPoint | null {
  const t = IAP_LMS[measure][sex]
  // The table is by month, so work in months since the fifth birthday. The rounding only
  // removes binary noise such as 11.999999999 for an age given as 6.0.
  const m = Math.round((years - IAP_FROM_YEARS) * 12 * 1e9) / 1e9
  if (!(m >= 0) || m > t.M.length - 1) return null
  const i = Math.min(Math.floor(m), t.M.length - 2)
  const k = m - i
  const mix = (a: number[]) => a[i] + (a[i + 1] - a[i]) * k
  return { L: mix(t.L), M: mix(t.M), S: mix(t.S), ref: 'iap2015' }
}

/** The reference for a child `ageDays` old (whole days since birth); null when none applies. */
export function referenceAt(sex: Sex, measure: Measure, ageDays: number): RefPoint | null {
  if (!Number.isInteger(ageDays) || ageDays < 0) return null
  const years = iapYears(ageDays)
  if (years < IAP_FROM_YEARS) return measure === 'height' ? whoHeightAt(sex, ageDays) : null
  return iapAt(sex, measure, years)
}

/** The last whole day that counts as under 5 years (4.9993 years). */
export const WHO_LAST_DAY = Math.floor(IAP_FROM_YEARS * DAYS_PER_YEAR)
/** The last whole day that counts as 18 years: a child's 18th birthday is day 6574 or 6575. */
export const IAP_LAST_DAY = Math.ceil(IAP_TO_YEARS * DAYS_PER_YEAR)

/**
 * Age in years for choosing and reading the references. It is days ÷ 365.25, except that the
 * 18th birthday always counts as 18.0: depending on leap years it falls on day 6574 or 6575,
 * and 6575 ÷ 365.25 is 18.001, which would put the last row of the table out of reach.
 * (At 5 years no such allowance is needed for height: day 1826 is in the WHO table.)
 */
export function iapYears(ageDays: number): number {
  return ageDays === IAP_LAST_DAY ? IAP_TO_YEARS : ageDays / DAYS_PER_YEAR
}

/** Why a measurement has no SDS, in words for the screen. */
export function noReferenceReason(measure: Measure, ageDays: number): string {
  const years = iapYears(ageDays)
  if (years > IAP_TO_YEARS) return 'no reference after 18 years'
  if (years < IAP_FROM_YEARS && measure !== 'height') return 'no reference under 5 years'
  return 'no reference at this age'
}

/* ------------------------------------------------------------------ chart lines */

export interface ChartLine {
  /** What is printed beside the line. */
  label: string
  /** Where the line sits, in SDS. Absent for lines drawn from a printed table (IAP BMI). */
  z?: number
  kind: 'mid' | 'edge' | 'inner' | 'outer' | 'cut'
}

/**
 * IAP 2015 height and weight charts: seven lines two-thirds of an SD apart, from −2 to +2 SD.
 * The charts and the paper's tables label them 3, 10, 25, 50, 75, 90 and 97; every printed
 * value in the paper's height and weight tables is reproduced at these positions (see the
 * tests), and not at the exact 3rd … 97th centiles. So the "3" line is the −2 SD line.
 */
export const IAP_HEIGHT_WEIGHT_LINES: ChartLine[] = [
  { label: '3', z: -2, kind: 'edge' },
  { label: '10', z: -4 / 3, kind: 'inner' },
  { label: '25', z: -2 / 3, kind: 'inner' },
  { label: '50', z: 0, kind: 'mid' },
  { label: '75', z: 2 / 3, kind: 'inner' },
  { label: '90', z: 4 / 3, kind: 'inner' },
  { label: '97', z: 2, kind: 'edge' },
]

/**
 * IAP 2015 BMI chart. These seven lines are not worked out from L, M and S: they are the
 * values printed in the paper's BMI tables (Tables VI and VII), half-yearly, joined by straight
 * lines. The last two are the paper's overweight and obesity cut-offs, the lines that reach an
 * adult BMI of 23 and 27. Overweight and obesity are read against these printed lines, as the
 * paper recommends, not against an SDS.
 */
export const IAP_BMI_LINES: ChartLine[] = [
  { label: '3', kind: 'edge' },
  { label: '5', kind: 'inner' },
  { label: '10', kind: 'inner' },
  { label: '25', kind: 'inner' },
  { label: '50', kind: 'mid' },
  { label: 'OW', kind: 'cut' },
  { label: 'OB', kind: 'cut' },
]
export const BMI_LINE = { third: 0, median: 4, overweight: 5, obese: 6 } as const

/** The seven printed BMI lines at an age in years (5 to 18), in proportion between half years. */
export function iapBmiPrintedAt(sex: Sex, years: number): number[] | null {
  const t = IAP_BMI_PRINTED[sex]
  const h = Math.round((years - IAP_FROM_YEARS) * 2 * 1e9) / 1e9
  if (!(h >= 0) || h > t.length - 1) return null
  const i = Math.min(Math.floor(h), t.length - 2)
  const k = h - i
  return t[i].map((v, j) => v + (t[i + 1][j] - v) * k)
}

/** WHO charts are read in whole SDs. */
export const WHO_SD_LINES: ChartLine[] = [
  { label: '−3', z: -3, kind: 'outer' },
  { label: '−2', z: -2, kind: 'edge' },
  { label: '−1', z: -1, kind: 'inner' },
  { label: '0', z: 0, kind: 'mid' },
  { label: '+1', z: 1, kind: 'inner' },
  { label: '+2', z: 2, kind: 'edge' },
  { label: '+3', z: 3, kind: 'outer' },
]
