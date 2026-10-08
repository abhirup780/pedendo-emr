/**
 * Small things remembered on this device only: the idle sign-out time, unsaved visit drafts,
 * and one-off notices for the sign-in screen. All reads and writes tolerate a browser that
 * blocks storage.
 */
const IDLE_KEY = 'pedendo-idle-minutes'
export const IDLE_CHOICES = [15, 30, 60, 0] as const
export const DEFAULT_IDLE = 30

export function idleMinutes(): number {
  try {
    const raw = localStorage.getItem(IDLE_KEY)
    const n = raw == null ? DEFAULT_IDLE : Number(raw)
    return (IDLE_CHOICES as readonly number[]).includes(n) ? n : DEFAULT_IDLE
  } catch {
    return DEFAULT_IDLE
  }
}
export function setIdleMinutes(n: number): void {
  try {
    localStorage.setItem(IDLE_KEY, String(n))
  } catch {
    /* keeps the default */
  }
}

const NOTICE_KEY = 'pedendo-signin-notice'
/** A sentence to show once on the sign-in screen, e.g. why the doctor was signed out. */
export function leaveNotice(text: string): void {
  try {
    sessionStorage.setItem(NOTICE_KEY, text)
  } catch {
    /* no notice */
  }
}
export function peekNotice(): string {
  try {
    return sessionStorage.getItem(NOTICE_KEY) ?? ''
  } catch {
    return ''
  }
}
export function clearNotice(): void {
  try {
    sessionStorage.removeItem(NOTICE_KEY)
  } catch {
    /* nothing to clear */
  }
}

const DRAFT = 'pedendo-draft:'
export interface Draft<T> {
  at: string
  data: T
}
/** Drafts live in sessionStorage: they survive a reload or a crash, and die with the tab. */
export function saveDraft<T>(key: string, data: T): void {
  try {
    sessionStorage.setItem(DRAFT + key, JSON.stringify({ at: new Date().toISOString(), data }))
  } catch {
    /* no draft */
  }
}
export function readDraft<T>(key: string): Draft<T> | null {
  try {
    const raw = sessionStorage.getItem(DRAFT + key)
    return raw ? (JSON.parse(raw) as Draft<T>) : null
  } catch {
    return null
  }
}
export function dropDraft(key: string): void {
  try {
    sessionStorage.removeItem(DRAFT + key)
  } catch {
    /* nothing to drop */
  }
}
/** On a deliberate sign-out nothing clinical is left behind in the browser. */
export function dropAllDrafts(): void {
  try {
    for (const k of Object.keys(sessionStorage)) if (k.startsWith(DRAFT)) sessionStorage.removeItem(k)
  } catch {
    /* nothing to drop */
  }
}
