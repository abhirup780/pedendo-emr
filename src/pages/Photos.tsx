import { useEffect, useMemo, useRef, useState } from 'react'
import { useTitle } from '../components/hooks'
import type { ChangeEvent } from 'react'
import { PageSkeleton } from '../components/Skeleton'
import { Link, useParams } from 'react-router-dom'
import { formatAge, formatDate, todayISO } from '../lib/age'
import { compressImage } from '../lib/image'
import { photoFiles } from '../lib/photofiles'
import { sexLabel } from '../lib/sex'
import { store } from '../lib/store'
import { PHOTO_VIEWS } from '../lib/types'
import type { Patient, Photo, PhotoConsent, Visit } from '../lib/types'
import DateField from '../components/DateField'

/** Loads one image from the file store and shows it; images are fetched only when on screen. */
function Picture({ photo, size }: { photo: Photo; size?: 'large' | 'full' }) {
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState('')
  useEffect(() => {
    let live = true
    let made: string | null = null
    photoFiles.read(photo.file_id).then(
      (blob) => {
        if (!live) return
        made = URL.createObjectURL(blob)
        setUrl(made)
      },
      (e: Error) => live && setFailed(e.message),
    )
    return () => {
      live = false
      if (made) URL.revokeObjectURL(made)
    }
  }, [photo.file_id])
  if (failed) return <div className="ph-box ph-msg">{failed}</div>
  if (!url) return <div className="ph-box ph-msg">Loading…</div>
  return <img className={size ? `ph-img ${size}` : 'ph-img'} src={url} alt={`${photo.view}, ${formatDate(photo.taken_on)}`} />
}

/**
 * One photograph filling the screen, uncropped. The side buttons and the left and right arrow
 * keys move through the photographs on show; Escape or the cross closes.
 */
function Viewer({ photos, at, caption, onMove, onClose }: { photos: Photo[]; at: number; caption: (p: Photo) => string; onMove: (at: number) => void; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (d && !d.open) d.showModal()
  }, [])
  const photo = photos[at]
  const last = photos.length - 1
  return (
    <dialog
      ref={ref}
      className="ph-view"
      aria-label="Photograph, full screen"
      onClose={onClose}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft' && at > 0) onMove(at - 1)
        if (e.key === 'ArrowRight' && at < last) onMove(at + 1)
      }}
    >
      <div className="ph-view-bar">
        <div className="grow">
          <div style={{ fontWeight: 600 }}>{photo.view} · {formatDate(photo.taken_on)}</div>
          <div className="mono" style={{ fontSize: 12.5, opacity: 0.8 }}>{caption(photo)}</div>
        </div>
        {photos.length > 1 && <span className="mono sm">{at + 1} / {photos.length}</span>}
        <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
      </div>
      <div className="ph-view-stage">
        {photos.length > 1 && (
          <button type="button" className="icon-btn" aria-label="Previous photograph" disabled={at === 0} onClick={() => onMove(at - 1)}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
          </button>
        )}
        <div className="ph-view-pic">
          <Picture key={photo.id} photo={photo} size="full" />
        </div>
        {photos.length > 1 && (
          <button type="button" className="icon-btn" aria-label="Next photograph" disabled={at === last} onClick={() => onMove(at + 1)}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
          </button>
        )}
      </div>
    </dialog>
  )
}

export default function Photos() {
  const { id = '' } = useParams()
  useTitle('Photographs')
  const [patient, setPatient] = useState<Patient | null | undefined>(undefined)
  const [visits, setVisits] = useState<Visit[]>([])
  const [photos, setPhotos] = useState<Photo[]>([])
  const [consent, setConsent] = useState<PhotoConsent>({ on: null, by: '' })
  const [by, setBy] = useState('')
  const [view, setView] = useState<string>(PHOTO_VIEWS[2])
  const [takenOn, setTakenOn] = useState(todayISO())
  const [filter, setFilter] = useState('All')
  const [compare, setCompare] = useState<string[]>([])
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const camera = useRef<HTMLInputElement>(null)
  const picker = useRef<HTMLInputElement>(null)

  useEffect(() => {
    Promise.all([store.getPatient(id), store.listPhotos(id), store.getPhotoConsent(id), store.listVisits(id)]).then(
      ([p, ph, c, vs]) => {
        setPatient(p)
        setPhotos(ph)
        setConsent(c)
        setVisits(vs)
        setBy(c.by || p?.guardian_name || '')
      },
      (e: Error) => {
        setError(e.message)
        setPatient(null)
      },
    )
  }, [id])

  const shown = useMemo(() => photos.filter((p) => filter === 'All' || p.view === filter), [photos, filter])
  const dates = useMemo(() => [...new Set(shown.map((p) => p.taken_on))], [shown])
  const pair = compare.map((cid) => photos.find((p) => p.id === cid)).filter((p): p is Photo => !!p)
  const heightOn = (iso: string) => visits.find((v) => v.visit_date === iso && v.height_cm != null)?.height_cm ?? null

  async function run(label: string, job: () => Promise<void>) {
    setBusy(label)
    setError('')
    try {
      await job()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
    }
    setBusy('')
  }

  function onFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = [...(e.target.files ?? [])]
    e.target.value = ''
    if (!files.length || !patient) return
    void run(`Adding ${files.length} ${files.length === 1 ? 'photo' : 'photos'}…`, async () => {
      const added: Photo[] = []
      for (const [i, file] of files.entries()) {
        setBusy(`Adding photo ${i + 1} of ${files.length}…`)
        const { blob, width, height } = await compressImage(file)
        const fileId = await photoFiles.upload(blob, id)
        try {
          added.push(await store.addPhoto({ patient_id: id, taken_on: takenOn, view, note: '', file_id: fileId, width, height, bytes: blob.size }))
        } catch (err) {
          // The record failed after the file was stored: do not leave a file nobody can find.
          await photoFiles.remove([fileId]).catch(() => {})
          throw err
        }
      }
      setPhotos(await store.listPhotos(id))
    })
  }

  const remove = (p: Photo) => run('Deleting…', async () => {
    // The file first: if that fails the record is still here, so the photograph can still be
    // found and deleted. The other way round would leave a picture nothing points to.
    await photoFiles.remove([p.file_id])
    await store.deletePhoto(p.id)
    setCompare((old) => old.filter((x) => x !== p.id))
    setConfirmId(null)
    setPhotos(await store.listPhotos(id))
  })

  const recordConsent = () => run('Saving…', async () => {
    const c = { on: todayISO(), by: by.trim() }
    await store.setPhotoConsent(id, c)
    setConsent(c)
  })

  if (patient === undefined) return <PageSkeleton />
  if (patient === null)
    return (
      <main className="page">
        <div className="alert">{error || 'This patient could not be found.'}</div>
        <Link to="/">Back to patients</Link>
      </main>
    )

  const canAdd = !!consent.on && !busy
  const toggleCompare = (pid: string) => setCompare((old) => (old.includes(pid) ? old.filter((x) => x !== pid) : [...old.slice(-1), pid]))

  return (
    <main className="page">
      <div>
        <h1 className="sub">Photographs · <Link to={`/patients/${id}`}>{patient.name}</Link></h1>
        <div className="muted">{formatAge(patient.dob)} · {sexLabel(patient.sex)} · <span className="mono">MRN {patient.mrn}</span> · Optional; a visit never needs a photograph.</div>
      </div>
      {error && <div className="alert">{error}</div>}
      {photoFiles.kind === 'demo' && <div className="note">Demo: photographs stay in this browser tab's memory and disappear when the page reloads. Use test images only.</div>}

      <section className="card pad" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h2>Consent</h2>
        {consent.on ? (
          <div className="row">
            <span className="pill ok">Consent for clinical photographs recorded on {formatDate(consent.on)}{consent.by && ` by ${consent.by}`}</span>
          </div>
        ) : (
          <>
            <div className="muted">Record the parent or guardian's consent before adding the first photograph.</div>
            <div className="row">
              <label className="field" style={{ flex: '1 1 240px' }}>
                Consent given by
                <input value={by} onChange={(e) => setBy(e.target.value)} placeholder="Parent or guardian's name" />
              </label>
              <button type="button" className="btn primary" style={{ alignSelf: 'flex-end' }} disabled={!by.trim() || !!busy} onClick={() => void recordConsent()}>
                Record consent given today
              </button>
            </div>
          </>
        )}
      </section>

      {consent.on && (
        <section className="card pad" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h2>Add photographs</h2>
          <div className="row">
            <label className="field" style={{ flex: '1 1 220px' }}>
              View
              <select value={view} onChange={(e) => setView(e.target.value)}>
                {PHOTO_VIEWS.map((v) => <option key={v}>{v}</option>)}
              </select>
            </label>
            <label className="field" style={{ flex: '0 1 190px' }}>
              Date taken
              <DateField value={takenOn} max={todayISO()} onChange={(v) => setTakenOn(v || todayISO())} />
            </label>
            <div className="row" style={{ alignSelf: 'flex-end', gap: 8 }}>
              <button type="button" className="btn primary" disabled={!canAdd} onClick={() => camera.current?.click()}>Take photo</button>
              <button type="button" className="btn outline" disabled={!canAdd} onClick={() => picker.current?.click()}>Choose files</button>
            </div>
          </div>
          <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={onFiles} aria-label="Take a photo" />
          <input ref={picker} type="file" accept="image/*" multiple hidden onChange={onFiles} aria-label="Choose photo files" />
          <div className="muted sm">Each photo is shrunk to about 300 KB before it is stored, privately, beside the patient records. Several files can be chosen at once; they all get the view and date above.</div>
          {busy && <div className="muted" role="status">{busy}</div>}
        </section>
      )}

      {pair.length > 0 && (
        <section className="card pad">
          <div className="row" style={{ marginBottom: 12 }}>
            <h2 className="grow">Compare</h2>
            <button type="button" className="btn small" onClick={() => setCompare([])}>Close</button>
          </div>
          <div className="ph-compare">
            {[...pair].sort((a, b) => a.taken_on.localeCompare(b.taken_on)).map((p) => (
              <figure key={p.id}>
                <Picture photo={p} size="large" />
                <figcaption>
                  <div style={{ fontWeight: 600 }}>{formatDate(p.taken_on)}</div>
                  <div className="muted mono sm">{formatAge(patient.dob, p.taken_on)}{heightOn(p.taken_on) != null && ` · ${heightOn(p.taken_on)} cm`}</div>
                  <div className="muted sm">{p.view}</div>
                </figcaption>
              </figure>
            ))}
            {pair.length === 1 && <div className="ph-box ph-msg">Tick "Compare" on a second photo</div>}
          </div>
        </section>
      )}

      {photos.length > 0 && (
        <div className="row" style={{ gap: 8 }}>
          <span className="muted" style={{ fontSize: 13, fontWeight: 500 }}>View</span>
          {['All', ...PHOTO_VIEWS.filter((v) => photos.some((p) => p.view === v))].map((v) => (
            <button type="button" key={v} className="chip plain" aria-pressed={filter === v} onClick={() => setFilter(v)}>{v}</button>
          ))}
        </div>
      )}

      {photos.length === 0 && <div className="card empty">No photographs for this patient.</div>}
      {dates.map((d) => (
        <section className="card pad" key={d}>
          <div className="row" style={{ marginBottom: 12, gap: '2px 12px' }}>
            <h2>{formatDate(d)}</h2>
            <span className="muted sm">{formatAge(patient.dob, d)}{heightOn(d) != null && ` · ${heightOn(d)} cm at this visit`}</span>
          </div>
          <div className="ph-grid">
            {shown.filter((p) => p.taken_on === d).map((p) => (
              <figure key={p.id}>
                <button type="button" className="ph-open" aria-label={`Open ${p.view} of ${formatDate(p.taken_on)} full screen`} title="Open full screen" onClick={() => setOpenId(p.id)}>
                  <Picture photo={p} />
                </button>
                <figcaption>
                  <div style={{ fontWeight: 500, fontSize: 13.5 }}>{p.view}</div>
                  <div className="muted mono" style={{ fontSize: 12 }}>{p.width}×{p.height} · {Math.round(p.bytes / 1024)} KB</div>
                  {confirmId === p.id ? (
                    <div className="row" style={{ gap: 6, marginTop: 6 }}>
                      <button type="button" className="btn small" onClick={() => setConfirmId(null)}>Keep</button>
                      <button type="button" className="btn danger small" onClick={() => void remove(p)}>Delete for good</button>
                    </div>
                  ) : (
                    <div className="row" style={{ gap: 6, marginTop: 6 }}>
                      <button type="button" className="btn small" aria-pressed={compare.includes(p.id)} onClick={() => toggleCompare(p.id)}>{compare.includes(p.id) ? '✓ Compare' : 'Compare'}</button>
                      <button type="button" className="btn small" aria-label={`Delete ${p.view} of ${formatDate(p.taken_on)}`} onClick={() => setConfirmId(p.id)}>Delete</button>
                    </div>
                  )}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      ))}
      {openId && shown.some((p) => p.id === openId) && (
        <Viewer
          photos={shown}
          at={shown.findIndex((p) => p.id === openId)}
          caption={(p) => `${formatAge(patient.dob, p.taken_on)}${heightOn(p.taken_on) != null ? ` · ${heightOn(p.taken_on)} cm` : ''}`}
          onMove={(i) => setOpenId(shown[i].id)}
          onClose={() => setOpenId(null)}
        />
      )}
      <div className="muted sm">Photographs are never included in Excel exports or the backup file, and are not printed on prescriptions. To keep copies, use "Download all photographs" under Registry.</div>
    </main>
  )
}
