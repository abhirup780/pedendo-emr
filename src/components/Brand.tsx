/**
 * The AuxoEMR mark: three centile lines of a growth chart fanning out from birth, the middle
 * one drawn strong. Takes the colour of the text around it.
 */
export function Mark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <path d="M3 20.5C10 19.6 16.4 13.4 21 3.5" opacity="0.45" />
      <path d="M3 20.5C11 21 16.8 19.6 21 16.8" opacity="0.45" />
      <path d="M3 20.5C10.6 20.4 16.5 16.6 21 10" />
    </svg>
  )
}

/** The name as it is written everywhere: one word, "EMR" in the accent colour. */
export function Wordmark() {
  return (
    <span className="wordmark">
      Auxo<span>EMR</span>
    </span>
  )
}

const CENTILE_ENDS = [40, 96, 150, 204, 258, 312, 366]
const POINTS = [
  [220, 346],
  [320, 311],
  [420, 271],
  [520, 232],
]

/** Growth-chart lines for the sign-in screen: seven centiles and one child's measurements. */
export function Curves() {
  return (
    <svg className="signin-curves" viewBox="0 0 640 400" preserveAspectRatio="xMinYMax slice" fill="none" strokeLinecap="round" aria-hidden="true">
      {CENTILE_ENDS.map((y, i) => (
        <path key={y} d={`M-10 392C210 ${392 - (392 - y) * 0.12} 430 ${y + (392 - y) * 0.42} 650 ${y}`} stroke="#7fd1c9" strokeWidth={i === 3 ? 2 : 1.2} opacity={i === 3 ? 0.55 : 0.2} />
      ))}
      {POINTS.map(([x, y]) => (
        <circle key={x} cx={x} cy={y} r="4.5" fill="#0f2a31" stroke="#7fd1c9" strokeWidth="2" />
      ))}
    </svg>
  )
}
