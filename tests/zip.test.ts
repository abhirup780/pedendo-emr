import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { crc32, safeName, zipWriter } from '../src/lib/zip'

describe('zip', () => {
  it('computes the standard checksum', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926)
    expect(crc32(new Uint8Array())).toBe(0)
  })

  it('makes names safe for any computer', () => {
    expect(safeName('MRN 10028 Aarav/Sharma: "A"?')).toBe('MRN 10028 Aarav Sharma A')
    expect(safeName('  ends with dots... ')).toBe('ends with dots')
    expect(safeName('///')).toBe('unnamed')
    expect(safeName('অভিরূপ সরকার')).toBe('অভিরূপ সরকার')
  })

  it('writes a file that an ordinary unzip tool opens, byte for byte', async () => {
    const z = zipWriter()
    const big = new Uint8Array(300_000).map((_, i) => (i * 31) % 251)
    const when = new Date(2026, 9, 8, 14, 30, 10)
    expect(await z.add('MRN 10028 Aarav Sharma/2026-10-08 Hands.jpg', new Blob([big]), when)).toBe('MRN 10028 Aarav Sharma/2026-10-08 Hands.jpg')
    // The same view on the same day twice must not overwrite the first.
    expect(await z.add('MRN 10028 Aarav Sharma/2026-10-08 Hands.jpg', new Blob(['second']), when)).toBe('MRN 10028 Aarav Sharma/2026-10-08 Hands (2).jpg')
    expect(await z.add('MRN 10028 Aarav Sharma/2026-10-08 hands.jpg', new Blob(['third']), when)).toBe('MRN 10028 Aarav Sharma/2026-10-08 hands (3).jpg')
    await z.add('MRN 10031 অভিরূপ/empty.jpg', new Blob([]), when)
    expect(z.count()).toBe(4)

    const dir = mkdtempSync(join(tmpdir(), 'zip-'))
    const file = join(dir, 'out.zip')
    writeFileSync(file, Buffer.from(await z.finish().arrayBuffer()))
    // Python's zipfile checks every checksum and reads the names as UTF-8.
    const script = [
      'import sys, zipfile, json',
      'z = zipfile.ZipFile(sys.argv[1])',
      'assert z.testzip() is None',
      'z.extractall(sys.argv[2])',
      'print(json.dumps([[i.filename, i.file_size, list(i.date_time)] for i in z.infolist()]))',
    ].join('\n')
    const listed = JSON.parse(execFileSync('python3', ['-I', '-c', script, file, dir]).toString()) as [string, number, number[]][]
    expect(listed).toEqual([
      ['MRN 10028 Aarav Sharma/2026-10-08 Hands.jpg', 300000, [2026, 10, 8, 14, 30, 10]],
      ['MRN 10028 Aarav Sharma/2026-10-08 Hands (2).jpg', 6, [2026, 10, 8, 14, 30, 10]],
      ['MRN 10028 Aarav Sharma/2026-10-08 hands (3).jpg', 5, [2026, 10, 8, 14, 30, 10]],
      ['MRN 10031 অভিরূপ/empty.jpg', 0, [2026, 10, 8, 14, 30, 10]],
    ])
    expect(Buffer.compare(readFileSync(join(dir, 'MRN 10028 Aarav Sharma/2026-10-08 Hands.jpg')), Buffer.from(big))).toBe(0)
    expect(readFileSync(join(dir, 'MRN 10028 Aarav Sharma/2026-10-08 Hands (2).jpg'), 'utf8')).toBe('second')
  })
})
