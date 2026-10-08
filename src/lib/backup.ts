import { todayISO } from './age'
import type { Store } from './store'

/**
 * Everything in the account as one JSON document. The free database plan keeps no backups,
 * so this file is the safety net: download it regularly and keep it somewhere safe.
 * Photographs are not included; they stay in Google Drive.
 */
export async function buildBackup(store: Store) {
  const [dump, conditions, medicines, templates, investigations, panels, clinic] = await Promise.all([
    store.dump(),
    store.listConditions(),
    store.listMedicines(),
    store.listTemplates(),
    store.listInvestigations(),
    store.listPanels(),
    store.getClinic(),
  ])
  return { app: 'pedendo-emr', format: 1, exported_at: new Date().toISOString(), clinic, conditions, medicines, templates, investigations, panels, ...dump }
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
