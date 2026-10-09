import { useEffect, useRef } from 'react'

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
