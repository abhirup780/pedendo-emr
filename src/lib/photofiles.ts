/**
 * Where photograph files are kept. Two implementations: Google Drive (real use) and an
 * in-memory store for the demo. The database never holds image data, only file IDs.
 */
export interface PhotoFiles {
  kind: 'drive' | 'demo' | 'none'
  /** True once files can be read and written without asking the doctor again. */
  ready(): boolean
  /** Asks for access. Must be called from a click, because it may open Google's window. */
  connect(loginHint?: string): Promise<void>
  /** Stores a file in the patient's folder and returns its file ID. */
  upload(blob: Blob, name: string, folder: string): Promise<string>
  read(fileId: string): Promise<Blob>
  remove(fileId: string): Promise<void>
}

const DRIVE = 'https://www.googleapis.com/drive/v3'
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id'
/** Lets the app create and open only the files it made itself, nothing else in the Drive. */
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file'
export const ROOT_FOLDER = 'PedEndo EMR photographs'
const FOLDER_MIME = 'application/vnd.google-apps.folder'

export class DriveError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

type Fetch = typeof fetch

/**
 * Google Drive calls, given a way to get an access token. Kept separate from the sign-in
 * window so the requests can be tested without Google.
 */
export function driveClient(getToken: () => string | null, doFetch: Fetch = fetch) {
  const folders = new Map<string, string>()

  async function call(url: string, init: RequestInit = {}): Promise<Response> {
    const token = getToken()
    if (!token) throw new DriveError(401, 'Connect Google Drive to continue.')
    const res = await doFetch(url, { ...init, headers: { ...(init.headers as Record<string, string> | undefined), Authorization: `Bearer ${token}` } })
    if (res.status === 401) throw new DriveError(401, 'Google Drive access has expired. Connect again.')
    if (!res.ok) throw new DriveError(res.status, `Google Drive refused the request (${res.status}).`)
    return res
  }

  const quote = (s: string) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")

  async function folder(name: string, parent: string | null): Promise<string> {
    const key = `${parent ?? 'root'}/${name}`
    const hit = folders.get(key)
    if (hit) return hit
    const q = `name = '${quote(name)}' and mimeType = '${FOLDER_MIME}' and trashed = false and '${parent ?? 'root'}' in parents`
    const found = (await (await call(`${DRIVE}/files?q=${encodeURIComponent(q)}&fields=files(id)&pageSize=1`)).json()) as { files?: { id: string }[] }
    let id = found.files?.[0]?.id
    if (!id) {
      const made = await call(`${DRIVE}/files?fields=id`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, mimeType: FOLDER_MIME, ...(parent ? { parents: [parent] } : {}) }),
      })
      id = ((await made.json()) as { id: string }).id
    }
    folders.set(key, id)
    return id
  }

  return {
    async upload(blob: Blob, name: string, patientFolder: string): Promise<string> {
      const parent = await folder(patientFolder, await folder(ROOT_FOLDER, null))
      const form = new FormData()
      form.append('metadata', new Blob([JSON.stringify({ name, parents: [parent] })], { type: 'application/json' }))
      form.append('file', blob)
      const res = await call(UPLOAD, { method: 'POST', body: form })
      return ((await res.json()) as { id: string }).id
    },
    async read(fileId: string): Promise<Blob> {
      return (await call(`${DRIVE}/files/${encodeURIComponent(fileId)}?alt=media`)).blob()
    },
    /** Moves the file to Drive's bin rather than erasing it, so a mistaken delete can be undone for 30 days. */
    async remove(fileId: string): Promise<void> {
      await call(`${DRIVE}/files/${encodeURIComponent(fileId)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trashed: true }) })
    },
  }
}

interface TokenResponse {
  access_token?: string
  expires_in?: number
  error?: string
}
interface TokenClient {
  requestAccessToken(opts?: { prompt?: string; login_hint?: string }): void
  callback: (r: TokenResponse) => void
}
interface Gis {
  accounts: { oauth2: { initTokenClient(cfg: { client_id: string; scope: string; callback: (r: TokenResponse) => void; error_callback?: (e: { type?: string }) => void }): TokenClient } }
}

function loadGis(): Promise<Gis> {
  const w = window as unknown as { google?: Gis }
  if (w.google?.accounts?.oauth2) return Promise.resolve(w.google)
  return new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.onload = () => (w.google?.accounts?.oauth2 ? resolve(w.google) : reject(new Error('Google sign-in did not load.')))
    s.onerror = () => reject(new Error('Google sign-in could not be loaded. Check the internet connection.'))
    document.head.appendChild(s)
  })
}

function createDriveFiles(clientId: string): PhotoFiles {
  let token: string | null = null
  let expires = 0
  const live = () => (token && Date.now() < expires ? token : null)
  const api = driveClient(live)
  return {
    kind: 'drive',
    ready: () => live() !== null,
    async connect(loginHint) {
      const gis = await loadGis()
      await new Promise<void>((resolve, reject) => {
        const client = gis.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: DRIVE_SCOPE,
          callback: (r) => {
            if (r.error || !r.access_token) return reject(new Error('Google Drive access was not granted.'))
            token = r.access_token
            // Stop a minute early so a request never starts with a token about to lapse.
            expires = Date.now() + ((r.expires_in ?? 3600) - 60) * 1000
            resolve()
          },
          error_callback: (e) => reject(new Error(e.type === 'popup_closed' ? 'The Google window was closed before access was given.' : 'Google Drive could not be connected.')),
        })
        client.requestAccessToken({ prompt: '', login_hint: loginHint })
      })
    },
    upload: api.upload,
    read: api.read,
    remove: api.remove,
  }
}

function createDemoFiles(): PhotoFiles {
  const files = new Map<string, Blob>()
  let n = 0
  return {
    kind: 'demo',
    ready: () => true,
    async connect() {},
    async upload(blob) {
      const id = `demo-${++n}`
      files.set(id, blob)
      return id
    },
    async read(id) {
      const b = files.get(id)
      if (!b) throw new Error('This demo photo is no longer in memory.')
      return b
    },
    async remove(id) {
      files.delete(id)
    },
  }
}

const NONE: PhotoFiles = {
  kind: 'none',
  ready: () => false,
  connect: async () => { throw new Error('Google Drive is not set up for this app yet.') },
  upload: async () => { throw new Error('Google Drive is not set up for this app yet.') },
  read: async () => { throw new Error('Google Drive is not set up for this app yet.') },
  remove: async () => { throw new Error('Google Drive is not set up for this app yet.') },
}

const demo = !(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY)
const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined

export const photoFiles: PhotoFiles = demo ? createDemoFiles() : clientId ? createDriveFiles(clientId) : NONE
