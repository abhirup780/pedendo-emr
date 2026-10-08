import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { formatDate, todayISO } from '../lib/age'
import { backupFileName, buildBackup, lastBackup, noteBackup, parseBackup } from '../lib/backup'
import { daysBetween } from '../lib/clinical'
import { buildSheets, downloadBlob, exportFileName, SHEETS, toWorkbook } from '../lib/export'
import type { ExportData, Sheet, SheetKey } from '../lib/export'
import { store } from '../lib/store'
import { tagColor } from '../lib/tags'
import type { Backup, Condition } from '../lib/types'

const PREVIEW = !!import.meta.env.VITE_PREVIEW
const RANGES = ['All dates', 'This year', 'Last 12 months', 'Custom'] as const
type Range = (typeof RANGES)[number]

function show(cell: Sheet['rows'][number][number]): string {
  if (cell == null) return ''
  if (cell instanceof Date) return formatDate(cell.toISOString().slice(0, 10))
  return String(cell)
}

export default function Registry() {
  const [conditions, setConditions] = useState<Condition[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [total, setTotal] = useState<number | null>(null)
  const [cohort, setCohort] = useState<string | null>(null)
  const [range, setRange] = useState<Range>('All dates')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [picked, setPicked] = useState<SheetKey[]>(['patients', 'visits', 'growth', 'results'])
  const [deid, setDeid] = useState(false)
  const [data, setData] = useState<ExportData | null>(null)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState('')
  const [backedUp, setBackedUp] = useState(lastBackup())
  const [pending, setPending] = useState<Backup | null>(null)
  const restoreInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    Promise.all([store.listConditions(), store.conditionCounts(), store.listPatients({ limit: 1 })]).then(
      ([c, n, p]) => {
        setConditions(c)
        setCounts(n)
        setTotal(p.total)
      },
      (e: Error) => setError(e.message),
    )
  }, [])

  const today = todayISO()
  const limits = useMemo(() => {
    if (range === 'This year') return { from: `${today.slice(0, 4)}-01-01`, to: null }
    if (range === 'Last 12 months') return { from: `${Number(today.slice(0, 4)) - 1}${today.slice(4)}`, to: null }
    if (range === 'Custom') return { from: from || null, to: to || null }
    return { from: null, to: null }
  }, [range, from, to, today])
  const rangeBad = range === 'Custom' && !!from && !!to && from > to

  const sheets = useMemo(
    () => (data ? buildSheets(data, { sheets: picked, conditionId: cohort, from: limits.from, to: limits.to, deidentify: deid }) : null),
    [data, picked, cohort, limits, deid],
  )
  const cohortName = cohort ? (conditions.find((c) => c.id === cohort)?.name ?? null) : null
  const fileName = exportFileName(cohortName, deid)
  const maxCount = Math.max(1, ...Object.values(counts))

  async function load(): Promise<ExportData | null> {
    if (data) return data
    setBusy('Reading records…')
    setError('')
    try {
      const d = { ...(await store.dump()), conditions }
      setData(d)
      setBusy('')
      return d
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read the records.')
      setBusy('')
      return null
    }
  }

  async function download() {
    const d = await load()
    if (!d) return
    setBusy('Building the workbook…')
    setDone('')
    try {
      const built = buildSheets(d, { sheets: picked, conditionId: cohort, from: limits.from, to: limits.to, deidentify: deid })
      const blob = await toWorkbook(built)
      if (!PREVIEW) downloadBlob(blob, fileName)
      setDone(PREVIEW ? `Workbook built (${Math.round(blob.size / 1024)} KB). Downloads are switched off in this preview; they work in the deployed app.` : `Downloaded ${fileName}.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not build the workbook.')
    }
    setBusy('')
  }

  async function backup() {
    setBusy('Preparing the backup…')
    setError('')
    setDone('')
    try {
      const json = JSON.stringify(await buildBackup(store))
      if (!PREVIEW) downloadBlob(new Blob([json], { type: 'application/json' }), backupFileName())
      noteBackup()
      setBackedUp(todayISO())
      setDone(PREVIEW ? `Backup built (${Math.round(json.length / 1024)} KB). Downloads are switched off in this preview.` : `Downloaded ${backupFileName()}. Keep it somewhere safe.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not build the backup.')
    }
    setBusy('')
  }

  function chooseBackup(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError('')
    setDone('')
    file.text().then(
      (text) => {
        try {
          setPending(parseBackup(text))
        } catch (err) {
          setPending(null)
          setError(err instanceof Error ? err.message : 'This file could not be read.')
        }
      },
      () => setError('This file could not be read.'),
    )
  }

  async function restore() {
    if (!pending) return
    setBusy('Restoring… keep this page open.')
    setError('')
    try {
      await store.restore(pending)
      const [c, n, p] = await Promise.all([store.listConditions(), store.conditionCounts(), store.listPatients({ limit: 1 })])
      setConditions(c)
      setCounts(n)
      setTotal(p.total)
      setData(null)
      setDone(`Restored ${pending.patients.length} patients, ${pending.visits.length} visits and ${pending.results.length} results.`)
      setPending(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The restore did not complete. Nothing was kept; it can be tried again.')
    }
    setBusy('')
  }

  const first = sheets?.[0]
  const backupAge = backedUp ? daysBetween(backedUp, today) : null

  return (
    <main className="page">
      <div>
        <h1>Registry and export</h1>
        <div className="muted">Patients grouped by condition tag. Pick a group, choose the sheets, download one Excel workbook.</div>
      </div>
      {error && <div className="alert">{error}</div>}

      <div className="cols">
        <aside className="card pad" style={{ flex: '1.2 1 280px', minWidth: 0 }}>
          <h2 style={{ marginBottom: 8 }}>Condition groups</h2>
          <button type="button" className="cohort" aria-pressed={cohort === null} onClick={() => setCohort(null)}>
            <span className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
              <span className="dot" style={{ background: '#44545b' }} />
              <span className="grow" style={{ flexBasis: 0, fontWeight: 500 }}>All patients</span>
              <span className="mono">{total ?? '…'}</span>
            </span>
          </button>
          {conditions.map((c) => (
            <button type="button" key={c.id} className="cohort" aria-pressed={cohort === c.id} onClick={() => setCohort(c.id)}>
              <span className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
                <span className="dot" style={{ background: tagColor(c.color).fg }} />
                <span className="grow" style={{ flexBasis: 0, fontWeight: 500 }}>{c.name}</span>
                <span className="mono">{counts[c.id] ?? 0}</span>
              </span>
              <span className="bar"><span style={{ width: `${Math.round(((counts[c.id] ?? 0) / maxCount) * 100)}%`, background: tagColor(c.color).fg }} /></span>
            </button>
          ))}
          <div className="muted" style={{ fontSize: 12.5, marginTop: 10 }}>A patient with several tags is counted in each group.</div>
        </aside>

        <div style={{ flex: '3 1 540px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <section className="card pad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h2>Export {cohortName ? `the ${cohortName} group` : 'all patients'}</h2>

            <div className="row" style={{ gap: 8 }}>
              <span className="muted" style={{ fontSize: 13, fontWeight: 500 }}>Visits and results from</span>
              {RANGES.map((r) => (
                <button type="button" key={r} className="chip plain" aria-pressed={range === r} onClick={() => setRange(r)}>{r}</button>
              ))}
            </div>
            {range === 'Custom' && (
              <div className="row">
                <label className="field" style={{ flex: '0 1 180px' }}>From<input type="date" value={from} max={today} onChange={(e) => setFrom(e.target.value)} /></label>
                <label className="field" style={{ flex: '0 1 180px' }}>To<input type="date" value={to} max={today} onChange={(e) => setTo(e.target.value)} /></label>
                {rangeBad && <span className="err" style={{ color: '#8c1d18', fontWeight: 500 }}>"From" must be on or before "To".</span>}
              </div>
            )}

            <div>
              <div className="muted" style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Sheets in the workbook</div>
              <div className="sheet-picks">
                {SHEETS.map((s) => {
                  const on = picked.includes(s.key)
                  const rows = sheets?.find((x) => x.name === (s.key === 'tanner' ? 'Tanner' : s.label))?.rows.length
                  return (
                    <button type="button" key={s.key} className="sheet-pick" aria-pressed={on} onClick={() => setPicked(on ? picked.filter((k) => k !== s.key) : [...picked, s.key])}>
                      <span className="box" aria-hidden="true">{on ? '✓' : ''}</span>
                      <span>
                        <span style={{ display: 'block', fontWeight: 600 }}>{s.label}{on && rows != null && <span className="muted mono" style={{ fontWeight: 400 }}> · {rows} rows</span>}</span>
                        <span className="muted" style={{ display: 'block', fontSize: 12.5 }}>{s.hint}</span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="row" style={{ paddingTop: 14, borderTop: '1px solid var(--line)' }}>
              <button type="button" className="switch" role="switch" aria-checked={deid} onClick={() => setDeid(!deid)} style={{ flex: '1 1 280px', textAlign: 'left' }}>
                <span className="track" />
                <span>
                  <span style={{ display: 'block' }}>De-identify for research</span>
                  <span className="muted" style={{ display: 'block', fontSize: 12.5, fontWeight: 400 }}>Study ID replaces name and MRN; date of birth, guardian, phone and address are left out.</span>
                </span>
              </button>
              <span className="mono muted" style={{ fontSize: 13 }}>{fileName}</span>
            </div>
            <div className="row end">
              {busy && <span className="muted" role="status">{busy}</span>}
              {!data && <button type="button" className="btn" disabled={!!busy} onClick={() => void load()}>Preview rows</button>}
              <button type="button" className="btn primary" disabled={!!busy || picked.length === 0 || rangeBad} onClick={() => void download()}>
                Download Excel · {picked.length} {picked.length === 1 ? 'sheet' : 'sheets'}
              </button>
            </div>
            {done && <div className="pill ok" role="status">{done}</div>}
          </section>

          {first && (
            <section className="card">
              <div className="card-head">
                <h2 className="grow">Preview · {first.name} sheet</h2>
                <span className="muted">{first.rows.length === 0 ? 'No rows' : `First ${Math.min(8, first.rows.length)} of ${first.rows.length} rows`}</span>
              </div>
              <div className="table-wrap" tabIndex={0} role="region" aria-label="Export preview">
                <table className="preview">
                  <thead><tr>{first.columns.map((c) => <th key={c.header}>{c.header}</th>)}</tr></thead>
                  <tbody>
                    {first.rows.slice(0, 8).map((r, i) => (
                      <tr key={i}>{r.map((cell, j) => <td key={j} className={typeof cell === 'number' ? 'mono' : undefined}>{show(cell)}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="foot">Photographs are never included in an export.</div>
            </section>
          )}

          <section className="card pad" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <h2>Backup</h2>
            <div className="muted">One file with every patient, visit, result and setting. The database plan keeps no backups of its own, so download one regularly and store it somewhere safe. Photographs stay in Google Drive and are not part of this file.</div>
            <div className="row">
              <span className={backupAge == null || backupAge > 7 ? 'pill warn' : 'pill ok'}>
                {backedUp ? `Last backup from this browser: ${formatDate(backedUp)}` : 'No backup downloaded from this browser yet'}
              </span>
              <span className="grow" />
              <button type="button" className="btn outline" disabled={!!busy} onClick={() => void backup()}>Download full backup</button>
            </div>

            <div style={{ borderTop: '1px solid var(--line)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <div style={{ fontWeight: 600 }}>Restore from a backup file</div>
                <div className="muted">For starting again on an empty account, for example after the database was lost. It will not run while this account has patients.</div>
              </div>
              <input ref={restoreInput} type="file" accept=".json,application/json" hidden onChange={chooseBackup} aria-label="Choose a backup file" />
              {!pending ? (
                <div className="row end">
                  <button type="button" className="btn" disabled={!!busy} onClick={() => restoreInput.current?.click()}>Choose a backup file</button>
                </div>
              ) : (
                <>
                  <div className="note" style={{ background: '#eceFee', color: 'var(--ink)', fontWeight: 400 }}>
                    Backup of {formatDate(pending.exported_at)}: <strong>{pending.patients.length}</strong> patients, <strong>{pending.visits.length}</strong> visits, <strong>{pending.results.length}</strong> results, {pending.photos.length} photograph records, {pending.conditions.length} tags, {pending.medicines.length} medicines.
                    {(total ?? 0) > 0 && <> This account has {total} patients, so it cannot be restored here.</>}
                  </div>
                  <div className="row end">
                    <button type="button" className="btn" disabled={!!busy} onClick={() => setPending(null)}>Cancel</button>
                    <button type="button" className="btn primary" disabled={!!busy || (total ?? 1) > 0} onClick={() => void restore()}>Restore into this account</button>
                  </div>
                </>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
