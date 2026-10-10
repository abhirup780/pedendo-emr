import { useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { preprinted } from '../lib/printlayout'
import type { PrintConfig } from '../lib/printlayout'
import type { Clinic, Patient, Visit } from '../lib/types'
import RxSheet from './RxSheet'

interface Props {
  config: PrintConfig
  patient: Patient
  visit: Visit
  clinic: Clinic
  /** Draw the margin box and the pre-printed area on every page, for lining a layout up with a pad. */
  guides?: boolean
  /** Told how many pages the prescription runs to, whenever that changes. */
  onPages?: (pages: number) => void
}

let breaks: boolean | null = null
/**
 * Whether this browser will break a column of stacked sections (which is what the sheet is)
 * from one column into the next. Pages can be shown on screen only where it does; tried once.
 */
function breaksIntoColumns(): boolean {
  if (breaks != null) return breaks
  const probe = document.createElement('div')
  probe.style.cssText = 'position:absolute;visibility:hidden;left:-9999px;top:0;width:100px;height:100px;column-count:1;column-gap:0;column-fill:auto'
  probe.innerHTML = '<div style="display:flex;flex-direction:column"><div style="height:80px"></div><div style="height:80px"></div></div>'
  document.body.appendChild(probe)
  breaks = probe.scrollWidth > 150
  probe.remove()
  return breaks
}

/**
 * A prescription shown as the pages it will print on: when it runs past the foot of the first
 * page, the second page is there to be seen, with its own top margin, and so on.
 *
 * On paper the browser's print engine breaks the one sheet (`RxSheet`) across pages. On screen
 * the same engine is asked to break the same sheet across columns, each as wide and as tall as
 * a page's printable area, and each page drawn here is a window onto one of those columns. So
 * the breaks fall where they will in print, by the same rules (a medicine or a boxed section
 * is never split). The sheet that actually prints is kept beside the pages, out of sight until
 * printing, and is exactly what it was before there were pages on screen.
 *
 * Only the top margin differs between the first page and the rest. Columns are all one
 * height, so they are as tall as a later page, and the first is made to hold less (or more) by
 * a block at its head: as tall as the difference, or pulled up by it.
 *
 * A browser that will not break the sheet into columns shows it as the one long sheet it
 * used to be; what prints is the same either way.
 */
export default function RxPages({ config: c, patient, visit, clinic, guides, onPages }: Props) {
  const flow = useRef<HTMLDivElement>(null)
  const [paged] = useState(breaksIntoColumns)
  const [pages, setPages] = useState(1)
  const told = useRef(0)

  // Counted after every drawing: the prescription, the layout or a late image may have changed its length.
  useLayoutEffect(() => {
    const el = flow.current
    if (!el) return
    const count = () => {
      if (el.clientWidth === 0) return
      const n = Math.max(1, Math.round(el.scrollWidth / el.clientWidth))
      setPages(n)
      if (told.current !== n) {
        told.current = n
        onPages?.(n)
      }
    }
    count()
    // The letterhead's logo, the signature and the text face may arrive after the first drawing.
    el.addEventListener('load', count, true)
    let live = true
    void document.fonts?.ready.then(() => {
      if (live) count()
    })
    return () => {
      live = false
      el.removeEventListener('load', count, true)
    }
  })

  const sheet = <RxSheet config={c} patient={patient} visit={visit} clinic={clinic} guides={guides} />
  if (!paged) return sheet

  const mm = (n: number) => `${Math.round(n * 100) / 100}mm`
  // What a page has for the prescription between its margins: the first page, and the rest.
  const first = c.paper.height - c.margin.top - c.margin.bottom
  const later = c.paper.height - c.margin.top_next - c.margin.bottom
  const lead = later - first
  return (
    <>
      <div className="rx-pages no-print">
        {Array.from({ length: pages }, (_, i) => (
          <div className="rx-leaf" key={i}>
            {pages > 1 && <div className="rx-cap">Page {i + 1} of {pages}</div>}
            <div
              className={guides ? 'rx-page guides' : 'rx-page'}
              role="group"
              aria-label={pages > 1 ? `Page ${i + 1} of ${pages}` : 'Prescription'}
              style={{ width: mm(c.paper.width), height: mm(c.paper.height), '--mt': mm(i === 0 ? c.margin.top : c.margin.top_next), '--mr': mm(c.margin.right), '--mb': mm(c.margin.bottom), '--ml': mm(c.margin.left) } as CSSProperties}
            >
              {i === 0 && preprinted(c) && <div className="preprint" aria-hidden="true">Pre-printed letterhead area · {c.margin.top} mm left clear</div>}
              {/* Every page holds the whole prescription and shows one column of it; only the first is read out. */}
              <div className="rx-window" style={{ height: mm(i === 0 ? first : later) }} aria-hidden={i > 0 || undefined}>
                <div className="rx-flow" ref={i === 0 ? flow : undefined} style={{ height: mm(later), transform: `translate(${-100 * i}%, ${i === 0 ? mm(-lead) : '0'})` }}>
                  <div style={{ height: mm(Math.max(lead, 0)), marginTop: mm(Math.min(lead, 0)) }} />
                  <RxSheet config={c} patient={patient} visit={visit} clinic={clinic} />
                </div>
              </div>
              {c.page_numbers && <div className="rx-pageno" aria-hidden="true">Page {i + 1} of {pages}</div>}
            </div>
          </div>
        ))}
      </div>
      <div className="rx-print">{sheet}</div>
    </>
  )
}
