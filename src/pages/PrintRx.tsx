import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import FitSheet from '../components/FitSheet'
import RxSheet from '../components/RxSheet'
import { describe, pageCss, rememberLayout, rememberedLayout, STANDARD } from '../lib/printlayout'
import type { PrintConfig, PrintLayout } from '../lib/printlayout'
import { SAMPLE_PATIENT, SAMPLE_VISIT, sampleClinic } from '../lib/printsample'
import { EMPTY_CLINIC, store } from '../lib/store'
import type { Clinic, Patient, Visit } from '../lib/types'

const PREVIEW = !!import.meta.env.VITE_PREVIEW
const BUILT_IN = 'standard'

/**
 * The print screen. With a patient and visit in the address it prints that prescription;
 * as `/print-sample/:layoutId` it prints a made-up one, for lining a layout up with a pad.
 */
export default function PrintRx() {
  const { id = '', vid = '', layoutId } = useParams()
  const sample = !vid
  const [data, setData] = useState<{ p: Patient; v: Visit; c: Clinic } | null | undefined>(undefined)
  const [layouts, setLayouts] = useState<PrintLayout[]>([])
  const [chosen, setChosen] = useState<string>(layoutId ?? '')
  const [guides, setGuides] = useState(sample)
  const [error, setError] = useState('')

  useEffect(() => {
    const record = sample ? Promise.resolve([SAMPLE_PATIENT, SAMPLE_VISIT] as const) : Promise.all([store.getPatient(id), store.getVisit(vid)])
    Promise.all([record, store.getClinic(), store.listPrintLayouts()]).then(
      ([[p, v], c, ls]) => {
        setLayouts(ls)
        setData(p && v && v.patient_id === p.id ? { p, v, c: sample ? sampleClinic(c ?? EMPTY_CLINIC) : (c ?? EMPTY_CLINIC) } : null)
        // The pad last used on this computer wins; otherwise the account's default.
        const wanted = layoutId ?? rememberedLayout()
        setChosen(ls.some((l) => l.id === wanted) ? (wanted as string) : wanted === BUILT_IN ? BUILT_IN : (ls.find((l) => l.is_default)?.id ?? BUILT_IN))
      },
      (e: Error) => {
        setError(e.message)
        setData(null)
      },
    )
  }, [id, vid, layoutId, sample])

  const config: PrintConfig = useMemo(() => layouts.find((l) => l.id === chosen)?.config ?? STANDARD, [layouts, chosen])

  if (data === undefined) return <main className="page muted">Loading…</main>
  if (data === null)
    return (
      <main className="page">
        <div className="alert">{error || 'This prescription could not be found.'}</div>
        <Link to={sample ? '/settings?tab=print' : `/patients/${id}`}>Go back</Link>
      </main>
    )

  const { p, v, c } = data
  const noHeader = !sample && !c.doctor_name.trim() && config.sections.some((s) => s.key === 'letterhead' && s.show)

  return (
    <main className="sheet-wrap">
      {/* Paper size and margins for the browser's print engine, from the chosen layout. */}
      <style>{pageCss(config)}</style>
      <div className="sheet-tools no-print">
        {sample ? (
          <Link to="/settings?tab=print" className="btn">Back to layouts</Link>
        ) : (
          <>
            <Link to={`/patients/${id}`} className="btn">Back to patient</Link>
            <Link to={`/patients/${id}/visits/${vid}`} className="btn">Edit visit</Link>
          </>
        )}
        <label className="sort" style={{ flex: '1 1 220px' }}>
          Layout
          <select value={chosen} onChange={(e) => { setChosen(e.target.value); rememberLayout(e.target.value) }} style={{ flex: 1, minWidth: 0 }}>
            <option value={BUILT_IN}>Standard A4</option>
            {layouts.map((l) => <option key={l.id} value={l.id}>{l.name}{l.is_default ? ' (default)' : ''}</option>)}
          </select>
        </label>
        <button type="button" className="switch" role="switch" aria-checked={guides} onClick={() => setGuides(!guides)}>
          <span className="track" />
          Margin guides
        </button>
        {PREVIEW ? (
          <span className="muted">Printing is switched off in this preview; it works in the deployed app.</span>
        ) : (
          <button type="button" className="btn primary" onClick={() => window.print()}>Print</button>
        )}
      </div>
      <div className="sheet-tools no-print muted" style={{ fontSize: 13 }}>
        <span className="grow">{describe(config)}. In the print window choose the same paper size, set margins to "Default" and scale to 100%.</span>
        {!sample && <Link to="/settings?tab=print" className="tap">Customise layouts</Link>}
      </div>
      {sample && <div className="note no-print" style={{ width: '100%', maxWidth: '210mm' }}>A made-up prescription. Print it on the real pad with "Margin guides" on to see where the text will fall, then adjust the layout's margins.</div>}
      {noHeader && (
        <div className="note no-print" style={{ width: '100%', maxWidth: '210mm' }}>
          The letterhead is empty. Add the doctor and clinic details under <Link to="/settings">Settings</Link>.
        </div>
      )}
      <FitSheet paperWidthMm={config.paper.width}>
        <RxSheet config={config} patient={p} visit={v} clinic={c} guides={guides} />
      </FitSheet>
    </main>
  )
}
