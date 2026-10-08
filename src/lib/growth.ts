import { ageInDays } from './age'
import { bmi } from './clinical'
import { DAYS_PER_YEAR, Z_CENTILE, IAP_BMI_CUTOFFS, IAP_FROM_YEARS, IAP_HEIGHT_WEIGHT_LINES, IAP_TO_YEARS, iapAt, iapBmiLines, referenceAt, WHO_LAST_LENGTH_DAY, WHO_SD_LINES, whoHeightAt } from './growth-reference'
import type { ChartLine, Measure, RefId, RefPoint } from './growth-reference'
import type { Sex, Visit } from './types'

export const MEASURES: { key: Measure; label: string; unit: string }[] = [
  { key: 'height', label: 'Height', unit: 'cm' },
  { key: 'weight', label: 'Weight', unit: 'kg' },
  { key: 'bmi', label: 'BMI', unit: 'kg/m²' },
]

export interface GrowthPoint {
  /** Decimal years, for the horizontal axis. */
  age: number
  /** Whole days since birth: what the references are looked up by. */
  ageDays: number
  value: number
  date: string
  /** Filled in when the child's sex is given and a reference covers this age. Two decimals. */
  sds: number | null
  /** The same before rounding, for comparing with cut-offs. */
  sdsRaw: number | null
}

type Measured = Pick<Visit, 'visit_date' | 'height_cm' | 'weight_kg'>

export function measureValue(v: Pick<Visit, 'height_cm' | 'weight_kg'>, measure: Measure): number | null {
  return measure === 'height' ? v.height_cm : measure === 'weight' ? v.weight_kg : bmiExact(v.height_cm, v.weight_kg)
}

/**
 * BMI without rounding, for SDS. The BMI shown on screen is rounded to one decimal, which
 * near the median can move a BMI SDS by 0.03; the reference is applied to the true value.
 */
export function bmiExact(heightCm: number | null, weightKg: number | null): number | null {
  if (!heightCm || !weightKg || heightCm <= 0 || weightKg <= 0) return null
  return weightKg / Math.pow(heightCm / 100, 2)
}

/** The child's own measurements as (age, value) points, oldest first. */
export function growthPoints(visits: Measured[], dob: string, measure: Measure, sex?: Sex): GrowthPoint[] {
  const out: GrowthPoint[] = []
  for (const v of visits) {
    const value = measure === 'bmi' ? bmi(v.height_cm, v.weight_kg) : measureValue(v, measure)
    const days = ageInDays(dob, v.visit_date)
    if (value == null || days == null) continue
    const raw = sex ? sdsExact(measureValue(v, measure)!, sex, measure, days) : null
    out.push({ age: days / DAYS_PER_YEAR, ageDays: days, value, date: v.visit_date, sds: round2(raw), sdsRaw: raw != null && Number.isFinite(raw) ? raw : null })
  }
  return out.sort((a, b) => a.ageDays - b.ageDays)
}

/** Standard deviation score by the LMS method (Cole): ((x/M)^L − 1) / (L·S), or ln(x/M)/S when L is 0. */
export function sdsFromLms(value: number, L: number, M: number, S: number): number {
  return Math.abs(L) < 1e-9 ? Math.log(value / M) / S : (Math.pow(value / M, L) - 1) / (L * S)
}

/** The measurement that sits at a given SDS: the inverse of sdsFromLms. Draws the chart lines. */
export function valueFromLms(z: number, L: number, M: number, S: number): number {
  return Math.abs(L) < 1e-9 ? M * Math.exp(S * z) : M * Math.pow(1 + L * S * z, 1 / L)
}

/** SDS without rounding; null when no reference covers this age (or the value is not positive). */
export function sdsExact(value: number, sex: Sex, measure: Measure, ageDays: number): number | null {
  const at = value > 0 ? referenceAt(sex, measure, ageDays) : null
  return at ? sdsFromLms(value, at.L, at.M, at.S) : null
}

/** SDS to two decimals, for display. */
export function sds(value: number, sex: Sex, measure: Measure, ageDays: number): number | null {
  return round2(sdsExact(value, sex, measure, ageDays))
}

function round2(z: number | null): number | null {
  // Adding 0 turns a rounded −0 into 0.
  return z == null || !Number.isFinite(z) ? null : Math.round(z * 100) / 100 + 0
}

/** All three SDS for one visit; each is null where no reference applies. */
export function visitSds(v: Measured, dob: string, sex: Sex): Record<Measure, number | null> {
  const days = ageInDays(dob, v.visit_date)
  const one = (m: Measure) => {
    const value = measureValue(v, m)
    return value == null || days == null ? null : sds(value, sex, m, days)
  }
  return { height: one('height'), weight: one('weight'), bmi: one('bmi') }
}

/**
 * Where a BMI SDS falls against the IAP 2015 cut-offs (5 to 18 years only). Give it the
 * unrounded SDS: +0.553 is over the boys' overweight line although it displays as +0.55.
 */
export function bmiBand(z: number, sex: Sex): 'below the 3rd centile' | 'overweight range' | 'obese range' | null {
  const c = IAP_BMI_CUTOFFS[sex]
  if (z > c.obese) return 'obese range'
  if (z > c.overweight) return 'overweight range'
  if (z < Z_CENTILE[3]) return 'below the 3rd centile'
  return null
}

/* ------------------------------------------------------------------ chart */

export interface CurveSegment {
  ref: RefId
  posture?: 'length' | 'height'
  /** Ages in years, increasing. */
  ages: number[]
  /** One list of values per line, each as long as `ages`. */
  values: number[][]
}

export interface ChartReference {
  /** Left and right ends of the age axis, in years. */
  from: number
  to: number
  lines: ChartLine[]
  segments: CurveSegment[]
  refs: RefId[]
}

function segment(points: { age: number; at: RefPoint }[], lines: ChartLine[]): CurveSegment {
  return {
    ref: points[0].at.ref,
    posture: points[0].at.posture,
    ages: points.map((p) => p.age),
    values: lines.map((l) => points.map((p) => valueFromLms(l.z, p.at.L, p.at.M, p.at.S))),
  }
}

/** Every `step` days from `first` to `last`, always including `last`. */
function days(first: number, last: number, step: number): number[] {
  const out: number[] = []
  for (let d = first; d < last; d += step) out.push(d)
  out.push(last)
  return out
}

/**
 * The reference lines to draw behind a child's points, or null when no reference overlaps
 * the ages measured.
 *
 * The age axis follows the published charts: birth to 2 years, birth to 5 years, 5 to 18
 * years, or birth to 18 when the child has been seen on both sides of the fifth birthday.
 * The WHO and IAP parts are separate lines that are never joined: they come from different
 * studies and do not meet at 5 years. Likewise WHO length and WHO height at 2 years.
 */
export function chartReference(sex: Sex, measure: Measure, ages: number[]): ChartReference | null {
  if (ages.length === 0) return null
  const min = Math.min(...ages)
  const max = Math.max(...ages)
  const who = measure === 'height' && min < IAP_FROM_YEARS
  const iap = max >= IAP_FROM_YEARS && min <= IAP_TO_YEARS
  if (!who && !iap) return null

  const from = who ? 0 : Math.min(IAP_FROM_YEARS, Math.floor(min))
  const to = iap ? Math.max(IAP_TO_YEARS, Math.ceil(max)) : max < 2 ? 2 : IAP_FROM_YEARS
  // On a chart that carries both, the WHO part is drawn at the same SDS as the IAP lines so
  // each line can be followed across; on its own it uses WHO's whole-SD lines.
  const lines = iap ? (measure === 'bmi' ? iapBmiLines(sex) : IAP_HEIGHT_WEIGHT_LINES) : WHO_SD_LINES
  const segments: CurveSegment[] = []
  if (who) {
    const lastDay = Math.min(Math.floor(to * DAYS_PER_YEAR), Math.floor(IAP_FROM_YEARS * DAYS_PER_YEAR))
    const part = (first: number, last: number) => segment(days(first, last, 15).map((d) => ({ age: d / DAYS_PER_YEAR, at: whoHeightAt(sex, d)! })), lines)
    segments.push(part(0, Math.min(WHO_LAST_LENGTH_DAY, lastDay)))
    if (lastDay > WHO_LAST_LENGTH_DAY) segments.push(part(WHO_LAST_LENGTH_DAY + 1, lastDay))
  }
  if (iap) {
    const months = (IAP_TO_YEARS - IAP_FROM_YEARS) * 12
    segments.push(segment(Array.from({ length: months + 1 }, (_, i) => ({ age: IAP_FROM_YEARS + i / 12, at: iapAt(sex, measure, IAP_FROM_YEARS + i / 12)! })), lines))
  }
  return { from, to, lines, segments, refs: [...new Set(segments.map((s) => s.ref))] }
}

/** Round axis limits and tick step that enclose the data with a little room. */
export function niceAxis(min: number, max: number, targetTicks = 6): { min: number; max: number; step: number } {
  if (!(max > min)) {
    min -= 1
    max += 1
  }
  const raw = (max - min) / targetTicks
  const pow = Math.pow(10, Math.floor(Math.log10(raw)))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? 10 * pow
  return { min: Math.floor(min / step) * step, max: Math.ceil(max / step) * step, step }
}
