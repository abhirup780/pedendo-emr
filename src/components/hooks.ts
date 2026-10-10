import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { deviceAsksLessMotion } from '../lib/device'

/**
 * Names the browser tab after the screen, so two tabs can be told apart. Never the patient's
 * name: tab titles are kept in the browser's history, where a shared clinic computer would
 * hold them after sign-out.
 */
export function useTitle(screen: string) {
  useEffect(() => {
    document.title = `${screen} · AuxoEMR`
    return () => {
      document.title = 'AuxoEMR'
    }
  }, [screen])
}

/**
 * Ctrl+K, or "/" outside a text box, asks for the patient search: the box in the header, or
 * the patient list's own on that screen. Not while a window (the medicine list, a photograph)
 * is open over the page.
 */
export function useFindKey(go: () => void) {
  const latest = useRef(go)
  useEffect(() => {
    latest.current = go
  })
  useEffect(() => {
    const keys = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      const typing = !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))
      const wanted = ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') || (e.key === '/' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey)
      if (!wanted || document.querySelector('dialog[open]')) return
      e.preventDefault()
      latest.current()
    }
    window.addEventListener('keydown', keys)
    return () => window.removeEventListener('keydown', keys)
  }, [])
}

/**
 * True where nothing should slide, fade or draw itself: the device asks for less movement and
 * the doctor has not chosen "On" under Settings, This device; or the doctor has chosen "Off".
 * (The stylesheet's last rules say the same thing for everything it moves.)
 */
export function lessMotion(): boolean {
  const choice = document.documentElement.dataset.motion
  return choice === 'off' || (choice !== 'on' && deviceAsksLessMotion())
}

/**
 * Keeps a list or a note on the page for a moment after it is closed, so that it can fade
 * away instead of vanishing. `there` says whether to draw it; `leaving`, that it is on its way
 * out (the stylesheet fades anything with the class `leaving`).
 */
export function usePresence(open: boolean): { there: boolean; leaving: boolean } {
  const [there, setThere] = useState(open)
  if (open && !there) setThere(true)
  useEffect(() => {
    if (open || !there) return
    const timer = setTimeout(() => setThere(false), lessMotion() ? 0 : 120)
    return () => clearTimeout(timer)
  }, [open, there])
  return { there, leaving: there && !open }
}

/**
 * Closes a window (a <dialog>) softly: it fades and sinks for a moment, then closes for real,
 * which is when its `onClose` is told. Where nothing would be seen of that (less motion asked
 * for) it closes at once.
 */
export function softClose(dialog: HTMLDialogElement | null) {
  if (!dialog || !dialog.open || dialog.classList.contains('closing')) return
  dialog.classList.add('closing')
  const done = () => {
    if (!dialog.classList.contains('closing')) return
    dialog.classList.remove('closing')
    if (dialog.open) dialog.close()
  }
  if (getComputedStyle(dialog).animationName === 'none') return done()
  dialog.addEventListener('animationend', done, { once: true })
  // In case the browser never says that the fade has ended.
  setTimeout(done, 240)
}

/**
 * Makes a change to the screen as a short cross-fade from the old picture to the new, where
 * the browser can do that; otherwise the change is simply made.
 */
export function crossFade(change: () => void) {
  const doc = document as Document & { startViewTransition?: (update: () => void) => { ready?: Promise<unknown> } }
  if (typeof doc.startViewTransition !== 'function' || lessMotion()) return change()
  // A fade that is cut short by the next one is not an error worth a line in the console.
  doc.startViewTransition(() => flushSync(change)).ready?.catch(() => {})
}
