import { useLayoutEffect, useRef } from 'react'
import type { HTMLAttributes } from 'react'

/**
 * A row of choices whose mark slides to the one chosen instead of jumping: the dark pill of a
 * segmented control (`className="seg"`), the line under a tab (`className="tabs"`).
 *
 * It measures the chosen button (the one with aria-pressed or aria-selected) and hands its
 * place to the stylesheet as --gx, --gy, --gw and --gh; `data-glide` says that it has. Until
 * then, and where nothing is chosen, the buttons are drawn as they always were. In a row that
 * scrolls sideways it also keeps the chosen button in sight, and says with `data-more` which
 * ends of the row have more to come.
 */
export default function Glide({ children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined' || typeof MutationObserver === 'undefined') return
    // Which ends of a sideways-scrolling row have more to come; the stylesheet fades those ends.
    // Read from the last button, not from the row's own scroll width: the sliding line, caught
    // in mid-slide after the window has narrowed, would be counted as something more to come.
    const more = () => {
      const last = el.lastElementChild as HTMLElement | null
      const left = el.scrollLeft > 1
      const right = !!last && last.offsetLeft + last.offsetWidth - el.scrollLeft > el.clientWidth + 1
      if (left || right) el.setAttribute('data-more', left && right ? 'both' : left ? 'left' : 'right')
      else el.removeAttribute('data-more')
    }
    const place = () => {
      const on = el.querySelector<HTMLElement>(':scope > [aria-pressed="true"], :scope > [aria-selected="true"]')
      if (!on) {
        el.removeAttribute('data-glide')
        more()
        return
      }
      el.style.setProperty('--gx', `${on.offsetLeft}px`)
      el.style.setProperty('--gy', `${on.offsetTop}px`)
      el.style.setProperty('--gw', `${on.offsetWidth}px`)
      el.style.setProperty('--gh', `${on.offsetHeight}px`)
      // In a row that scrolls sideways (the Settings tabs on a phone) the chosen one is kept in
      // sight, with a little of its neighbour, so that it is plain the row goes on.
      if (el.scrollWidth > el.clientWidth) {
        if (on.offsetLeft < el.scrollLeft) el.scrollLeft = on.offsetLeft - 40
        else if (on.offsetLeft + on.offsetWidth > el.scrollLeft + el.clientWidth) el.scrollLeft = on.offsetLeft + on.offsetWidth - el.clientWidth + 40
      }
      more()
      if (el.hasAttribute('data-glide')) return
      // Put in place first, without sliding there from the corner: the browser is made to take
      // note of where the mark stands before it is told that the mark slides from now on.
      el.setAttribute('data-glide', 'set')
      void el.offsetWidth
      el.setAttribute('data-glide', 'on')
    }
    // The buttons change width when the font arrives or the window narrows.
    const sizes = new ResizeObserver(place)
    const watch = () => {
      sizes.disconnect()
      sizes.observe(el)
      for (const child of el.children) sizes.observe(child)
    }
    const changes = new MutationObserver((list) => {
      if (list.some((m) => m.type === 'childList')) watch()
      place()
    })
    place()
    watch()
    changes.observe(el, { subtree: true, childList: true, attributes: true, attributeFilter: ['aria-pressed', 'aria-selected'] })
    el.addEventListener('scroll', more, { passive: true })
    return () => {
      sizes.disconnect()
      changes.disconnect()
      el.removeEventListener('scroll', more)
      el.removeAttribute('data-glide')
      el.removeAttribute('data-more')
    }
  }, [])
  return (
    <div ref={ref} {...rest}>
      {children}
    </div>
  )
}
