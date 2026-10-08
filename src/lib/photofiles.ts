import { supabase } from './supabase'

/**
 * Where photograph files are kept. Two implementations: Supabase Storage (real use; a private
 * bucket in the same project as the database) and an in-memory store for the demo. The
 * database never holds image data, only each file's ID.
 */
export interface PhotoFiles {
  kind: 'storage' | 'demo'
  /** Stores a file for this patient and returns its file ID. */
  upload(blob: Blob, patientId: string): Promise<string>
  read(fileId: string): Promise<Blob>
  /** Erases the files, all in one request. There is no bin: this cannot be undone. */
  remove(fileIds: string[]): Promise<void>
}

/** The bucket made by migration 0013. */
export const PHOTO_BUCKET = 'photos'

/**
 * A file's ID is also its place in storage: account / patient / a random name. The database
 * rules (migration 0013) let an account touch only what is under its own id, so the first
 * part is what keeps one doctor's photographs from another's.
 */
export function photoPath(accountId: string, patientId: string, unique: string): string {
  return `${accountId}/${patientId}/${unique}.jpg`
}

/** The part of Supabase's storage client that is used here; narrow, so tests can stand in for it. */
export interface Bucket {
  upload(path: string, body: Blob, options: { contentType: string; upsert: boolean; cacheControl: string }): Promise<{ error: { message: string } | null }>
  download(path: string, options?: Record<string, never>, parameters?: { cache?: RequestCache }): PromiseLike<{ data: Blob | null; error: { message: string } | null }>
  remove(paths: string[]): Promise<{ error: { message: string } | null }>
}

/** Storage errors in plain words. */
export function friendlyFileError(message: string, doing: 'store' | 'open' | 'delete'): string {
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(message)) return 'No connection to the photograph store. Check the internet and try again.'
  if (/bucket not found/i.test(message)) return 'The place for photographs has not been set up yet. Contact the administrator.'
  if (/row-level security|unauthorized|not authorized|jwt|invalid token/i.test(message)) return 'The photograph store refused this. Sign out and in again, then repeat the last step.'
  if (/exceeded the maximum allowed size|payload too large|quota|limit/i.test(message)) return 'The photograph store is full or the file is too large. Download and delete older photographs, then try again.'
  if (/mime type|not supported/i.test(message)) return 'Only JPEG photographs can be stored.'
  if (/not found|no such/i.test(message)) return 'This photograph\'s file is no longer in the store.'
  return `Could not ${doing} the photograph (${message || 'no reason given'}).`
}

/** Photograph files in a Supabase Storage bucket. `accountId` is the signed-in doctor's id, or null. */
export function storageFiles(bucket: Bucket, accountId: () => Promise<string | null>, unique: () => string = () => crypto.randomUUID()): PhotoFiles {
  return {
    kind: 'storage',
    async upload(blob, patientId) {
      const account = await accountId()
      if (!account) throw new Error('Sign in again to add photographs.')
      const path = photoPath(account, patientId, unique())
      // Never overwrite: every photograph gets a new file. No caching: a clinic computer must
      // not keep patients' photographs on its disk after the doctor signs out.
      const { error } = await bucket.upload(path, blob, { contentType: 'image/jpeg', upsert: false, cacheControl: '0' })
      if (error) throw new Error(friendlyFileError(error.message, 'store'))
      return path
    },
    async read(fileId) {
      const { data, error } = await bucket.download(fileId, {}, { cache: 'no-store' })
      if (error || !data) throw new Error(friendlyFileError(error?.message ?? 'not found', 'open'))
      return data
    },
    async remove(fileIds) {
      if (fileIds.length === 0) return
      const { error } = await bucket.remove(fileIds)
      if (error) throw new Error(friendlyFileError(error.message, 'delete'))
    },
  }
}

function createDemoFiles(): PhotoFiles {
  const files = new Map<string, Blob>()
  let n = 0
  return {
    kind: 'demo',
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
    async remove(ids) {
      ids.forEach((id) => files.delete(id))
    },
  }
}

export const photoFiles: PhotoFiles = supabase
  ? storageFiles(supabase.storage.from(PHOTO_BUCKET), async () => (await supabase!.auth.getSession()).data.session?.user.id ?? null)
  : createDemoFiles()
