import type { ReactNode } from 'react'

/**
 * The app's small pictures, all drawn one way: on a 24 by 24 square, in lines 2 wide with round
 * ends, in the colour of the words beside them. Each sits beside a word and never stands in
 * for one, so screen readers are not told about them.
 */
const PATHS = {
  // The menu
  patients: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <path d="M15.6 5a3.2 3.2 0 0 1 0 6" />
      <path d="M17.8 14.6c1.9 1 3.2 3 3.2 5.4" />
    </>
  ),
  registry: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <path d="M3.5 9.5h17M3.5 14.5h17M9.5 9.5v10" />
    </>
  ),
  settings: (
    <>
      <path d="M4 7h9M17 7h3M4 12h3M11 12h9M4 17h11M19 17h1" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="9" cy="12" r="2" />
      <circle cx="17" cy="17" r="2" />
    </>
  ),
  // Buttons
  plus: <path d="M12 5v14M5 12h14" />,
  pencil: (
    <>
      <path d="M4 20l.9-4.4L15.6 4.9a2.1 2.1 0 0 1 3 0l.5.5a2.1 2.1 0 0 1 0 3L8.4 19.1z" />
      <path d="M13.8 6.7l3.5 3.5" />
    </>
  ),
  chart: (
    <>
      <path d="M4 4v16h16" />
      <path d="M7.5 16.5c4.6-.5 8.2-3.7 10.5-9.5" />
    </>
  ),
  image: (
    <>
      <rect x="3.5" y="5" width="17" height="14" rx="2" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="M4 17.5l4.8-4.3 3.4 2.9 3.2-2.8 4.6 4.2" />
    </>
  ),
  printer: (
    <>
      <path d="M7 9V4h10v5" />
      <path d="M7 17H5.5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H17" />
      <path d="M7 14h10v6H7z" />
    </>
  ),
  download: <path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19.5h14" />,
  back: <path d="M19 12H5M11 6l-6 6 6 6" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  // The headings of cards
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  ruler: (
    <>
      <rect x="8" y="3" width="8" height="18" rx="1.5" />
      <path d="M8 7.5h3M8 12h4.5M8 16.5h3" />
    </>
  ),
  stages: <path d="M4 19h4v-4h4v-4h4V7h4" />,
  notes: (
    <>
      <path d="M6.5 3.5h8L19 8v11a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19V5a1.5 1.5 0 0 1 1.5-1.5z" />
      <path d="M14.5 3.5V8H19" />
      <path d="M8.5 12.5h7M8.5 16.5h4.5" />
    </>
  ),
  flask: (
    <>
      <path d="M9.5 3.5h5" />
      <path d="M10.5 3.5v5.2l-4.9 8.7a2 2 0 0 0 1.7 3.1h9.4a2 2 0 0 0 1.7-3.1l-4.9-8.7V3.5" />
      <path d="M7.9 14.5h8.2" />
    </>
  ),
  results: <path d="M9 7h11M9 12h11M9 17h11M4.5 7h.01M4.5 12h.01M4.5 17h.01" />,
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  person: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c0-3.9 3.1-7 7-7s7 3.1 7 7" />
    </>
  ),
} satisfies Record<string, ReactNode>

export type IconName = keyof typeof PATHS

export function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  return (
    <svg className="ico" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[name]}
    </svg>
  )
}

/**
 * The prescription mark, drawn. Typed as a letter it comes from whichever symbol font the
 * device happens to have, so it looked different on each and printed differently from each.
 * It is as tall as the words it is set in and takes their colour. Where it stands alone (a
 * column's heading) give it `label`, which is read out; beside a word it says nothing.
 */
export function RxMark({ label }: { label?: string }) {
  return (
    <svg className="rx-svg" viewBox="4.4 1.9 15.2 20.2" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <path d="M5.5 19V3H11a4 4 0 0 1 0 8H5.5M9.5 11l9 10M18.5 13.5l-6 7.5" />
    </svg>
  )
}
