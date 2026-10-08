import { useEffect, useMemo, useState } from 'react'
import { formatDate, todayISO } from '../lib/age'
import { latestPerTest } from '../lib/investigations'
import { store } from '../lib/store'
import type { Investigation, Result, ResultFlag } from '../lib/types'
import DateField from './DateField'

const FLAGS: { key: ResultFlag; label: string }[] = [
  { key: 'low', label: 'Low' },
  { key: '', label: 'Normal' },
  { key: 'high', label: 'High' },
]

function Flag({ flag }: { flag: ResultFlag }) {
  if (!flag) return null
  return <span className="flag">{flag === 'low' ? 'Low' : 'High'}</span>
}

/**
 * A patient's investigation results with an entry form. "latest" shows one row per test
 * (newest value, with the previous one beside it); "all" lists every result.
 */
export default function Results({ patientId, catalog, mode }: { patientId: string; catalog: Investigation[]; mode: 'latest' | 'all' }) {
  const [list, setList] = useState<Result[] | null>(null)
  const [adding, setAdding] = useState(false)
  const [d, setD] = useState({ test: '', value: '', unit: '', date: todayISO(), flag: '' as ResultFlag })
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const reload = () => store.listResults(patientId).then(setList, (e: Error) => { setError(e.message); setList([]) })
  useEffect(() => {
    void reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId])

  const latest = useMemo(() => latestPerTest(list ?? []), [list])

  function pickTest(name: string) {
    const hit = catalog.find((i) => i.name.toLowerCase() === name.trim().toLowerCase())
    setD((old) => ({ ...old, test: name, unit: hit ? hit.unit : old.unit }))
  }

  const dateBad = !d.date || d.date > todayISO()
  // Not a <form>: this card also sits inside the visit form, and forms cannot nest.
  async function submit() {
    if (busy || !d.test.trim() || !d.value.trim() || dateBad) return
    setBusy(true)
    setError('')
    try {
      await store.saveResult({ patient_id: patientId, test: d.test.trim(), value: d.value.trim(), unit: d.unit.trim(), result_date: d.date, flag: d.flag })
      await reload()
      // Keep the date: several results from one report are usually entered together.
      setD((old) => ({ test: '', value: '', unit: '', date: old.date, flag: '' }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the result.')
    }
    setBusy(false)
  }

  return (
    <section className="card">
      <div className="card-head">
        <h2 className="grow">{mode === 'latest' ? 'Latest results' : 'Investigation results'}</h2>
        {!adding && (
          <button type="button" className="btn small" onClick={() => setAdding(true)}>+ Enter result</button>
        )}
      </div>
      {error && <div className="alert" style={{ margin: 12 }}>{error}</div>}

      {adding && (
        <div
          className="result-form"
          role="group"
          aria-label="Enter a result"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') {
              e.preventDefault()
              e.stopPropagation()
              void submit()
            }
          }}
        >
          <label className="field wide">
            Test
            <input list="test-names" value={d.test} onChange={(e) => pickTest(e.target.value)} autoComplete="off" autoFocus />
            <datalist id="test-names">
              {catalog.map((i) => <option key={i.id} value={i.name} />)}
            </datalist>
          </label>
          <label className="field">
            Result
            <input className="num" value={d.value} onChange={(e) => setD({ ...d, value: e.target.value })} autoComplete="off" />
          </label>
          <label className="field">
            Unit
            <input value={d.unit} onChange={(e) => setD({ ...d, unit: e.target.value })} autoComplete="off" />
          </label>
          <label className="field">
            Report date
            <DateField value={d.date} max={todayISO()} onChange={(v) => setD({ ...d, date: v })} />
            {dateBad && <span className="err">Enter a date that is not in the future.</span>}
          </label>
          <div className="field wide">
            <span id="flag-label">Against the lab's range</span>
            <div className="seg" role="group" aria-labelledby="flag-label">
              {FLAGS.map((fl) => (
                <button type="button" key={fl.label} aria-pressed={d.flag === fl.key} onClick={() => setD({ ...d, flag: fl.key })} style={{ minWidth: 0 }}>{fl.label}</button>
              ))}
            </div>
          </div>
          <div className="row end wide">
            <button type="button" className="btn small" onClick={() => setAdding(false)}>Done</button>
            <button type="button" className="btn small primary" disabled={busy || !d.test.trim() || !d.value.trim() || dateBad} onClick={() => void submit()}>Save result</button>
          </div>
        </div>
      )}

      {list === null && <div className="empty">Loading…</div>}
      {list && list.length === 0 && <div className="empty">No results recorded yet.</div>}

      {mode === 'latest'
        ? latest.map(({ latest: r, previous }) => (
            <div className="rrow" key={r.id}>
              <div className="rname">{r.test} <Flag flag={r.flag} /></div>
              <div className={r.flag ? 'mono rval off' : 'mono rval'}>{r.value} {r.unit}</div>
              <div className="muted rdate">
                {formatDate(r.result_date)}
                {previous && <span className="rprev"> · was {previous.value} on {formatDate(previous.result_date)}</span>}
              </div>
            </div>
          ))
        : list?.map((r) => (
            <div className="rrow" key={r.id}>
              <div className="rname">{r.test} <Flag flag={r.flag} /></div>
              <div className={r.flag ? 'mono rval off' : 'mono rval'}>{r.value} {r.unit}</div>
              <div className="muted rdate">{formatDate(r.result_date)}</div>
              {confirmId === r.id ? (
                <div className="row" style={{ gap: 6 }}>
                  <button type="button" className="btn small" onClick={() => setConfirmId(null)}>Keep</button>
                  <button type="button" className="btn danger small" onClick={() => { setConfirmId(null); store.deleteResult(r.id).then(reload, (e: Error) => setError(e.message)) }}>Delete</button>
                </div>
              ) : (
                <button type="button" className="btn small" aria-label={`Delete ${r.test} result of ${formatDate(r.result_date)}`} onClick={() => setConfirmId(r.id)}>Delete</button>
              )}
            </div>
          ))}
    </section>
  )
}
