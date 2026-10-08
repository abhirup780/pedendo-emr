import type { CSSProperties, ReactNode } from 'react'
import { BREAST, EMPTY_TANNER, GENITAL, isBlank, ORCHIDOMETER, OTHER_SIGNS, PUBIC, pubertyFlag, tannerSummary } from '../lib/tanner'
import type { Sex, Tanner } from '../lib/types'

// Schematic pictograms drawn with plain shapes; sizes per stage 1 to 5.
const G_ICON = [
  { bw: 9, bh: 16, ow: 10, oh: 13 },
  { bw: 9, bh: 17, ow: 13, oh: 17 },
  { bw: 10, bh: 24, ow: 15, oh: 20 },
  { bw: 13, bh: 28, ow: 18, oh: 24 },
  { bw: 15, bh: 32, ow: 21, oh: 28 },
]
const B_ICON = [
  { w: 3, h: 10, mw: 0, mh: 0 },
  { w: 9, h: 24, mw: 0, mh: 0 },
  { w: 17, h: 38, mw: 0, mh: 0 },
  { w: 21, h: 46, mw: 7, mh: 16 },
  { w: 27, h: 54, mw: 4, mh: 9 },
]
const P_ICON = [
  { w: 0, h: 0, d: 6, tint: false },
  { w: 14, h: 14, d: 6, tint: false },
  { w: 28, h: 27, d: 5, tint: false },
  { w: 46, h: 42, d: 4, tint: true },
  { w: 62, h: 46, d: 4, tint: true },
]

function Scale(props: { title: string; hint?: string; code: string; value: number | null; onPick: (n: number | null) => void; caps: { cap: string; text: string }[]; icon: (i: number) => ReactNode }) {
  return (
    <div>
      <div className="row" style={{ gap: '2px 10px', marginBottom: 8 }}>
        <h3 className="t-title">{props.title}</h3>
        {props.hint && <span className="muted" style={{ fontSize: 13 }}>{props.hint}</span>}
      </div>
      <div className="t-tiles">
        {props.caps.map((c, i) => {
          const on = props.value === i + 1
          return (
            <button type="button" key={i} className="t-tile" aria-pressed={on} title={c.text} onClick={() => props.onPick(on ? null : i + 1)}>
              <span className="t-icon" aria-hidden="true">{props.icon(i)}</span>
              <span className="t-code">{props.code}{i + 1}</span>
              <span className="t-cap">{c.cap}</span>
            </button>
          )
        })}
      </div>
      {props.value != null && <div className="muted" style={{ fontSize: 13, marginTop: 6 }}><span className="mono">{props.code}{props.value}</span> — {props.caps[props.value - 1].text}</div>}
    </div>
  )
}

export default function TannerPicker({ value, onChange, sex, ageYears }: { value: Tanner | null; onChange: (t: Tanner | null) => void; sex: Sex; ageYears: number | null }) {
  const t = value ?? EMPTY_TANNER
  const set = (patch: Partial<Tanner>) => {
    const next = { ...t, ...patch }
    onChange(isBlank(next) ? null : next)
  }
  const flag = pubertyFlag(value, sex, ageYears)
  const summary = tannerSummary(value, sex)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {sex !== 'F' && (
        <Scale
          title="Genital stage" code="G" value={t.g} onPick={(n) => set({ g: n })} caps={GENITAL}
          icon={(i) => (
            <span className="g-icon">
              <span className="bar" style={{ width: G_ICON[i].bw, height: G_ICON[i].bh }} />
              <span className="pair">
                <span style={{ width: G_ICON[i].ow, height: G_ICON[i].oh }} />
                <span style={{ width: G_ICON[i].ow, height: G_ICON[i].oh }} />
              </span>
            </span>
          )}
        />
      )}
      {sex !== 'M' && (
        <Scale
          title="Breast stage" hint="Side-profile outline" code="B" value={t.b} onPick={(n) => set({ b: n })} caps={BREAST}
          icon={(i) => (
            <span className="b-icon">
              <span className="wall" />
              <span className="mound" style={{ width: B_ICON[i].w, height: B_ICON[i].h }} />
              {B_ICON[i].mw > 0 && <span className="mound second" style={{ width: B_ICON[i].mw, height: B_ICON[i].mh }} />}
            </span>
          )}
        />
      )}

      <Scale
        title="Pubic hair stage" code="P" value={t.p} onPick={(n) => set({ p: n })} caps={PUBIC}
        icon={(i) => (
          <span className="p-icon">
            <span className="field-shape" />
            <span className={P_ICON[i].tint ? 'hair tint' : 'hair'} style={{ width: P_ICON[i].w, height: P_ICON[i].h, '--d': `${P_ICON[i].d}px` } as CSSProperties} />
          </span>
        )}
      />

      {sex !== 'F' && (
        <div>
          <div className="row" style={{ gap: '2px 10px', marginBottom: 6 }}>
            <h3 className="t-title">{sex === 'U' ? 'Gonadal volume, if palpable' : 'Testicular volume'}</h3>
            <span className="muted" style={{ fontSize: 13 }}>Orchidometer beads, mL · 4 mL and above marks pubertal onset</span>
          </div>
          {(['testis_r', 'testis_l'] as const).map((side) => (
            <div className="bead-row" key={side}>
              <div className="bead-side">{side === 'testis_r' ? 'Right' : 'Left'}</div>
              <div className="beads">
                {ORCHIDOMETER.map((v) => {
                  const on = t[side] === v
                  const len = Math.round(15 * Math.cbrt(v))
                  return (
                    <button type="button" key={v} className="bead" aria-pressed={on} aria-label={`${side === 'testis_r' ? 'Right' : 'Left'} testis ${v} mL`} onClick={() => set({ [side]: on ? null : v })}>
                      <span className={v < 4 ? 'oval pre' : 'oval'} aria-hidden="true" style={{ height: len, width: Math.round(len * 0.66) }} />
                      <span className="mono">{v}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <div>
        <h3 className="t-title" style={{ marginBottom: 8 }}>Other signs</h3>
        <div className="tags">
          {OTHER_SIGNS[sex].map((s) => {
            const on = t.signs.includes(s)
            return (
              <button type="button" key={s} className="chip sign" aria-pressed={on} onClick={() => set({ signs: on ? t.signs.filter((x) => x !== s) : [...t.signs, s] })}>
                {s}
              </button>
            )
          })}
        </div>
      </div>

      <div className="t-summary">
        <div className="grow">
          <div className="mono" style={{ fontSize: 18, fontWeight: 500 }}>{summary || 'Not staged'}</div>
          {flag && <div className={flag.alert ? 'pill warn' : 'pill ok'} style={{ display: 'inline-block', marginTop: 6 }}>{flag.text}</div>}
        </div>
        {value && <button type="button" className="btn small" onClick={() => onChange(null)}>Clear staging</button>}
      </div>
    </div>
  )
}
