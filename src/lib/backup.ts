import { todayISO } from './age'
import { normalize } from './printlayout'
import type { Store } from './store'
import type { Backup } from './types'

/** Version of the backup file layout written by this app. */
export const BACKUP_FORMAT = 3

/**
 * Everything in the account as one JSON document. The free database plan keeps no backups,
 * so this file is the safety net: download it regularly and keep it somewhere safe.
 * Photograph records are included; the image files themselves stay in the photograph store.
 */
export async function buildBackup(store: Store): Promise<Backup> {
  const [dump, conditions, medicines, templates, investigations, panels, clinic, print_layouts] = await Promise.all([
    store.dump(),
    store.listConditions(),
    store.listMedicines(),
    store.listTemplates(),
    store.listInvestigations(),
    store.listPanels(),
    store.getClinic(),
    store.listPrintLayouts(),
  ])
  return { app: 'pedendo-emr', format: BACKUP_FORMAT, exported_at: new Date().toISOString(), clinic, conditions, medicines, templates, investigations, panels, print_layouts, ...dump }
}

const LISTS = ['conditions', 'medicines', 'templates', 'investigations', 'panels', 'patients', 'visits', 'results'] as const

/**
 * Reads a backup file's text and checks it before anything is written. Returns the backup,
 * brought up to the current layout, or throws one message listing what is wrong.
 */
export function parseBackup(text: string): Backup {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error('This file is not a backup: it could not be read as JSON.')
  }
  const b = raw as Partial<Backup> & Record<string, unknown>
  if (!b || typeof b !== 'object' || b.app !== 'pedendo-emr') throw new Error('This file is not a backup made by this app.')
  if (typeof b.format !== 'number' || b.format < 1) throw new Error('This backup has no readable format number.')
  if (b.format > BACKUP_FORMAT) throw new Error('This backup was made by a newer version of the app. Update the app, then restore.')

  const problems: string[] = []
  for (const k of LISTS) if (!Array.isArray(b[k])) problems.push(`"${k}" is missing`)
  if (!b.clinic || typeof b.clinic !== 'object') problems.push('"clinic" is missing')
  if (problems.length) throw new Error(`This backup is incomplete: ${problems.join(', ')}.`)

  // Format 1 had no photograph records or consent.
  // Format 1 had no photograph records or consent; print layouts arrived in format 3.
  const out = { ...b, photos: Array.isArray(b.photos) ? b.photos : [], consents: Array.isArray(b.consents) ? b.consents : [], print_layouts: Array.isArray(b.print_layouts) ? b.print_layouts : [] } as Backup
  out.print_layouts = out.print_layouts.map((l) => ({ ...l, config: normalize(l.config) }))
  // Older files lack fields added since; fill them so every record has the current shape.
  out.patients = out.patients.map((p) => ({ ...p, last_visit_on: p.last_visit_on ?? null, next_review_on: p.next_review_on ?? null, visit_count: p.visit_count ?? 0 }))
  out.clinic = { ...out.clinic, logo: out.clinic.logo ?? '', signature: out.clinic.signature ?? '' }
  out.panels = out.panels.map((p) => ({ ...p, condition_ids: Array.isArray(p.condition_ids) ? p.condition_ids : [] }))
  out.visits = out.visits.map((v) => ({ ...v, print_plan: v.print_plan !== false, investigations: v.investigations ?? [], tanner: v.tanner ?? null }))

  const ids = new Set<string>()
  for (const p of out.patients) {
    if (!p.id || !p.name || !p.dob || typeof p.mrn !== 'number') problems.push(`a patient record is missing its id, name, date of birth or MRN`)
    if (ids.has(p.id)) problems.push(`patient ${p.mrn} appears twice`)
    ids.add(p.id)
  }
  if (new Set(out.patients.map((p) => p.mrn)).size !== out.patients.length) problems.push('two patients share an MRN')
  const tags = new Set(out.conditions.map((c) => c.id))
  if (out.patients.some((p) => p.condition_ids.some((c) => !tags.has(c)))) problems.push('a patient carries a condition tag that is not in the file')
  for (const [name, rows] of [['visit', out.visits], ['result', out.results], ['photograph', out.photos]] as const) {
    const orphans = rows.filter((r) => !ids.has(r.patient_id)).length
    if (orphans) problems.push(`${orphans} ${name} record(s) belong to a patient who is not in the file`)
  }
  if (problems.length) throw new Error(`This backup cannot be restored: ${[...new Set(problems)].join('; ')}.`)
  return out
}

export const backupFileName = (today: string = todayISO()) => `pedendo-backup-${today}.json`

const KEY = 'pedendo-last-backup'
/** When this browser last downloaded a backup (ISO date), or null. A reminder, not a record. */
export function lastBackup(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}
export function noteBackup(today: string = todayISO()): void {
  try {
    localStorage.setItem(KEY, today)
  } catch {
    /* reminder only */
  }
}
