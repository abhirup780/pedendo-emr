import type { Sex, Tanner } from './types'

/** Short captions under each tile, and the fuller Marshall and Tanner description. */
export const GENITAL = [
  { cap: 'Prepubertal', text: 'Testes, scrotum and penis of childhood size.' },
  { cap: 'Scrotum and testes enlarge', text: 'Scrotum and testes enlarge; scrotal skin reddens and changes texture.' },
  { cap: 'Penis lengthens', text: 'Penis grows in length; further growth of testes and scrotum.' },
  { cap: 'Penis broadens, glans develops', text: 'Penis grows in breadth, glans develops; scrotal skin darkens.' },
  { cap: 'Adult', text: 'Adult size and shape.' },
]
export const BREAST = [
  { cap: 'Prepubertal', text: 'Elevation of the papilla only.' },
  { cap: 'Breast bud', text: 'Breast and papilla form a small mound; areola widens.' },
  { cap: 'Breast and areola enlarge', text: 'Breast and areola enlarge further with no separation of contours.' },
  { cap: 'Areola forms a second mound', text: 'Areola and papilla project as a secondary mound above the breast.' },
  { cap: 'Mature contour', text: 'Only the papilla projects; areola follows the breast contour.' },
]
export const PUBIC = [
  { cap: 'None', text: 'No pubic hair.' },
  { cap: 'Sparse, long, lightly pigmented', text: 'Sparse growth of long, slightly pigmented, downy hair.' },
  { cap: 'Darker, coarser, curled', text: 'Darker, coarser and more curled hair spreading sparsely over the pubis.' },
  { cap: 'Adult type, smaller area', text: 'Adult-type hair covering a smaller area; none on the inner thighs.' },
  { cap: 'Adult, reaches inner thighs', text: 'Adult in type and quantity, spreading to the inner thighs.' },
]

/** Prader orchidometer bead volumes in mL. */
export const ORCHIDOMETER = [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25]

export const OTHER_SIGNS: Record<Sex, string[]> = {
  M: ['Axillary hair', 'Acne', 'Body odour', 'Voice change', 'Facial hair'],
  F: ['Axillary hair', 'Acne', 'Body odour', 'Vaginal discharge', 'Menarche'],
}

export const EMPTY_TANNER: Tanner = { g: null, b: null, p: null, testis_r: null, testis_l: null, signs: [] }

export function isBlank(t: Tanner | null): boolean {
  return !t || (t.g == null && t.b == null && t.p == null && t.testis_r == null && t.testis_l == null && t.signs.length === 0)
}

/** "G1 P1 · testes R 3 mL, L 3 mL" for a boy, "B2 P1" for a girl; empty when nothing staged. */
export function tannerSummary(t: Tanner | null, sex: Sex): string {
  if (!t || isBlank(t)) return ''
  const stage = [sex === 'M' ? (t.g ? `G${t.g}` : '') : t.b ? `B${t.b}` : '', t.p ? `P${t.p}` : ''].filter(Boolean).join(' ')
  const parts = stage ? [stage] : []
  if (sex === 'M' && (t.testis_r != null || t.testis_l != null)) parts.push(`testes R ${t.testis_r ?? '—'} mL, L ${t.testis_l ?? '—'} mL`)
  if (sex === 'F' && t.signs.includes('Menarche')) parts.push('menarche attained')
  return parts.join(' · ')
}

/**
 * Has gonadarche started? Boys: genital stage 2 or a testis of 4 mL or more. Girls: breast
 * stage 2. Null when the deciding sign was not recorded (pubic hair alone does not count).
 */
export function pubertyStarted(t: Tanner | null, sex: Sex): boolean | null {
  if (!t) return null
  if (sex === 'M') {
    const vol = Math.max(t.testis_r ?? 0, t.testis_l ?? 0)
    if (t.g == null && t.testis_r == null && t.testis_l == null) return null
    return (t.g ?? 1) >= 2 || vol >= 4
  }
  if (t.b == null) return null
  return t.b >= 2
}

export interface PubertyFlag {
  alert: boolean
  text: string
}

/**
 * Timing against the usual definitions: onset before 8 years in girls or 9 in boys is
 * precocious; no onset by 13 in girls or 14 in boys is delayed. A prompt, not a diagnosis.
 */
export function pubertyFlag(t: Tanner | null, sex: Sex, ageYears: number | null): PubertyFlag | null {
  const started = pubertyStarted(t, sex)
  if (started == null || ageYears == null) return null
  const early = sex === 'M' ? 9 : 8
  const late = sex === 'M' ? 14 : 13
  if (started && ageYears < early) return { alert: true, text: `Puberty has started before ${early} years: consider precocious puberty.` }
  if (!started && ageYears >= late) return { alert: true, text: `No pubertal onset at ${late} years or older: consider delayed puberty.` }
  return { alert: false, text: started ? 'Puberty has started, within the usual age range.' : 'Prepubertal, within the usual age range.' }
}
