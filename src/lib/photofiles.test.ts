import { describe, expect, it } from 'vitest'
import { fitWithin } from './image'
import { friendlyFileError, photoPath, storageFiles } from './photofiles'
import type { Bucket } from './photofiles'

/** A stand-in for a Supabase Storage bucket that keeps files in memory and records each call. */
function fakeBucket() {
  const files = new Map<string, Blob>()
  const calls: { op: string; path: string; options?: unknown }[] = []
  let fail = ''
  const bucket: Bucket = {
    async upload(path, body, options) {
      calls.push({ op: 'upload', path, options })
      if (fail) return { error: { message: fail } }
      if (files.has(path)) return { error: { message: 'The resource already exists' } }
      files.set(path, body)
      return { error: null }
    },
    async download(path, _options, parameters) {
      calls.push({ op: 'download', path, options: parameters })
      if (fail) return { data: null, error: { message: fail } }
      const b = files.get(path)
      return b ? { data: b, error: null } : { data: null, error: { message: 'Object not found' } }
    },
    async remove(paths) {
      calls.push({ op: 'remove', path: paths.join(',') })
      if (fail) return { error: { message: fail } }
      paths.forEach((p) => files.delete(p))
      return { error: null }
    },
  }
  return { bucket, files, calls, failWith: (m: string) => { fail = m } }
}

describe('storageFiles', () => {
  it('stores each photograph under the account, then the patient, and never overwrites', async () => {
    const f = fakeBucket()
    let n = 0
    const store = storageFiles(f.bucket, async () => 'acct-1', () => `id-${++n}`)
    const one = await store.upload(new Blob(['a']), 'pt-7')
    const two = await store.upload(new Blob(['b']), 'pt-7')
    expect([one, two]).toEqual(['acct-1/pt-7/id-1.jpg', 'acct-1/pt-7/id-2.jpg'])
    expect(one).toBe(photoPath('acct-1', 'pt-7', 'id-1'))
    expect(f.calls[0].options).toEqual({ contentType: 'image/jpeg', upsert: false, cacheControl: '0' })
    expect(await (await store.read(two)).text()).toBe('b')
    expect(f.calls.at(-1)).toEqual({ op: 'download', path: two, options: { cache: 'no-store' } })
    await store.remove([one])
    expect([...f.files.keys()]).toEqual([two])
    // Nothing to erase: no request at all.
    const before = f.calls.length
    await store.remove([])
    expect(f.calls).toHaveLength(before)
    await store.remove([two, 'acct-1/pt-7/never-there.jpg'])
    expect(f.files.size).toBe(0)
    expect(f.calls.at(-1)?.path).toBe(`${two},acct-1/pt-7/never-there.jpg`)
    await expect(store.read(one)).rejects.toThrow(/no longer in the store/)
  })

  it('will not store anything when nobody is signed in', async () => {
    const f = fakeBucket()
    await expect(storageFiles(f.bucket, async () => null).upload(new Blob(['a']), 'pt-7')).rejects.toThrow(/Sign in again/)
    expect(f.calls).toHaveLength(0)
  })

  it('explains what went wrong in plain words', async () => {
    const f = fakeBucket()
    const store = storageFiles(f.bucket, async () => 'acct-1')
    f.failWith('Bucket not found')
    await expect(store.upload(new Blob(['a']), 'pt-7')).rejects.toThrow(/migration 0013/)
    f.failWith('new row violates row-level security policy')
    await expect(store.upload(new Blob(['a']), 'pt-7')).rejects.toThrow(/Sign out and in again/)
    f.failWith('Failed to fetch')
    await expect(store.read('x')).rejects.toThrow(/No connection/)
    await expect(store.remove(['x'])).rejects.toThrow(/No connection/)
    expect(friendlyFileError('The object exceeded the maximum allowed size', 'store')).toMatch(/full or the file is too large/)
    expect(friendlyFileError('mime type image/png is not supported', 'store')).toMatch(/Only JPEG/)
    expect(friendlyFileError('', 'delete')).toBe('Could not delete the photograph (no reason given).')
  })
})

describe('fitWithin', () => {
  it('shrinks the longest edge and keeps the shape', () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 1600, height: 1200 })
    expect(fitWithin(3000, 4000)).toEqual({ width: 1200, height: 1600 })
  })
  it('never enlarges', () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 })
    expect(fitWithin(1600, 900)).toEqual({ width: 1600, height: 900 })
  })
})
