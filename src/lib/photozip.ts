import type { Dump } from './types'
import { safeName, zipWriter } from './zip'

export interface PhotoZip {
  blob: Blob
  /** Files in the zip. */
  count: number
  /** Photograph records whose file could not be read; they are left out. */
  missing: number
  bytes: number
}

export function photoZipName(today: string): string {
  return `pedendo-photographs-${today}.zip`
}

/**
 * Every photograph of the account in one zip: a folder per patient ("MRN 10028 Name"), files
 * named by date and view. This is the doctor's own copy of the photographs, separate from the
 * Excel exports and the backup file, which never contain them.
 */
export async function buildPhotoZip(dump: Pick<Dump, 'patients' | 'photos'>, read: (fileId: string) => Promise<Blob>, onProgress?: (done: number, of: number) => void): Promise<PhotoZip> {
  const patients = new Map(dump.patients.map((p) => [p.id, p]))
  const photos = [...dump.photos].sort((a, b) => a.taken_on.localeCompare(b.taken_on) || a.created_at.localeCompare(b.created_at))
  const zip = zipWriter()
  let missing = 0
  let bytes = 0
  for (const [i, ph] of photos.entries()) {
    onProgress?.(i + 1, photos.length)
    const p = patients.get(ph.patient_id)
    const folder = safeName(p ? `MRN ${p.mrn} ${p.name}` : 'Patient not found')
    try {
      const blob = await read(ph.file_id)
      await zip.add(`${folder}/${ph.taken_on} ${safeName(ph.view)}.jpg`, blob, new Date(ph.created_at))
      bytes += blob.size
    } catch {
      missing++
    }
  }
  return { blob: zip.finish(), count: zip.count(), missing, bytes }
}
