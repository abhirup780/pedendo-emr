import type { CSSProperties, ReactNode } from 'react'
import { BREAST, EMPTY_TANNER, GENITAL, isBlank, ORCHIDOMETER, OTHER_SIGNS, PUBIC, pubertyFlag, tannerSummary } from '../lib/tanner'
import type { Sex, Tanner } from '../lib/types'

// Stage drawings: crops of the Tanner scale diagrams by Michał Komorniczak on Wikimedia
// Commons (CC BY-SA 3.0). See src/assets/tanner/README.md; they are cut by scripts/build-tanner.py.
const PICS = import.meta.glob<string>('../assets/tanner/*.svg', { eager: true, query: '?url', import: 'default' })
const pic = (name: string) => PICS[`../assets/tanner/${name}.svg`]

// Only for a child whose sex is not assigned: a neutral pubic hair pictogram from plain shapes.
const P_ICON = [
  { w: 0, h: 0, d: 6, tint: false },
  { w: 14, h: 14, d: 6, tint: false },
  { w: 28, h: 27, d: 5, tint: false },
  { w: 46, h: 42, d: 4, tint: true },
  { w: 62, h: 46, d: 4, tint: true },
]

function Scale(props: { title: string; hint?: string; code: string; value: number | null; onPick: (n: number | null) => void; caps: { cap: string; text: string }[]; icon?: (i: number) => ReactNode }) {
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
            <button type="button" key={i} className={props.icon ? 't-tile' : 't-tile plain'} aria-pressed={on} title={c.text} onClick={() => props.onPick(on ? null : i + 1)}>
              {props.icon && <span className="t-icon" aria-hidden="true">{props.icon(i)}</span>}
              <span className="t-code">{props.code}{i + 1}</span>
              <span className="t-cap">{c.cap}</span>
            </button>
          )
        })}
      </div>
      {props.value != null && <div className="muted" style={{ fontSize: 13, marginTop: 6 }}><span className="mono">{props.code}{props.value}</span>: {props.caps[props.value - 1].text}</div>}
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
      {sex === 'U' && (
        <div className="muted" style={{ fontSize: 13 }}>Sex is not yet assigned, so the stages are listed without the boy and girl drawings.</div>
      )}
      {sex !== 'F' && (
        // The drawings are of a boy or of a girl, so a child whose sex is not assigned gets the
        // stage names and descriptions without a picture.
        <Scale title="Genital stage" code="G" value={t.g} onPick={(n) => set({ g: n })} caps={GENITAL} icon={sex === 'M' ? (i) => <img className="t-pic" src={pic(`g${i + 1}`)} alt="" /> : undefined} />
      )}
      {sex !== 'M' && (
        <Scale title="Breast stage" hint={sex === 'F' ? 'Side profile' : undefined} code="B" value={t.b} onPick={(n) => set({ b: n })} caps={BREAST} icon={sex === 'F' ? (i) => <img className="t-pic" src={pic(`b${i + 1}`)} alt="" /> : undefined} />
      )}

      <Scale
        title="Pubic hair stage" code="P" value={t.p} onPick={(n) => set({ p: n })} caps={PUBIC}
        icon={(i) =>
          sex === 'F' ? (
            <img className="t-pic" src={pic(`pf${i + 1}`)} alt="" />
          ) : sex === 'M' ? (
            // The upper part of the same drawing as the genital stage.
            <span className="t-crop"><img src={pic(`g${i + 1}`)} alt="" /></span>
          ) : (
            <span className="p-icon">
              <span className="field-shape" />
              <span className={P_ICON[i].tint ? 'hair tint' : 'hair'} style={{ width: P_ICON[i].w, height: P_ICON[i].h, '--d': `${P_ICON[i].d}px` } as CSSProperties} />
            </span>
          )
        }
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
