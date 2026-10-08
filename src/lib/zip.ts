/**
 * A plain .zip file built in the browser, for "Download all photographs". Files are stored as
 * they are, not squeezed: photographs are JPEGs, which do not get smaller. No library, and
 * each file's bytes are only held while it is being added.
 *
 * Limits of the plain format (no ZIP64): under 65,535 files and under 4 GB in all, far beyond
 * the 1 GB the free photograph store can hold.
 */
const TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < bytes.length; i++) c = TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/** Keeps a name safe as one part of a path on Windows, macOS and Android. */
export function safeName(s: string): string {
  // Control characters and the ones Windows forbids; then the dots and spaces it trims.
  // eslint-disable-next-line no-control-regex
  const clean = s.replace(/[\u0000-\u001f<>:"/\\|?*]/g, ' ').replace(/\s+/g, ' ').trim().replace(/[. ]+$/, '')
  return clean.slice(0, 80) || 'unnamed'
}

interface Entry {
  name: Uint8Array<ArrayBuffer>
  crc: number
  size: number
  offset: number
  time: number
  date: number
}

export function zipWriter() {
  const parts: BlobPart[] = []
  const entries: Entry[] = []
  const used = new Set<string>()
  let offset = 0
  const enc = new TextEncoder()

  const header = (sig: number, len: number) => {
    const v = new DataView(new ArrayBuffer(len))
    v.setUint32(0, sig, true)
    return v
  }

  return {
    count: () => entries.length,
    /** Adds one file. A path already used gets " (2)", " (3)" before its extension. */
    async add(path: string, blob: Blob, when: Date = new Date()): Promise<string> {
      let name = path
      for (let n = 2; used.has(name.toLowerCase()); n++) name = path.replace(/(\.[^./]*)?$/, ` (${n})$1`)
      used.add(name.toLowerCase())
      const bytes = new Uint8Array(await blob.arrayBuffer())
      const e: Entry = {
        name: new Uint8Array(enc.encode(name)),
        crc: crc32(bytes),
        size: bytes.length,
        offset,
        time: (when.getHours() << 11) | (when.getMinutes() << 5) | (when.getSeconds() >> 1),
        date: ((Math.max(1980, when.getFullYear()) - 1980) << 9) | ((when.getMonth() + 1) << 5) | when.getDate(),
      }
      const h = header(0x04034b50, 30)
      h.setUint16(4, 20, true) // version needed
      h.setUint16(6, 0x0800, true) // names are UTF-8
      h.setUint16(8, 0, true) // stored, not compressed
      h.setUint16(10, e.time, true)
      h.setUint16(12, e.date, true)
      h.setUint32(14, e.crc, true)
      h.setUint32(18, e.size, true)
      h.setUint32(22, e.size, true)
      h.setUint16(26, e.name.length, true)
      parts.push(h.buffer, e.name, blob)
      offset += 30 + e.name.length + e.size
      entries.push(e)
      return name
    },
    finish(): Blob {
      const start = offset
      let size = 0
      for (const e of entries) {
        const c = header(0x02014b50, 46)
        c.setUint16(4, 20, true)
        c.setUint16(6, 20, true)
        c.setUint16(8, 0x0800, true)
        c.setUint16(10, 0, true)
        c.setUint16(12, e.time, true)
        c.setUint16(14, e.date, true)
        c.setUint32(16, e.crc, true)
        c.setUint32(20, e.size, true)
        c.setUint32(24, e.size, true)
        c.setUint16(28, e.name.length, true)
        c.setUint32(42, e.offset, true)
        parts.push(c.buffer, e.name)
        size += 46 + e.name.length
      }
      const end = header(0x06054b50, 22)
      end.setUint16(8, entries.length, true)
      end.setUint16(10, entries.length, true)
      end.setUint32(12, size, true)
      end.setUint32(16, start, true)
      parts.push(end.buffer)
      return new Blob(parts, { type: 'application/zip' })
    },
  }
}
