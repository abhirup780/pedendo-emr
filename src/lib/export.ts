import { decimalAge, midParentalHeight, parseISODate, todayISO } from './age'
import { bmi, dosePerKg, heightVelocity } from './clinical'
import { tannerSummary } from './tanner'
import type { Condition, Patient, Result, Visit } from './types'

export type Cell = string | number | Date | null
export interface Sheet {
  name: string
  columns: { header: string; width: number; date?: boolean }[]
  rows: Cell[][]
}

export const SHEETS = [
  { key: 'patients', label: 'Patients', hint: 'One row per patient: demographics, tags, parents’ heights' },
  { key: 'visits', label: 'Visits', hint: 'One row per visit: notes, assessment, plan' },
  { key: 'growth', label: 'Growth', hint: 'Height, weight, BMI and height velocity at each visit' },
  { key: 'tanner', label: 'Tanner staging', hint: 'Stage and testicular volume at each staged visit' },
  { key: 'results', label: 'Results', hint: 'One row per test result with value, unit and date' },
  { key: 'prescriptions', label: 'Prescriptions', hint: 'One row per medicine, with dose per kg' },
] as const
export type SheetKey = (typeof SHEETS)[number]['key']

export interface ExportData {
  patients: Patient[]
  visits: Visit[]
  results: Result[]
  conditions: Condition[]
}

export interface ExportOptions {
  sheets: SheetKey[]
  /** Only patients carrying this tag; null for everyone. */
  conditionId: string | null
  /** Inclusive ISO dates applied to visit and report dates; null for no limit. */
  from: string | null
  to: string | null
  /** Replace name and MRN with a study ID; drop date of birth, guardian, phone and address. */
  deidentify: boolean
  /** Reference date for "age today"; defaults to today. */
  today?: string
}

/**
 * Excel stores a date as a day count from UTC, so a calendar date must be midnight UTC.
 * Local midnight in India is the previous evening in UTC and would show a day early.
 */
const date = (iso: string | null): Date | null => {
  const d = iso ? parseISODate(iso.slice(0, 10)) : null
  return d ? new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())) : null
}
const round = (n: number | null, dp: number): number | null => (n == null ? null : Math.round(n * 10 ** dp) / 10 ** dp)
/** Numbers stay numbers so Excel can sort and chart them; "<0.1" or "7y 6m" stay text. */
const numeric = (s: string): string | number => (/^-?\d+(\.\d+)?$/.test(s.trim()) ? Number(s) : s)

/**
 * Turns the records into worksheets. Pure: no network, no dates read from the clock when
 * `today` is given, so the same input always gives the same workbook.
 */
export function buildSheets(data: ExportData, opts: ExportOptions): Sheet[] {
  const today = opts.today ?? todayISO()
  const inRange = (iso: string) => (!opts.from || iso >= opts.from) && (!opts.to || iso <= opts.to)
  const patients = data.patients.filter((p) => !opts.conditionId || p.condition_ids.includes(opts.conditionId)).sort((a, b) => a.mrn - b.mrn)
  const byId = new Map(patients.map((p) => [p.id, p]))
  const tagName = new Map(data.conditions.map((c) => [c.id, c.name]))
  // Study IDs follow MRN order within this export, so they match across its sheets.
  const pad = String(patients.length).length < 4 ? 4 : String(patients.length).length
  const studyId = new Map(patients.map((p, i) => [p.id, `P-${String(i + 1).padStart(pad, '0')}`]))
  const allVisits = data.visits.filter((v) => byId.has(v.patient_id)).sort((a, b) => a.visit_date.localeCompare(b.visit_date) || a.created_at.localeCompare(b.created_at))
  const visits = allVisits.filter((v) => inRange(v.visit_date))
  const results = data.results.filter((r) => byId.has(r.patient_id) && inRange(r.result_date)).sort((a, b) => a.result_date.localeCompare(b.result_date) || a.created_at.localeCompare(b.created_at))
  const order = <T extends { patient_id: string }>(rows: T[]) => [...rows].sort((a, b) => byId.get(a.patient_id)!.mrn - byId.get(b.patient_id)!.mrn)

  const idCols = opts.deidentify ? [{ header: 'Study ID', width: 10 }] : [{ header: 'MRN', width: 8 }, { header: 'Name', width: 24 }]
  const idCells = (p: Patient): Cell[] => (opts.deidentify ? [studyId.get(p.id)!] : [p.mrn, p.name])
  const age = (p: Patient, on: string) => round(decimalAge(p.dob, on), 2)
  const out: Sheet[] = []

  if (opts.sheets.includes('patients')) {
    const visitCount = new Map<string, number>()
    const lastVisit = new Map<string, string>()
    for (const v of allVisits) {
      visitCount.set(v.patient_id, (visitCount.get(v.patient_id) ?? 0) + 1)
      lastVisit.set(v.patient_id, v.visit_date)
    }
    out.push({
      name: 'Patients',
      columns: [
        ...idCols,
        { header: 'Sex', width: 5 },
        ...(opts.deidentify ? [] : [{ header: 'Date of birth', width: 13, date: true }]),
        { header: 'Age today (y)', width: 12 },
        { header: 'Condition tags', width: 34 },
        ...(opts.deidentify ? [] : [{ header: 'Guardian', width: 22 }, { header: 'Relation', width: 10 }, { header: 'Phone', width: 13 }, { header: 'Address', width: 30 }]),
        { header: 'Father height (cm)', width: 16 },
        { header: 'Mother height (cm)', width: 16 },
        { header: 'Mid-parental height (cm)', width: 20 },
        { header: 'Drug allergies', width: 20 },
        { header: 'Registered', width: 13, date: true },
        { header: 'Visits', width: 7 },
        { header: 'Last visit', width: 13, date: true },
      ],
      rows: patients.map((p) => [
        ...idCells(p),
        p.sex,
        ...(opts.deidentify ? [] : [date(p.dob)]),
        round(decimalAge(p.dob, today), 1),
        p.condition_ids.map((c) => tagName.get(c)).filter(Boolean).sort().join(', '),
        ...(opts.deidentify ? [] : [p.guardian_name, p.guardian_relation, p.phone, p.address]),
        p.father_height_cm,
        p.mother_height_cm,
        round(midParentalHeight(p.father_height_cm, p.mother_height_cm, p.sex), 1),
        p.allergies,
        date(p.created_at),
        visitCount.get(p.id) ?? 0,
        date(lastVisit.get(p.id) ?? null),
      ]),
    })
  }

  const visitCols = [...idCols, { header: 'Sex', width: 5 }, { header: 'Visit date', width: 13, date: true }, { header: 'Age (y)', width: 8 }]
  const visitCells = (v: Visit): Cell[] => {
    const p = byId.get(v.patient_id)!
    return [...idCells(p), p.sex, date(v.visit_date), age(p, v.visit_date)]
  }

  if (opts.sheets.includes('visits')) {
    out.push({
      name: 'Visits',
      columns: [...visitCols, { header: 'Height (cm)', width: 11 }, { header: 'Weight (kg)', width: 11 }, { header: 'BMI', width: 7 }, { header: 'BP', width: 9 }, { header: 'Tanner', width: 26 }, { header: 'Chief complaint', width: 30 }, { header: 'History and examination', width: 40 }, { header: 'Assessment', width: 40 }, { header: 'Plan', width: 40 }, { header: 'Advice', width: 40 }, { header: 'Investigations advised', width: 40 }, { header: 'Medicines', width: 10 }, { header: 'Review date', width: 13, date: true }],
      rows: order(visits).map((v) => [...visitCells(v), v.height_cm, v.weight_kg, bmi(v.height_cm, v.weight_kg), v.bp, tannerSummary(v.tanner, byId.get(v.patient_id)!.sex), v.complaint, v.history, v.assessment, v.plan, v.advice, v.investigations.join('; '), v.medicines.length, date(v.review_date)]),
    })
  }

  if (opts.sheets.includes('growth')) {
    out.push({
      name: 'Growth',
      columns: [...visitCols, { header: 'Height (cm)', width: 11 }, { header: 'Weight (kg)', width: 11 }, { header: 'BMI', width: 7 }, { header: 'Height velocity (cm/yr)', width: 20 }, { header: 'Velocity from', width: 13, date: true }, { header: 'Mid-parental height (cm)', width: 20 }],
      rows: order(visits.filter((v) => v.height_cm != null || v.weight_kg != null)).map((v) => {
        const p = byId.get(v.patient_id)!
        // Velocity looks back through every earlier visit, including ones before the date range.
        const vel = heightVelocity(v.height_cm, v.visit_date, allVisits.filter((x) => x.patient_id === v.patient_id && x.visit_date < v.visit_date))
        return [...visitCells(v), v.height_cm, v.weight_kg, bmi(v.height_cm, v.weight_kg), vel?.cmPerYear ?? null, date(vel?.fromDate ?? null), round(midParentalHeight(p.father_height_cm, p.mother_height_cm, p.sex), 1)]
      }),
    })
  }

  if (opts.sheets.includes('tanner')) {
    out.push({
      name: 'Tanner',
      columns: [...visitCols, { header: 'Genital (G)', width: 10 }, { header: 'Breast (B)', width: 10 }, { header: 'Pubic hair (P)', width: 13 }, { header: 'Testis right (mL)', width: 15 }, { header: 'Testis left (mL)', width: 15 }, { header: 'Other signs', width: 30 }],
      rows: order(visits.filter((v) => v.tanner)).map((v) => {
        const t = v.tanner!
        const male = byId.get(v.patient_id)!.sex === 'M'
        return [...visitCells(v), male ? t.g : null, male ? null : t.b, t.p, male ? t.testis_r : null, male ? t.testis_l : null, t.signs.join('; ')]
      }),
    })
  }

  if (opts.sheets.includes('results')) {
    out.push({
      name: 'Results',
      columns: [...idCols, { header: 'Sex', width: 5 }, { header: 'Report date', width: 13, date: true }, { header: 'Age (y)', width: 8 }, { header: 'Test', width: 32 }, { header: 'Result', width: 12 }, { header: 'Unit', width: 10 }, { header: 'Flag', width: 7 }],
      rows: order(results).map((r) => {
        const p = byId.get(r.patient_id)!
        return [...idCells(p), p.sex, date(r.result_date), age(p, r.result_date), r.test, numeric(r.value), r.unit, r.flag === 'low' ? 'Low' : r.flag === 'high' ? 'High' : '']
      }),
    })
  }

  if (opts.sheets.includes('prescriptions')) {
    out.push({
      name: 'Prescriptions',
      columns: [...visitCols, { header: 'Weight (kg)', width: 11 }, { header: 'Medicine', width: 40 }, { header: 'Dose', width: 12 }, { header: 'Dose per kg', width: 14 }, { header: 'Frequency', width: 24 }, { header: 'Route', width: 14 }, { header: 'Duration', width: 12 }, { header: 'Instructions', width: 34 }],
      rows: order(visits).flatMap((v) => v.medicines.map((m): Cell[] => [...visitCells(v), v.weight_kg, m.name, m.dose, dosePerKg(m.dose, v.weight_kg) ?? '', m.frequency, m.route, m.duration, m.instructions])),
    })
  }
  return out
}

/** "ghd-2026-10-08.xlsx", "all-patients-deidentified-2026-10-08.xlsx". */
export function exportFileName(cohort: string | null, deidentify: boolean, today: string = todayISO()): string {
  const slug = (cohort ?? 'all patients').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'export'
  return `${slug}${deidentify ? '-deidentified' : ''}-${today}.xlsx`
}

/** Writes the sheets to an .xlsx file in memory. */
export async function toWorkbook(sheets: Sheet[]): Promise<Blob> {
  const { default: writeExcelFile } = await import('write-excel-file/universal')
  const book = sheets.map((s) => ({
    sheet: s.name,
    columns: s.columns.map((c) => ({ width: c.width })),
    stickyRowsCount: 1,
    data: [
      s.columns.map((c) => ({ value: c.header, fontWeight: 'bold' as const })),
      ...s.rows.map((row) =>
        row.map((cell, i) => {
          if (cell == null || cell === '') return null
          if (cell instanceof Date) return { value: cell, type: Date, format: 'dd-mmm-yyyy' }
          if (typeof cell === 'number') return { value: cell, type: Number }
          return { value: s.columns[i].date ? String(cell) : cell, type: String }
        }),
      ),
    ],
  }))
  return writeExcelFile(book as never).toBlob()
}

/** Starts a browser download of a file made in memory. */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}
