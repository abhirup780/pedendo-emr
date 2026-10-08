/** Parse YYYY-MM-DD as a local calendar date (no timezone shift). */
export function parseISODate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  if (d.getFullYear() !== Number(m[1]) || d.getMonth() !== Number(m[2]) - 1 || d.getDate() !== Number(m[3])) return null
  return d
}

export function todayISO(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`
}

/** Completed years and months between a date of birth and a reference date. */
export function ageParts(dobISO: string, onISO: string = todayISO()): { years: number; months: number } | null {
  const dob = parseISODate(dobISO)
  const on = parseISODate(onISO)
  if (!dob || !on || on < dob) return null
  let months = (on.getFullYear() - dob.getFullYear()) * 12 + (on.getMonth() - dob.getMonth())
  if (on.getDate() < dob.getDate()) months -= 1
  return { years: Math.floor(months / 12), months: months % 12 }
}

/** "9y 4m"; under one year "7m"; under one month "12d". */
export function formatAge(dobISO: string, onISO: string = todayISO()): string {
  const a = ageParts(dobISO, onISO)
  if (!a) return '—'
  if (a.years === 0 && a.months === 0) {
    const days = Math.round((parseISODate(onISO)!.getTime() - parseISODate(dobISO)!.getTime()) / 86400000)
    return `${days}d`
  }
  if (a.years === 0) return `${a.months}m`
  return `${a.years}y ${a.months}m`
}

/** Whole days between two calendar dates, whatever the time zone or daylight saving. */
export function ageInDays(dobISO: string, onISO: string = todayISO()): number | null {
  const dob = parseISODate(dobISO)
  const on = parseISODate(onISO)
  if (!dob || !on || on < dob) return null
  const utc = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
  return Math.round((utc(on) - utc(dob)) / 86400000)
}

/** Decimal age in years: whole days divided by 365.25, the convention the growth references use. */
export function decimalAge(dobISO: string, onISO: string = todayISO()): number | null {
  const days = ageInDays(dobISO, onISO)
  return days == null ? null : days / 365.25
}

/**
 * Mid-parental height (Tanner): mean of parents, +6.5 cm for boys, −6.5 cm for girls.
 * Null while the child's sex is not assigned ('U').
 */
export function midParentalHeight(fatherCm: number | null, motherCm: number | null, sex: 'M' | 'F' | 'U'): number | null {
  if (!fatherCm || !motherCm || sex === 'U') return null
  return (fatherCm + motherCm) / 2 + (sex === 'M' ? 6.5 : -6.5)
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "8 Oct 2026", the same on every device. */
/**
 * The local calendar date of a stored value. A plain date stays as it is; a timestamp such as
 * "2026-10-08T20:30:00Z" is read in the device's time zone (in India that is already 9 Oct).
 */
export function localDate(value: string): string {
  if (!value.includes('T')) return value.slice(0, 10)
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? value.slice(0, 10) : todayISO(d)
}

/** Usual width of the target height range either side of mid-parental height, in cm. */
export const TARGET_RANGE_CM = 8

export function targetRange(mph: number): string {
  return `${(mph - TARGET_RANGE_CM).toFixed(1)}–${(mph + TARGET_RANGE_CM).toFixed(1)} cm`
}

export function formatDate(iso: string): string {
  const d = parseISODate(localDate(iso))
  if (!d) return '—'
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}
