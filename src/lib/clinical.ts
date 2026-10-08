import { parseISODate } from './age'
import type { Visit } from './types'

const DAY = 86400000

export function daysBetween(fromISO: string, toISO: string): number | null {
  const a = parseISODate(fromISO)
  const b = parseISODate(toISO)
  if (!a || !b) return null
  return Math.round((b.getTime() - a.getTime()) / DAY)
}

/** Body mass index in kg/m², one decimal. */
export function bmi(heightCm: number | null, weightKg: number | null): number | null {
  if (!heightCm || !weightKg || heightCm <= 0 || weightKg <= 0) return null
  const m = heightCm / 100
  return Math.round((weightKg / (m * m)) * 10) / 10
}

/** Shortest gap, in days, over which a height velocity is worth showing (about 3 months). */
export const MIN_VELOCITY_DAYS = 85

export interface Velocity {
  cmPerYear: number
  fromDate: string
  fromHeight: number
  days: number
}

/**
 * Annualised height velocity against the most recent earlier height that is at least
 * MIN_VELOCITY_DAYS old. Shorter gaps magnify measurement error, so they are skipped.
 */
export function heightVelocity(heightCm: number | null, onISO: string, earlier: Pick<Visit, 'visit_date' | 'height_cm'>[]): Velocity | null {
  if (!heightCm) return null
  const candidates = earlier
    .filter((v) => v.height_cm != null)
    .map((v) => ({ v, days: daysBetween(v.visit_date, onISO) }))
    .filter((x): x is { v: Pick<Visit, 'visit_date' | 'height_cm'>; days: number } => x.days != null && x.days >= MIN_VELOCITY_DAYS)
    .sort((a, b) => a.days - b.days)
  const pick = candidates[0]
  if (!pick) return null
  const from = pick.v.height_cm as number
  return {
    cmPerYear: Math.round(((heightCm - from) / pick.days) * 365.25 * 10) / 10,
    fromDate: pick.v.visit_date,
    fromHeight: from,
    days: pick.days,
  }
}

/**
 * Dose per kilogram for a dose written as a number and a unit, e.g. "0.7 mg" at 24.2 kg
 * gives "0.029 mg/kg". Per dose, not per day: frequency is free text. Returns null for
 * anything it cannot read confidently (ranges, "1 sachet", two numbers).
 */
export function dosePerKg(dose: string, weightKg: number | null): string | null {
  if (!weightKg || weightKg <= 0) return null
  const m = /^\s*(\d+(?:\.\d+)?)\s*(mg|mcg|µg|g|units?|iu|ml)\s*$/i.exec(dose)
  if (!m) return null
  const per = Number(m[1]) / weightKg
  if (!Number.isFinite(per) || per <= 0) return null
  const unit = m[2].toLowerCase() === 'iu' ? 'IU' : m[2].toLowerCase() === 'ml' ? 'mL' : m[2].toLowerCase()
  const digits = per >= 10 ? 0 : per >= 1 ? 1 : per >= 0.1 ? 2 : 3
  return `${per.toFixed(digits)} ${unit}/kg`
}

/** Blood pressure as "systolic/diastolic", both plausible and in the right order. */
export function validBp(bp: string): boolean {
  if (!bp.trim()) return true
  const m = /^\s*(\d{2,3})\s*\/\s*(\d{2,3})\s*$/.exec(bp)
  if (!m) return false
  const s = Number(m[1])
  const d = Number(m[2])
  return s >= 50 && s <= 260 && d >= 20 && d <= 160 && s > d
}

/** Add calendar months to an ISO date, clamping to the month's last day (31 Jan + 1 → 28 Feb). */
export function addMonths(iso: string, months: number): string | null {
  const d = parseISODate(iso)
  if (!d) return null
  const target = new Date(d.getFullYear(), d.getMonth() + months, 1)
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  target.setDate(Math.min(d.getDate(), last))
  const p = (n: number) => String(n).padStart(2, '0')
  return `${target.getFullYear()}-${p(target.getMonth() + 1)}-${p(target.getDate())}`
}

export const EMPTY_RX = { name: '', dose: '', frequency: '', route: '', duration: '', instructions: '' }

/** One-line directions for print: "0.7 mg subcutaneous once daily at bedtime, continue". */
export function rxLine(m: { dose: string; frequency: string; route: string; duration: string }): string {
  const head = [m.dose, m.route.toLowerCase(), m.frequency.toLowerCase()].filter((s) => s.trim()).join(' ')
  const dur = m.duration.trim()
  if (!dur) return head
  const tail = /^(continue|ongoing|sos|as needed)/i.test(dur) ? dur.toLowerCase() : `for ${dur}`
  return head ? `${head}, ${tail}` : tail
}
