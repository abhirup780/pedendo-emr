/**
 * Small things remembered on this device only: the idle sign-out time, whether things move on
 * the screen, unsaved visit drafts, and one-off notices for the sign-in screen. All reads and writes tolerate a browser that
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

/* ------------------------------------------------------------------ movement */

/**
 * Whether things slide, fade and draw themselves on this device. 'auto' follows the device,
 * which may ask for less movement: a Windows computer with "Animation effects" switched off
 * does, and many clinic computers have it off only to save effort. 'on' and 'off' are the
 * doctor's own choice, whatever the device says.
 */
export type Motion = 'auto' | 'on' | 'off'
export const MOTION_CHOICES: { key: Motion; label: string }[] = [
  { key: 'auto', label: 'Automatic' },
  { key: 'on', label: 'On' },
  { key: 'off', label: 'Off' },
]
const MOTION_KEY = 'pedendo-motion'
// The shareable preview exists to show the app, movement included, so there it starts as 'on'.
const DEFAULT_MOTION: Motion = import.meta.env.VITE_PREVIEW ? 'on' : 'auto'

export function motionChoice(): Motion {
  try {
    const raw = localStorage.getItem(MOTION_KEY)
    return raw === 'auto' || raw === 'on' || raw === 'off' ? raw : DEFAULT_MOTION
  } catch {
    return DEFAULT_MOTION
  }
}
export function setMotionChoice(m: Motion): void {
  try {
    localStorage.setItem(MOTION_KEY, m)
  } catch {
    /* holds until the page is closed */
  }
  applyMotion(m)
}
/**
 * Tells the stylesheet, and `lessMotion` in components/hooks.ts, the choice: `data-motion` on
 * the page itself, absent for 'auto'. Called once before the app is drawn.
 */
export function applyMotion(m: Motion = motionChoice()): void {
  if (m === 'auto') delete document.documentElement.dataset.motion
  else document.documentElement.dataset.motion = m
}
/** True where the device itself asks for less movement. */
export function deviceAsksLessMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

const HIDDEN_KEY = 'pedendo-setup-hidden'
/** "Still to set up" reminders the doctor has crossed off on this device. */
export function hiddenReminders(): string[] {
  try {
    const list: unknown = JSON.parse(localStorage.getItem(HIDDEN_KEY) ?? '[]')
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}
export function hideReminder(id: string): void {
  try {
    localStorage.setItem(HIDDEN_KEY, JSON.stringify([...new Set([...hiddenReminders(), id])]))
  } catch {
    /* comes back on the next visit */
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
/** Every draft held in this tab: its key and when it was last written. */
export function listDrafts(): { key: string; at: string }[] {
  try {
    return Object.keys(sessionStorage)
      .filter((k) => k.startsWith(DRAFT))
      .map((k) => ({ key: k.slice(DRAFT.length), at: readDraft<unknown>(k.slice(DRAFT.length))?.at ?? '' }))
  } catch {
    return []
  }
}
/** Unsaved visit notes for one patient. `vid` is null for a visit that was never saved. */
export function visitDrafts(patientId: string): { vid: string | null; at: string }[] {
  const start = `visit:${patientId}:`
  return listDrafts()
    .filter((d) => d.key.startsWith(start))
    .map((d) => ({ vid: d.key.slice(start.length) === 'new' ? null : d.key.slice(start.length), at: d.at }))
}
/** On a deliberate sign-out nothing clinical is left behind in the browser. */
export function dropAllDrafts(): void {
  try {
    for (const k of Object.keys(sessionStorage)) if (k.startsWith(DRAFT)) sessionStorage.removeItem(k)
  } catch {
    /* nothing to drop */
  }
}
