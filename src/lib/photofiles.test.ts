import { describe, expect, it } from 'vitest'
import { fitWithin } from './image'
import { DriveError, driveClient, ROOT_FOLDER } from './photofiles'

interface Call { url: string; method: string; auth: string; body: unknown }

/** A stand-in for Google Drive that remembers folders, like the real one. */
function fakeDrive() {
  const calls: Call[] = []
  const folders: { id: string; name: string; parent: string }[] = []
  let n = 0
  const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status })
  const doFetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(input)
    const method = init.method ?? 'GET'
    calls.push({ url, method, auth: (init.headers as Record<string, string>).Authorization, body: init.body })
    if (url.includes('/upload/')) return json({ id: 'file-1' })
    if (method === 'GET' && url.includes('files?q=')) {
      const q = decodeURIComponent(url.split('q=')[1].split('&')[0])
      const name = /name = '((?:[^'\\]|\\.)*)'/.exec(q)![1].replace(/\\(.)/g, '$1')
      const parent = /'([^']+)' in parents/.exec(q)![1]
      return json({ files: folders.filter((f) => f.name === name && f.parent === parent).map((f) => ({ id: f.id })) })
    }
    if (method === 'POST') {
      const b = JSON.parse(init.body as string) as { name: string; parents?: string[] }
      const f = { id: `folder-${++n}`, name: b.name, parent: b.parents?.[0] ?? 'root' }
      folders.push(f)
      return json({ id: f.id })
    }
    if (method === 'PATCH') return json({})
    return new Response(new Blob(['img']), { status: 200 })
  }) as typeof fetch
  return { calls, folders, doFetch }
}

describe('driveClient', () => {
  it('creates the app folder and the patient folder once, then uploads into it', async () => {
    const d = fakeDrive()
    const api = driveClient(() => 'tok', d.doFetch)
    expect(await api.upload(new Blob(['x']), 'a.jpg', 'MRN 10028')).toBe('file-1')
    expect(d.folders.map((f) => [f.name, f.parent])).toEqual([[ROOT_FOLDER, 'root'], ['MRN 10028', 'folder-1']])
    const upload = d.calls.at(-1)!
    expect(upload.url).toContain('uploadType=multipart')
    expect(upload.auth).toBe('Bearer tok')
    const meta = JSON.parse(await ((upload.body as FormData).get('metadata') as Blob).text())
    expect(meta).toEqual({ name: 'a.jpg', parents: ['folder-2'] })

    const before = d.calls.length
    await api.upload(new Blob(['y']), 'b.jpg', 'MRN 10028')
    expect(d.calls.length - before).toBe(1)
    expect(d.folders).toHaveLength(2)
  })

  it('reuses folders that already exist in Drive', async () => {
    const d = fakeDrive()
    d.folders.push({ id: 'old-root', name: ROOT_FOLDER, parent: 'root' }, { id: 'old-pt', name: "MRN 7 O'Brien", parent: 'old-root' })
    await driveClient(() => 'tok', d.doFetch).upload(new Blob(['x']), 'a.jpg', "MRN 7 O'Brien")
    expect(d.folders).toHaveLength(2)
    expect(d.calls.filter((c) => c.method === 'POST' && !c.url.includes('/upload/'))).toHaveLength(0)
  })

  it('reads a file and moves a deleted one to the bin', async () => {
    const d = fakeDrive()
    const api = driveClient(() => 'tok', d.doFetch)
    expect(await (await api.read('abc')).text()).toBe('img')
    expect(d.calls[0].url).toMatch(/\/files\/abc\?alt=media$/)
    await api.remove('abc')
    expect(d.calls[1].method).toBe('PATCH')
    expect(JSON.parse(d.calls[1].body as string)).toEqual({ trashed: true })
  })

  it('asks to connect when there is no token or Google rejects it', async () => {
    const d = fakeDrive()
    await expect(driveClient(() => null, d.doFetch).read('abc')).rejects.toMatchObject({ status: 401 })
    expect(d.calls).toHaveLength(0)
    const expired = (async () => new Response('', { status: 401 })) as typeof fetch
    await expect(driveClient(() => 'old', expired).read('abc')).rejects.toBeInstanceOf(DriveError)
    const broken = (async () => new Response('', { status: 500 })) as typeof fetch
    await expect(driveClient(() => 'tok', broken).read('abc')).rejects.toMatchObject({ status: 500 })
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
