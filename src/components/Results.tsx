import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { formatDate, todayISO } from '../lib/age'
import { historyPerTest, latestPerTest, numericValue, rankedMatches } from '../lib/investigations'
import { store } from '../lib/store'
import type { Investigation, Result, ResultFlag } from '../lib/types'
import DateField from './DateField'
import { RowsSkeleton } from './Skeleton'

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
 * How one test has moved, oldest on the left. Drawn only from values that read as plain
 * numbers in the newest result's unit, and only when there are at least two; the scale is the child's own values, since
 * the app holds no reference ranges.
 */
function Trend({ results }: { results: Result[] }) {
  const unit = results[0].unit.trim().toLowerCase()
  const pts = [...results].reverse().filter((r) => r.unit.trim().toLowerCase() === unit).map((r) => numericValue(r.value)).filter((n): n is number => n != null)
  if (pts.length < 2) return <span className="rspark" />
  const W = 88
  const H = 28
  const min = Math.min(...pts)
  const span = Math.max(...pts) - min || 1
  const x = (i: number) => 4 + (i / (pts.length - 1)) * (W - 8)
  const y = (v: number) => H - 5 - ((v - min) / span) * (H - 10)
  return (
    <svg className="rspark" width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Trend, oldest first: ${pts.join(', ')}`}>
      <polyline points={pts.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')} fill="none" stroke="#6f8083" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx={x(pts.length - 1)} cy={y(pts[pts.length - 1])} r="3" fill="#0b5d66" />
    </svg>
  )
}

const BLANK = { test: '', value: '', unit: '', flag: '' as ResultFlag }

/**
 * A patient's investigation results with an entry form. "latest" shows one row per test
 * (newest value, with the previous one beside it); "all" groups every result by test, with
 * the trend and, opened out, each result to correct or delete.
 */
export default function Results({ patientId, catalog, mode }: { patientId: string; catalog: Investigation[]; mode: 'latest' | 'all' }) {
  const [list, setList] = useState<Result[] | null>(null)
  const [adding, setAdding] = useState(false)
  const [d, setD] = useState({ ...BLANK, date: todayISO() })
  // The result being corrected; null while a new one is being entered.
  const [editId, setEditId] = useState<string | null>(null)
  const [opened, setOpened] = useState<Set<string>>(new Set())
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const form = useRef<HTMLDivElement>(null)

  const reload = () => store.listResults(patientId).then(setList, (e: Error) => { setError(e.message); setList([]) })
  useEffect(() => {
    void reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId])

  const latest = useMemo(() => latestPerTest(list ?? []), [list])
  const groups = useMemo(() => historyPerTest(list ?? []), [list])

  // Suggestions for the test box: the investigation list, and tests this patient already has.
  const testId = useId()
  const names = useMemo(() => [...new Set([...catalog.map((i) => i.name), ...groups.map((g) => g.test)])], [catalog, groups])
  const typedTest = d.test.trim().toLowerCase()
  const suggestions = typedTest && !names.some((n) => n.toLowerCase() === typedTest) ? rankedMatches(names, d.test).slice(0, 6) : []
  function choose(name: string) {
    pickTest(name)
    form.current?.querySelector<HTMLInputElement>('input.num')?.focus()
  }

  function pickTest(name: string) {
    const hit = catalog.find((i) => i.name.toLowerCase() === name.trim().toLowerCase())
    setD((old) => ({ ...old, test: name, unit: hit ? hit.unit : old.unit }))
  }
  function edit(r: Result) {
    setD({ test: r.test, value: r.value, unit: r.unit, date: r.result_date, flag: r.flag })
    setEditId(r.id)
    setAdding(true)
    setConfirmId(null)
    // The form is at the top of the card; the row being corrected may be far below it.
    requestAnimationFrame(() => {
      form.current?.scrollIntoView({ block: 'center' })
      form.current?.querySelector<HTMLInputElement>('input.num')?.focus()
    })
  }
  function closeForm() {
    setAdding(false)
    setEditId(null)
    setD((old) => ({ ...BLANK, date: editId ? todayISO() : old.date }))
  }
  const toggle = (key: string) =>
    setOpened((old) => {
      const next = new Set(old)
      if (!next.delete(key)) next.add(key)
      return next
    })

  const dateBad = !d.date || d.date > todayISO()
  // Not a <form>: this card also sits inside the visit form, and forms cannot nest.
  async function submit() {
    if (busy || !d.test.trim() || !d.value.trim() || dateBad) return
    setBusy(true)
    setError('')
    try {
      await store.saveResult({ patient_id: patientId, test: d.test.trim(), value: d.value.trim(), unit: d.unit.trim(), result_date: d.date, flag: d.flag }, editId ?? undefined)
      await reload()
      if (editId) closeForm()
      // Keep the date: several results from one report are usually entered together.
      else setD((old) => ({ ...BLANK, date: old.date }))
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
          ref={form}
          className="result-form"
          role="group"
          aria-label={editId ? 'Correct a result' : 'Enter a result'}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') {
              e.preventDefault()
              e.stopPropagation()
              void submit()
            }
          }}
        >
          <div className="field wide">
            <label htmlFor={testId}>Test</label>
            <input
              id={testId}
              value={d.test}
              onChange={(e) => pickTest(e.target.value)}
              // Enter takes the first suggestion and moves on to the result.
              onKeyDown={(e) => {
                if (e.key !== 'Enter' || suggestions.length === 0) return
                e.preventDefault()
                e.stopPropagation()
                choose(suggestions[0])
              }}
              autoComplete="off"
              autoFocus={!editId}
            />
            {suggestions.length > 0 && (
              <div className="quick" role="group" aria-label="Matching tests">
                {suggestions.map((n, i) => (
                  <button type="button" key={n} className="opt" onClick={() => choose(n)}>
                    <span className="grow">{n}</span>
                    {i === 0 && <span className="key">Enter</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
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
            <button type="button" className="btn small" onClick={closeForm}>{editId ? 'Cancel' : 'Done'}</button>
            <button type="button" className="btn small primary" disabled={busy || !d.test.trim() || !d.value.trim() || dateBad} onClick={() => void submit()}>{editId ? 'Save changes' : 'Save result'}</button>
          </div>
        </div>
      )}

      {list === null && <RowsSkeleton rows={3} />}
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
        : groups.map((g) => {
            const r = g.results[0]
            const key = r.test.trim().toLowerCase()
            const open = opened.has(key)
            return (
              <div className="rgroup" key={key}>
                <div className="rrow">
                  <div className="rname">{r.test} <Flag flag={r.flag} /></div>
                  <div className={r.flag ? 'mono rval off' : 'mono rval'}>{r.value} {r.unit}</div>
                  <div className="muted rdate">{formatDate(r.result_date)}</div>
                  <Trend results={g.results} />
                  <button type="button" className="btn small" aria-expanded={open} aria-label={`${r.test}: ${open ? 'hide' : 'show'} ${g.results.length === 1 ? 'the result' : `all ${g.results.length} results`}`} onClick={() => toggle(key)}>
                    {g.results.length === 1 ? '1 result' : `${g.results.length} results`}
                  </button>
                </div>
                {open && (
                  <div className="rhist">
                    {g.results.map((x) => (
                      <div className="rrow" key={x.id}>
                        <div className="muted rdate">{formatDate(x.result_date)}</div>
                        <div className={x.flag ? 'mono rval off' : 'mono rval'}>{x.value} {x.unit} <Flag flag={x.flag} /></div>
                        {confirmId === x.id ? (
                          <div className="row" style={{ gap: 6 }}>
                            <span>Delete this result?</span>
                            <button type="button" className="btn small" onClick={() => setConfirmId(null)}>Keep</button>
                            <button type="button" className="btn danger small" onClick={() => { setConfirmId(null); store.deleteResult(x.id).then(reload, (e: Error) => setError(e.message)) }}>Delete</button>
                          </div>
                        ) : (
                          <div className="row" style={{ gap: 6 }}>
                            <button type="button" className="btn small" aria-label={`Correct ${x.test} result of ${formatDate(x.result_date)}`} onClick={() => edit(x)}>Edit</button>
                            <button type="button" className="btn small" aria-label={`Delete ${x.test} result of ${formatDate(x.result_date)}`} onClick={() => setConfirmId(x.id)}>Delete</button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
    </section>
  )
}
