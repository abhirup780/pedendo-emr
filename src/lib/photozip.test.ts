import { describe, expect, it } from 'vitest'
import { buildPhotoZip, photoZipName } from './photozip'
import type { Patient, Photo } from './types'

const patient = (id: string, mrn: number, name: string) => ({ id, mrn, name }) as Patient
const photo = (id: string, patient_id: string, taken_on: string, view: string, file_id: string): Photo => ({ id, patient_id, taken_on, view, note: '', file_id, width: 1, height: 1, bytes: 1, created_at: `${taken_on}T10:00:00Z` })

/** The file names inside a zip, read from its central directory. */
async function namesIn(blob: Blob): Promise<string[]> {
  const b = new Uint8Array(await blob.arrayBuffer())
  const v = new DataView(b.buffer)
  const out: string[] = []
  for (let i = 0; i + 46 <= b.length; i++) {
    if (v.getUint32(i, true) !== 0x02014b50) continue
    const n = v.getUint16(i + 28, true)
    out.push(new TextDecoder().decode(b.subarray(i + 46, i + 46 + n)))
    i += 45 + n
  }
  return out
}

describe('buildPhotoZip', () => {
  it('files every photograph under its patient, oldest first, and reports what was missing', async () => {
    const dump = {
      patients: [patient('p1', 10028, 'Aarav Sharma'), patient('p2', 10031, 'Diya/Nair')],
      photos: [
        photo('c', 'p1', '2026-10-08', 'Hands', 'f3'),
        photo('a', 'p1', '2026-07-14', 'Face, frontal', 'f1'),
        photo('b', 'p1', '2026-10-08', 'Hands', 'f2'),
        photo('d', 'p2', '2026-09-01', 'X-ray', 'f4'),
        photo('e', 'p2', '2026-09-02', 'X-ray', 'gone'),
        photo('f', 'nobody', '2026-09-03', 'Other', 'f5'),
      ],
    }
    const steps: string[] = []
    const z = await buildPhotoZip(dump, async (id) => { if (id === 'gone') throw new Error('missing'); return new Blob([id]) }, (n, of) => steps.push(`${n}/${of}`))
    expect(await namesIn(z.blob)).toEqual([
      'MRN 10028 Aarav Sharma/2026-07-14 Face, frontal.jpg',
      'MRN 10031 Diya Nair/2026-09-01 X-ray.jpg',
      'Patient not found/2026-09-03 Other.jpg',
      'MRN 10028 Aarav Sharma/2026-10-08 Hands.jpg',
      'MRN 10028 Aarav Sharma/2026-10-08 Hands (2).jpg',
    ])
    expect([z.count, z.missing, z.bytes]).toEqual([5, 1, 10])
    expect(steps.at(-1)).toBe('6/6')
    expect(photoZipName('2026-10-08')).toBe('pedendo-photographs-2026-10-08.zip')
  })

  it('makes a valid empty zip when there are no photographs', async () => {
    const z = await buildPhotoZip({ patients: [], photos: [] }, async () => new Blob())
    expect([z.count, z.blob.size]).toEqual([0, 22])
  })
})
