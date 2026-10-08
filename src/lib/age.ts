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

/** Decimal age in years, for growth calculations in later stages. */
export function decimalAge(dobISO: string, onISO: string = todayISO()): number | null {
  const dob = parseISODate(dobISO)
  const on = parseISODate(onISO)
  if (!dob || !on || on < dob) return null
  return (on.getTime() - dob.getTime()) / (365.25 * 86400000)
}

/** Mid-parental height (Tanner): mean of parents, +6.5 cm for boys, −6.5 cm for girls. */
export function midParentalHeight(fatherCm: number | null, motherCm: number | null, sex: 'M' | 'F'): number | null {
  if (!fatherCm || !motherCm) return null
  return (fatherCm + motherCm) / 2 + (sex === 'M' ? 6.5 : -6.5)
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "8 Oct 2026", the same on every device. */
export function formatDate(iso: string): string {
  const d = parseISODate(iso.slice(0, 10))
  if (!d) return '—'
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}
