import { decimalAge } from './age'
import { bmi } from './clinical'
import { REFERENCES } from './growth-reference'
import type { Measure, ReferenceTable } from './growth-reference'
import type { Sex, Visit } from './types'

export const MEASURES: { key: Measure; label: string; unit: string }[] = [
  { key: 'height', label: 'Height', unit: 'cm' },
  { key: 'weight', label: 'Weight', unit: 'kg' },
  { key: 'bmi', label: 'BMI', unit: 'kg/m²' },
]

export interface GrowthPoint {
  age: number
  value: number
  date: string
}

/** The child's own measurements as (age, value) points, oldest first. */
export function growthPoints(visits: Pick<Visit, 'visit_date' | 'height_cm' | 'weight_kg'>[], dob: string, measure: Measure): GrowthPoint[] {
  const out: GrowthPoint[] = []
  for (const v of visits) {
    const value = measure === 'height' ? v.height_cm : measure === 'weight' ? v.weight_kg : bmi(v.height_cm, v.weight_kg)
    const age = decimalAge(dob, v.visit_date)
    if (value != null && age != null) out.push({ age, value, date: v.visit_date })
  }
  return out.sort((a, b) => a.age - b.age)
}

/** The reference table covering this sex, measure and age; null when none has been added. */
export function findReference(sex: Sex, measure: Measure, age: number, tables: ReferenceTable[] = REFERENCES): ReferenceTable | null {
  return tables.find((t) => t.sex === sex && t.measure === measure && t.rows.length > 1 && age >= t.rows[0].age && age <= t.rows[t.rows.length - 1].age) ?? null
}

/** Straight-line interpolation of L, M and S between the two nearest ages; null outside the table. */
export function lmsAt(lms: NonNullable<ReferenceTable['lms']>, age: number): { L: number; M: number; S: number } | null {
  if (lms.length === 0 || age < lms[0].age || age > lms[lms.length - 1].age) return null
  for (let i = 1; i < lms.length; i++) {
    const a = lms[i - 1]
    const b = lms[i]
    if (age <= b.age) {
      const k = b.age === a.age ? 0 : (age - a.age) / (b.age - a.age)
      return { L: a.L + (b.L - a.L) * k, M: a.M + (b.M - a.M) * k, S: a.S + (b.S - a.S) * k }
    }
  }
  return { L: lms[0].L, M: lms[0].M, S: lms[0].S }
}

/** Standard deviation score by the LMS method (Cole): ((x/M)^L − 1) / (L·S), or ln(x/M)/S when L is 0. */
export function sdsFromLms(value: number, L: number, M: number, S: number): number {
  return Math.abs(L) < 1e-9 ? Math.log(value / M) / S : (Math.pow(value / M, L) - 1) / (L * S)
}

/** SDS for a measurement, or null when no reference with L, M and S covers it. */
export function sds(value: number, sex: Sex, measure: Measure, age: number, tables: ReferenceTable[] = REFERENCES): number | null {
  const t = findReference(sex, measure, age, tables)
  const at = t?.lms ? lmsAt(t.lms, age) : null
  return at ? Math.round(sdsFromLms(value, at.L, at.M, at.S) * 100) / 100 : null
}

/** Problems in a reference table, as plain sentences; empty when it is well formed. */
export function checkReference(t: ReferenceTable): string[] {
  const out: string[] = []
  if (t.centiles.length === 0) out.push('no centiles listed')
  if (t.centiles.some((c, i) => i > 0 && c <= t.centiles[i - 1])) out.push('centiles are not in increasing order')
  t.rows.forEach((r, i) => {
    if (r.values.length !== t.centiles.length) out.push(`age ${r.age}: ${r.values.length} values for ${t.centiles.length} centiles`)
    if (r.values.some((v, j) => j > 0 && v <= r.values[j - 1])) out.push(`age ${r.age}: values do not increase across centiles`)
    if (i > 0 && r.age <= t.rows[i - 1].age) out.push(`age ${r.age}: ages are not in increasing order`)
  })
  t.lms?.forEach((r, i) => {
    if (r.M <= 0 || r.S <= 0) out.push(`LMS age ${r.age}: M and S must be positive`)
    if (i > 0 && r.age <= t.lms![i - 1].age) out.push(`LMS age ${r.age}: ages are not in increasing order`)
  })
  return out
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
