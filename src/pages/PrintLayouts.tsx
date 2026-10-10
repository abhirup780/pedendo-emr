import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import FitSheet from '../components/FitSheet'
import Glide from '../components/Glide'
import RxPages from '../components/RxPages'
import { RowsSkeleton } from '../components/Skeleton'
import { ACCENTS, describe, normalize, PAPERS, PRESETS, SECTIONS } from '../lib/printlayout'
import type { PrintConfig, PrintLayout, SectionKey } from '../lib/printlayout'
import { SAMPLE_PATIENT, SAMPLE_VISIT, sampleClinic } from '../lib/printsample'
import { EMPTY_CLINIC, store } from '../lib/store'
import type { Clinic } from '../lib/types'

type Draft = Omit<PrintLayout, 'id'> & { id?: string }

/** A number box in millimetres (or another unit). Keeps what is typed; limits apply on save. */
function Num(props: { label: string; value: number; onChange: (n: number) => void; unit?: string; step?: number; min?: number; max?: number; hint?: string }) {
  return (
    <label className="field">
      <span>{props.label}{props.unit !== '' && <span className="muted"> ({props.unit ?? 'mm'})</span>}</span>
      <input className="num" type="number" inputMode="decimal" step={props.step ?? 1} min={props.min ?? 0} max={props.max} value={Number.isFinite(props.value) ? props.value : ''} onChange={(e) => props.onChange(e.target.value === '' ? NaN : Number(e.target.value))} />
      {props.hint && <span className="hint">{props.hint}</span>}
    </label>
  )
}

function Toggle({ on, onChange, children }: { on: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <button type="button" className="switch compact" role="switch" aria-checked={on} onClick={() => onChange(!on)}>
      <span className="track" />
      <span>{children}</span>
    </button>
  )
}

function Choice<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  const id = `ch-${label.replace(/\W+/g, '-')}`
  return (
    <div className="field">
      <span id={id}>{label}</span>
      <Glide className="seg" role="group" aria-labelledby={id}>
        {options.map((o) => (
          <button type="button" key={o.value} aria-pressed={value === o.value} onClick={() => onChange(o.value)} style={{ minWidth: 0 }}>{o.label}</button>
        ))}
      </Glide>
    </div>
  )
}

/** The live preview: the real pages, shrunk to the width of the panel. More than the panel has room for scrolls inside it. */
function Preview({ config, clinic, guides, onPages }: { config: PrintConfig; clinic: Clinic; guides: boolean; onPages: (pages: number) => void }) {
  return (
    <FitSheet paperWidthMm={config.paper.width} className="pl-preview" label="Preview of the printed pages">
      <RxPages config={config} patient={SAMPLE_PATIENT} visit={SAMPLE_VISIT} clinic={sampleClinic(clinic)} guides={guides} onPages={onPages} />
    </FitSheet>
  )
}

function Editor({ start, clinic, onDone }: { start: Draft; clinic: Clinic; onDone: (saved: PrintLayout | null) => void }) {
  const nav = useNavigate()
  const [name, setName] = useState(start.name)
  const [isDefault, setIsDefault] = useState(start.is_default)
  const [c, setC] = useState<PrintConfig>(start.config)
  const [guides, setGuides] = useState(true)
  // How many pages the sample runs to in this layout.
  const [pages, setPages] = useState(1)
  // On a phone the preview opens over the form instead of sitting beside it.
  const [peek, setPeek] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  // What will be saved and printed: the typed values brought within limits.
  const shown = useMemo(() => normalize(c), [c])
  const set = (patch: Partial<PrintConfig>) => setC((old) => ({ ...old, ...patch }))
  const twoCol = c.side_width > 0
  const standardSize = PAPERS.some((p) => (p.width === c.paper.width && p.height === c.paper.height) || (p.width === c.paper.height && p.height === c.paper.width))
  const [customChosen, setCustomChosen] = useState(!standardSize)
  const custom = customChosen || !standardSize
  const lhShown = c.sections.find((s) => s.key === 'letterhead')?.show ?? false

  const setSection = (key: SectionKey, patch: object) => set({ sections: c.sections.map((s) => (s.key === key ? { ...s, ...patch } : s)) })
  function move(i: number, by: number) {
    const j = i + by
    if (j < 0 || j >= c.sections.length) return
    const next = [...c.sections]
    ;[next[i], next[j]] = [next[j], next[i]]
    set({ sections: next })
  }

  async function save(thenSample: boolean) {
    if (!name.trim()) return setError('Give the layout a name.')
    setBusy(true)
    setError('')
    try {
      const saved = await store.savePrintLayout({ id: start.id, name, is_default: isDefault, config: shown })
      if (thenSample) nav(`/print-sample/${saved.id}`)
      else onDone(saved)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not save the layout.'
      setError(/duplicate key/i.test(msg) ? 'Another layout already has that name.' : msg)
      setBusy(false)
    }
  }

  return (
    <div className="cols">
      <div className="main" style={{ flex: '1 1 420px' }}>
        {error && <div className="alert">{error}</div>}
        <section className="card pad pl-card">
          <h2>{start.id ? 'Edit layout' : 'New layout'}</h2>
          <label className="field">
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. City Clinic pad" autoComplete="off" />
            <span className="hint">Name it after the clinic or pad it is for.</span>
          </label>
          <Toggle on={isDefault} onChange={setIsDefault}>Use as the default layout</Toggle>
        </section>

        <section className="card pad pl-card">
          <h2>Paper</h2>
          <div className="tags">
            {PAPERS.map((p) => (
              <button type="button" key={p.name} className="chip plain" aria-pressed={!custom && Math.min(c.paper.width, c.paper.height) === Math.min(p.width, p.height) && Math.max(c.paper.width, c.paper.height) === Math.max(p.width, p.height)} onClick={() => { setCustomChosen(false); set({ paper: { ...p } }) }}>{p.name}</button>
            ))}
            <button type="button" className="chip plain" aria-pressed={custom} onClick={() => setCustomChosen(true)}>Custom size</button>
          </div>
          <div className="pl-grid">
            <Num label="Width" value={c.paper.width} step={0.1} onChange={(n) => set({ paper: { ...c.paper, name: 'Custom', width: n } })} />
            <Num label="Height" value={c.paper.height} step={0.1} onChange={(n) => set({ paper: { ...c.paper, name: 'Custom', height: n } })} />
            <div className="field"><span>&nbsp;</span><button type="button" className="btn" onClick={() => set({ paper: { name: c.paper.name, width: c.paper.height, height: c.paper.width } })}>Turn sideways</button></div>
          </div>
        </section>

        <section className="card pad pl-card">
          <h2>Margins</h2>
          <div className="muted">For a pre-printed pad, measure the printed header and footer with a ruler and enter them as the top and bottom margins. Nothing prints inside a margin.</div>
          <div className="pl-grid">
            <Num label="Top, first page" value={c.margin.top} onChange={(n) => set({ margin: { ...c.margin, top: n } })} />
            <Num label="Top, later pages" value={c.margin.top_next} onChange={(n) => set({ margin: { ...c.margin, top_next: n } })} />
            <Num label="Bottom" value={c.margin.bottom} onChange={(n) => set({ margin: { ...c.margin, bottom: n } })} />
            <Num label="Left" value={c.margin.left} onChange={(n) => set({ margin: { ...c.margin, left: n } })} />
            <Num label="Right" value={c.margin.right} onChange={(n) => set({ margin: { ...c.margin, right: n } })} />
          </div>
        </section>

        <section className="card pad pl-card">
          <h2>Text and spacing</h2>
          <div className="pl-grid">
            <Num label="Text size" unit="pt" step={0.5} min={7} max={16} value={c.font_pt} onChange={(n) => set({ font_pt: n })} />
            <Num label="Line spacing" unit="" step={0.05} min={1} max={2.2} value={c.line_height} onChange={(n) => set({ line_height: n })} />
            <Num label="Space between sections" step={0.5} value={c.gap} onChange={(n) => set({ gap: n })} />
          </div>
          <div className="field">
            <span id="accent-label">Colour of headings and the ℞ mark</span>
            <div className="tags" role="group" aria-labelledby="accent-label">
              {ACCENTS.map((a) => (
                <button type="button" key={a.value} className="chip plain" aria-pressed={c.accent === a.value} onClick={() => set({ accent: a.value })}>
                  <span style={{ width: 12, height: 12, borderRadius: 3, background: a.value, border: '1px solid #fff' }} />{a.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="card pad pl-card">
          <h2>Sections</h2>
          <div className="muted">Switch a section off to leave it out. Use the arrows to change the order, and "space above" to push a section down the page.</div>
          <Toggle on={twoCol} onChange={(v) => set({ side_width: v ? 55 : 0 })}>Side column for findings (two-column pad)</Toggle>
          {twoCol && (
            <div className="pl-grid">
              <Num label="Side column width" value={c.side_width} onChange={(n) => set({ side_width: n })} />
              <div className="field"><span>&nbsp;</span><Toggle on={c.side_rule} onChange={(v) => set({ side_rule: v })}>Line between the columns</Toggle></div>
            </div>
          )}
          <ol className="pl-sections">
            {c.sections.map((s, i) => {
              const def = SECTIONS.find((d) => d.key === s.key)!
              return (
                <li key={s.key} className={s.show ? '' : 'off'}>
                  <div className="pl-move">
                    <button type="button" className="icon-btn" aria-label={`Move ${def.label} up`} disabled={i === 0} onClick={() => move(i, -1)}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 15l6-6 6 6" /></svg>
                    </button>
                    <button type="button" className="icon-btn" aria-label={`Move ${def.label} down`} disabled={i === c.sections.length - 1} onClick={() => move(i, 1)}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
                    </button>
                  </div>
                  <button type="button" className="switch compact pl-name" role="switch" aria-checked={s.show} aria-label={`Print ${def.label}`} onClick={() => setSection(s.key, { show: !s.show })}>
                    <span className="track" />
                    <span><span className="t">{def.label}</span>{def.hint && <span className="hint">{def.hint}</span>}</span>
                  </button>
                  {s.show && twoCol && !def.full && (
                    <button type="button" className="chip plain" aria-pressed={s.side} onClick={() => setSection(s.key, { side: !s.side })}>{s.side ? 'Side column' : 'Main column'}</button>
                  )}
                  {s.show && (
                    <label className="pl-space">
                      <span className="muted">Space above</span>
                      <input type="number" min={0} max={120} step={1} aria-label={`Space above ${def.label}, mm`} value={Number.isFinite(s.space_before) ? s.space_before : ''} onChange={(e) => setSection(s.key, { space_before: e.target.value === '' ? NaN : Number(e.target.value) })} />
                      <span className="muted">mm</span>
                    </label>
                  )}
                </li>
              )
            })}
          </ol>
        </section>

        {lhShown && (
          <section className="card pad pl-card">
            <h2>Letterhead</h2>
            <Choice label="Clinic lines" value={c.letterhead.source} options={[{ value: 'settings', label: 'From Settings' }, { value: 'custom', label: 'This clinic only' }]} onChange={(v) => set({ letterhead: { ...c.letterhead, source: v } })} />
            {c.letterhead.source === 'custom' && (
              <div className="form-grid">
                <label className="field">Clinic name<input value={c.letterhead.clinic_name} onChange={(e) => set({ letterhead: { ...c.letterhead, clinic_name: e.target.value } })} /></label>
                <label className="field">Phone<input value={c.letterhead.phone} onChange={(e) => set({ letterhead: { ...c.letterhead, phone: e.target.value } })} /></label>
                <label className="field wide">Address<textarea rows={2} value={c.letterhead.address} onChange={(e) => set({ letterhead: { ...c.letterhead, address: e.target.value } })} /></label>
                <label className="field">Email<input value={c.letterhead.email} onChange={(e) => set({ letterhead: { ...c.letterhead, email: e.target.value } })} /></label>
              </div>
            )}
            <span className="hint">The doctor's name, qualifications and registration number always come from Settings → Letterhead.</span>
            <Choice label="Arrangement" value={c.letterhead.arrangement} options={[{ value: 'split', label: 'Doctor left, clinic right' }, { value: 'centred', label: 'Centred' }]} onChange={(v) => set({ letterhead: { ...c.letterhead, arrangement: v } })} />
            <Toggle on={c.letterhead.logo} onChange={(v) => set({ letterhead: { ...c.letterhead, logo: v } })}>Print the clinic logo</Toggle>
            <Toggle on={c.letterhead.rule} onChange={(v) => set({ letterhead: { ...c.letterhead, rule: v } })}>Line under the letterhead</Toggle>
          </section>
        )}

        <section className="card pad pl-card">
          <h2>Details</h2>
          <Toggle on={c.patient.mrn} onChange={(v) => set({ patient: { ...c.patient, mrn: v } })}>MRN on the patient line</Toggle>
          <Toggle on={c.patient.date} onChange={(v) => set({ patient: { ...c.patient, date: v } })}>Date on the patient line</Toggle>
          <Choice label="Measurements" value={c.vitals} options={[{ value: 'boxes', label: 'Boxes' }, { value: 'inline', label: 'One line' }]} onChange={(v) => set({ vitals: v })} />
          <Choice label="Medicines" value={c.rx.style} options={[{ value: 'detailed', label: 'Name, then directions below' }, { value: 'compact', label: 'One line each' }]} onChange={(v) => set({ rx: { ...c.rx, style: v } })} />
          <Toggle on={c.rx.symbol} onChange={(v) => set({ rx: { ...c.rx, symbol: v } })}>Print the ℞ mark (off if the pad already has one)</Toggle>
          <Toggle on={c.signature.at_foot} onChange={(v) => set({ signature: { ...c.signature, at_foot: v } })}>Keep the signature at the foot of the page</Toggle>
          <Toggle on={c.signature.review_beside} onChange={(v) => set({ signature: { ...c.signature, review_beside: v } })}>Next review date on the same row as the signature</Toggle>
          <Toggle on={c.signature.image} onChange={(v) => set({ signature: { ...c.signature, image: v } })}>Print the signature image, if one is set</Toggle>
          <Toggle on={c.signature.name} onChange={(v) => set({ signature: { ...c.signature, name: v } })}>Doctor's name under the signature line</Toggle>
          <Toggle on={c.signature.patient} onChange={(v) => set({ signature: { ...c.signature, patient: v } })}>Patient and date beside the signature</Toggle>
          <Toggle on={c.page_numbers} onChange={(v) => set({ page_numbers: v })}>Page numbers</Toggle>
          <label className="field">
            Footer note
            <textarea rows={2} value={c.note} onChange={(e) => set({ note: e.target.value })} placeholder="e.g. Timings: Mon–Sat 5–8 pm. Appointments: 0000000000" />
            <span className="hint">Prints only when the "Footer note" section is switched on.</span>
          </label>
        </section>
      </div>

      {/* On a phone: leaving without saving is here with the form, not inside the preview. */}
      <div className="actions pl-mobile-bar">
        <div className="row">
          <button type="button" className="btn" disabled={busy} onClick={() => onDone(null)}>Cancel</button>
          <button type="button" className="btn" style={{ flex: '1 1 0' }} onClick={() => setPeek(true)}>Preview</button>
          <button type="button" className="btn primary" style={{ flex: '2 1 0' }} disabled={busy} onClick={() => void save(false)}>{busy ? 'Saving…' : 'Save layout'}</button>
        </div>
      </div>

      <aside className={peek ? 'side pl-side open' : 'side pl-side'} style={{ flex: '1 1 380px' }}>
        <div className="row">
          <h2 className="grow">Preview</h2>
          <button type="button" className="btn small narrow-only" onClick={() => setPeek(false)}>Back to editing</button>
          <Toggle on={guides} onChange={setGuides}>Margin guides</Toggle>
        </div>
        <div className="muted sm">{describe(shown)}{pages > 1 ? ` · ${pages} pages` : ''} · sample data</div>
        {/* On a phone the panel is not drawn until it is opened. The preview is made anew then, so
            that it is measured in the room it really has, and starts at the first page. */}
        <Preview key={peek ? 'open' : 'shut'} config={shown} clinic={clinic} guides={guides} onPages={setPages} />
        {/* On a phone Cancel is in the bar under the form: in the open preview it read as "close
            the preview", and it left the editor instead. "Back to editing" closes the preview. */}
        <div className="row end">
          <button type="button" className="btn wide-only" disabled={busy} onClick={() => onDone(null)}>Cancel</button>
          <button type="button" className="btn outline" disabled={busy} onClick={() => void save(true)}>Save and print a sample</button>
          <button type="button" className="btn primary" disabled={busy} onClick={() => void save(false)}>{busy ? 'Saving…' : 'Save layout'}</button>
        </div>
      </aside>
    </div>
  )
}

export default function PrintLayouts() {
  const [list, setList] = useState<PrintLayout[] | null>(null)
  const [clinic, setClinic] = useState<Clinic>(EMPTY_CLINIC)
  const [editing, setEditing] = useState<Draft | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function reload() {
    try {
      const [ls, c] = await Promise.all([store.listPrintLayouts(), store.getClinic()])
      setList(ls)
      setClinic(c)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the layouts.')
      setList([])
    }
  }
  useEffect(() => {
    void reload()
  }, [])
  // The list and the editor take turns on one page. Each is shown from its top, not from
  // wherever the other had been scrolled to (the foot of a long form, as a rule).
  const inEditor = editing !== null
  const settled = useRef(false)
  useLayoutEffect(() => {
    if (settled.current) window.scrollTo(0, 0)
    settled.current = true
  }, [inEditor])
  async function run(job: () => Promise<unknown>) {
    setError('')
    try {
      await job()
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
    }
  }
  const freeName = (base: string) => {
    const taken = new Set((list ?? []).map((l) => l.name.toLowerCase()))
    if (!taken.has(base.toLowerCase())) return base
    for (let n = 2; ; n++) if (!taken.has(`${base} ${n}`.toLowerCase())) return `${base} ${n}`
  }

  if (editing) return <Editor key={editing.id ?? editing.name} start={editing} clinic={clinic} onDone={() => { setEditing(null); void reload() }} />

  return (
    <>
      {error && <div className="alert">{error}</div>}
      <section className="card">
        <div className="card-head">
          <div className="grow">
            <h2>Print layouts</h2>
            <div className="muted">One layout for each paper or pre-printed pad you print on. Choose between them on the print screen; each computer remembers the one it used last.</div>
          </div>
        </div>
        <div className="tag-row">
          <div className="grow">
            <div style={{ fontWeight: 600 }}>Standard A4</div>
            <div className="muted sm">Built in: plain paper, the app prints the letterhead. Used when no other layout is chosen.</div>
          </div>
          <Link to="/print-sample/standard" className="btn small quiet">Print a sample</Link>
        </div>
        {list === null && <RowsSkeleton rows={2} />}
        {list?.map((l) => (
          <div className="tag-row" key={l.id}>
            <div className="grow">
              <div style={{ fontWeight: 600 }}>{l.name} {l.is_default && <span className="pill ok" style={{ padding: '2px 8px', fontSize: 12 }}>Default</span>}</div>
              <div className="muted sm">{describe(l.config)}</div>
            </div>
            {confirmId === l.id ? (
              <>
                <span>Delete this layout?</span>
                <button type="button" className="btn small" onClick={() => setConfirmId(null)}>Keep</button>
                <button type="button" className="btn danger small" onClick={() => { setConfirmId(null); void run(() => store.deletePrintLayout(l.id)) }}>Delete</button>
              </>
            ) : (
              <>
                <button type="button" className="btn small primary" onClick={() => setEditing(l)}>Edit</button>
                <Link to={`/print-sample/${l.id}`} className="btn small quiet">Print a sample</Link>
                <button type="button" className="btn small quiet" onClick={() => setEditing({ name: freeName(`${l.name} copy`), is_default: false, config: l.config })}>Duplicate</button>
                {!l.is_default && <button type="button" className="btn small quiet" onClick={() => void run(() => store.savePrintLayout({ ...l, is_default: true }))}>Make default</button>}
                {l.is_default && <button type="button" className="btn small quiet" onClick={() => void run(() => store.savePrintLayout({ ...l, is_default: false }))}>Not default</button>}
                <button type="button" className="btn small quiet danger" aria-label={`Delete layout ${l.name}`} onClick={() => setConfirmId(l.id)}>Delete</button>
              </>
            )}
          </div>
        ))}
      </section>

      <section className="card pad pl-card">
        <h2>New layout</h2>
        <div className="muted">Start from the closest one, then adjust everything.</div>
        <div className="sheet-picks">
          {PRESETS.map((p) => (
            <button type="button" key={p.name} className="sheet-pick" onClick={() => setEditing({ name: freeName(p.name), is_default: false, config: p.config })}>
              <span>
                <span style={{ display: 'block', fontWeight: 600 }}>{p.name}</span>
                <span className="muted" style={{ display: 'block', fontSize: 12.5 }}>{p.about}</span>
              </span>
            </button>
          ))}
        </div>
      </section>
    </>
  )
}
