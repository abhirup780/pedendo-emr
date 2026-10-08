import { parseISODate, todayISO } from './age'

const p2 = (n: number) => String(n).padStart(2, '0')
const iso = (y: number, m: number, d: number) => `${y}-${p2(m)}-${p2(d)}`
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/** A stored date (YYYY-MM-DD) as it is typed and shown in a date box: dd/mm/yyyy. */
export function showDate(value: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : ''
}

/**
 * What the doctor typed, as a stored date, or null when it is not a real date yet.
 * Day comes first: "8/10/2026", "08-10-2026", "8.10.26", "08102026" and "8 Oct 2026" are all
 * 8 October 2026. A two-digit year means 20xx, or 19xx when 20xx would be in the future
 * beyond next year. A pasted "2026-10-08" is accepted too.
 */
export function parseTyped(text: string, today: string = todayISO()): string | null {
  const t = text.trim().toLowerCase()
  if (!t) return null
  let d: number, m: number, y: number
  let r: RegExpExecArray | null
  if ((r = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t))) [y, m, d] = [Number(r[1]), Number(r[2]), Number(r[3])]
  else if ((r = /^(\d{1,2})[/\-. ](\d{1,2})[/\-. ](\d{2}|\d{4})$/.exec(t))) [d, m, y] = [Number(r[1]), Number(r[2]), Number(r[3])]
  else if ((r = /^(\d{2})(\d{2})(\d{4})$/.exec(t))) [d, m, y] = [Number(r[1]), Number(r[2]), Number(r[3])]
  else if ((r = /^(\d{1,2})[/\-. ]?([a-z]{3,9})[/\-., ]*(\d{2}|\d{4})$/.exec(t))) {
    const mi = MONTHS.findIndex((name) => r![2].startsWith(name) && MONTH_NAMES[MONTHS.indexOf(name)].toLowerCase().startsWith(r![2]))
    if (mi < 0) return null
    ;[d, m, y] = [Number(r[1]), mi + 1, Number(r[3])]
  } else return null
  if (y < 100) {
    const limit = Number(today.slice(0, 4)) + 1
    y += 2000 + y > limit ? 1900 : 2000 // i.e. (2000 + y > limit) ? 1900 : 2000
  }
  const out = iso(y, m, d)
  return y >= 1900 && parseISODate(out) ? out : null
}

/** Puts the slashes in while digits are being typed: "0810" becomes "08/10/". */
export function autoSlash(next: string, previous: string): string {
  if (next.length <= previous.length || !/^[\d/]*$/.test(next)) return next
  const digits = next.replace(/\//g, '')
  // Only when the text is plain dd, ddmm or ddmmyyyy so far; anything else is left alone.
  if (next !== digits && next !== `${digits.slice(0, 2)}/${digits.slice(2)}` && next !== `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`) return next
  if (digits.length > 8) return next
  if (digits.length < 2) return digits
  if (digits.length < 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
}

/** The six weeks shown for a month, Monday first, with the neighbouring months' days filling the ends. */
export function monthCells(year: number, month: number): { iso: string; day: number; inMonth: boolean }[] {
  const first = new Date(year, month - 1, 1)
  const lead = (first.getDay() + 6) % 7
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(year, month - 1, 1 - lead + i)
    return { iso: iso(d.getFullYear(), d.getMonth() + 1, d.getDate()), day: d.getDate(), inMonth: d.getMonth() === month - 1 }
  })
}

/** A date moved by whole days, staying a calendar date in any time zone. */
export function shiftDays(value: string, days: number): string {
  const d = parseISODate(value)
  if (!d) return value
  const n = new Date(d.getFullYear(), d.getMonth(), d.getDate() + days)
  return iso(n.getFullYear(), n.getMonth() + 1, n.getDate())
}
