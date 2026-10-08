import type { Sex } from './types'

export type Measure = 'height' | 'weight' | 'bmi'

/**
 * One published reference table for one sex and one measure.
 *
 * EMPTY ON PURPOSE. The numbers must be copied from the published sources (IAP 2015 for
 * 5 to 18 years, WHO 2006 for under 5), never estimated or recalled. To add a table, append an
 * object to REFERENCES below:
 *
 *   {
 *     id: 'iap2015-boys-height',
 *     label: 'IAP 2015 · Boys 5–18 y',
 *     source: 'Indian Pediatrics 2015;52:47-55, Table …',
 *     sex: 'M',
 *     measure: 'height',
 *     centiles: [3, 10, 25, 50, 75, 90, 97],
 *     rows: [
 *       { age: 5.0, values: [ …seven numbers in the same order as `centiles`… ] },
 *       { age: 5.5, values: [ … ] },
 *     ],
 *     // Optional. With L, M and S the app also shows SDS (z-scores); without them it
 *     // draws the centile curves only.
 *     lms: [ { age: 5.0, L: …, M: …, S: … } ],
 *   }
 *
 * Ages are in years and must increase down the list. `src/lib/growth.test.ts` checks every
 * table added here for shape and ordering.
 */
export interface ReferenceTable {
  id: string
  label: string
  source: string
  sex: Sex
  measure: Measure
  centiles: number[]
  rows: { age: number; values: number[] }[]
  lms?: { age: number; L: number; M: number; S: number }[]
}

export const REFERENCES: ReferenceTable[] = []
