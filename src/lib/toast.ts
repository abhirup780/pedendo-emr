/**
 * A short word that something was done ("Visit saved."). The screen that did it says so here
 * and moves on; `components/Toast.tsx`, which stays put in the header's frame, shows it at the
 * foot of whichever screen comes next.
 */
const EVENT = 'auxoemr:done'

export function toast(text: string) {
  window.dispatchEvent(new CustomEvent<string>(EVENT, { detail: text }))
}

/** Listens for those words; returns the way to stop listening. */
export function onToast(show: (text: string) => void): () => void {
  const heard = (e: Event) => show((e as CustomEvent<string>).detail)
  window.addEventListener(EVENT, heard)
  return () => window.removeEventListener(EVENT, heard)
}
