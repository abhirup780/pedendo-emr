import { useEffect, useState } from 'react'
import { onToast } from '../lib/toast'
import { usePresence } from './hooks'
import { Icon } from './Icon'

/**
 * Says that something was done ("Visit saved."), at the foot of the screen, for a few seconds.
 * Nothing on it can be pressed, so it never keeps a button from being reached, and it is not
 * printed. What to say comes from `toast()` in `lib/toast.ts`.
 */
export default function Toast() {
  const [note, setNote] = useState({ text: '', n: 0, open: false })
  useEffect(() => onToast((text) => setNote((old) => ({ text, n: old.n + 1, open: true }))), [])
  useEffect(() => {
    if (!note.open) return
    const timer = setTimeout(() => setNote((old) => ({ ...old, open: false })), 2600)
    return () => clearTimeout(timer)
  }, [note.n, note.open])
  const { there, leaving } = usePresence(note.open)
  return (
    // Always on the page, empty: a screen reader announces what is put into it.
    <div className="toast-slot no-print" role="status">
      {there && (
        <div className={leaving ? 'toast leaving' : 'toast'} key={note.n}>
          <Icon name="check" />
          {note.text}
        </div>
      )}
    </div>
  )
}
