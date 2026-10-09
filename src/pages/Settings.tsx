import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import PrintLayouts from './PrintLayouts'
import SignInSettings from './SignInSettings'
import { store } from '../lib/store'
import { EMPTY_RX } from '../lib/clinical'
import { IDLE_CHOICES, idleMinutes, setIdleMinutes } from '../lib/device'
import { smallImageDataUrl } from '../lib/image'
import { categoryOrder, STARTER_INVESTIGATIONS, STARTER_PANELS, starterPanelTags } from '../lib/investigations'
import { STARTER_MEDICINES } from '../lib/medicines'
import { RowsSkeleton } from '../components/Skeleton'
import { Swatches, TagChip } from '../components/Tag'
import { useTitle } from '../components/hooks'
import { STARTER_CONDITIONS, TAG_COLORS, tagColor } from '../lib/tags'
import type { Clinic, Condition, Investigation, Medicine, Panel, RxItem, RxTemplate } from '../lib/types'

const FIND = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#55656C" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.5-3.5" />
  </svg>
)

function ConditionTags() {
  const [list, setList] = useState<Condition[] | null>(null)
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [name, setName] = useState('')
  const [color, setColor] = useState('teal')
  const [confirmId, setConfirmId] = useState<string | null>(null)
  // The tag whose row of colours is open: each row shows its own colour only, until asked.
  const [paletteId, setPaletteId] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function reload() {
    try {
      const [c, n] = await Promise.all([store.listConditions(), store.conditionCounts()])
      setList(c)
      setCounts(n)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load tags.')
      setList([])
    }
  }
  useEffect(() => {
    void reload()
  }, [])

  async function run(job: () => Promise<unknown>) {
    setError('')
    try {
      await job()
      await reload()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Something went wrong.'
      setError(/duplicate key/i.test(msg) ? 'A tag with that name already exists.' : msg)
    }
  }

  function add(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    void run(async () => {
      await store.saveCondition({ name, color })
      setName('')
    })
  }

  return (
    <>
      {error && <div className="alert">{error}</div>}

      <section className="card">
        <div className="card-head">
          <h2 className="grow">Condition tags</h2>
          {list && list.length === 0 && (
            <button
              type="button"
              className="btn outline small"
              onClick={() => run(async () => { for (const c of STARTER_CONDITIONS) await store.saveCondition(c) })}
            >
              Add the starter set ({STARTER_CONDITIONS.length})
            </button>
          )}
        </div>

        {list === null && <RowsSkeleton rows={4} />}
        {list && list.length === 0 && <div className="empty">No tags yet. Add your own below, or start from the starter set.</div>}
        {list?.map((c) => (
          <div className="tag-row" key={c.id}>
            <span className="tag" style={{ background: tagColor(c.color).bg, color: tagColor(c.color).fg, minWidth: 28, textAlign: 'center' }}>
              {counts[c.id] ?? 0}
            </span>
            <input
              type="text"
              aria-label={`Name of tag ${c.name}`}
              defaultValue={c.name}
              onBlur={(e) => {
                const v = e.target.value.trim()
                if (v && v !== c.name) void run(() => store.saveCondition({ id: c.id, name: v, color: c.color }))
                else e.target.value = c.name
              }}
            />
            <button type="button" className="swatch-btn" aria-expanded={paletteId === c.id} aria-label={`Colour of ${c.name}: ${TAG_COLORS[c.color]?.label ?? c.color}. Change`} onClick={() => setPaletteId(paletteId === c.id ? null : c.id)}>
              <span className="dot" style={{ background: tagColor(c.color).fg }} />
              Colour
            </button>
            {confirmId === c.id ? (
              <>
                <span>Remove from {counts[c.id] ?? 0} patients?</span>
                <button type="button" className="btn small" onClick={() => setConfirmId(null)}>
                  Keep
                </button>
                <button type="button" className="btn danger small" onClick={() => { setConfirmId(null); void run(() => store.deleteCondition(c.id)) }}>
                  Delete tag
                </button>
              </>
            ) : (
              <button type="button" className="btn small quiet danger" aria-label={`Delete tag ${c.name}`} onClick={() => setConfirmId(c.id)}>
                Delete
              </button>
            )}
            {paletteId === c.id && (
              <div className="palette reveal">
                <Swatches value={c.color} label={`Colour of ${c.name}`} onChange={(col) => { setPaletteId(null); void run(() => store.saveCondition({ id: c.id, name: c.name, color: col })) }} />
              </div>
            )}
          </div>
        ))}

        <form className="tag-row" onSubmit={add} style={{ borderBottom: 0 }}>
          <input type="text" aria-label="New tag name" placeholder="New tag, e.g. Diabetes insipidus" value={name} onChange={(e) => setName(e.target.value)} />
          <Swatches value={color} onChange={setColor} label="Colour of the new tag" />
          <button type="submit" className="btn primary small" disabled={!name.trim()}>
            Add tag
          </button>
        </form>
      </section>
    </>
  )
}

const CLINIC_FIELDS: { key: Exclude<keyof Clinic, 'logo' | 'signature'>; label: string; hint?: string; wide?: boolean }[] = [
  { key: 'doctor_name', label: 'Doctor\u2019s name', hint: 'As it should print, e.g. Dr. R. K. Mehta' },
  { key: 'qualifications', label: 'Qualifications' },
  { key: 'reg_no', label: 'Registration number' },
  { key: 'clinic_name', label: 'Clinic name' },
  { key: 'address', label: 'Address', wide: true },
  { key: 'phone', label: 'Phone' },
  { key: 'email', label: 'Email' },
]

const IMAGES: { key: 'logo' | 'signature'; label: string; hint: string; w: number; h: number }[] = [
  { key: 'logo', label: 'Clinic logo', hint: 'Optional. Printed beside the doctor\u2019s name.', w: 360, h: 240 },
  { key: 'signature', label: 'Signature', hint: 'Optional. Printed above the signature line on every prescription; leave empty to sign by hand.', w: 480, h: 200 },
]

function ClinicDetails() {
  const inputs = useRef<Record<string, HTMLInputElement | null>>({})
  const [c, setC] = useState<Clinic | null>(null)
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [error, setError] = useState('')
  useEffect(() => {
    store.getClinic().then(setC, (e: Error) => setError(e.message))
  }, [])
  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!c) return
    setState('saving')
    setError('')
    try {
      setC(await store.saveClinic(c))
      setState('saved')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.')
      setState('idle')
    }
  }
  return (
    <>
      {error && <div className="alert">{error}</div>}
      <form className="card pad" onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <h2>Prescription letterhead</h2>
          <div className="muted">Printed at the top of every prescription.</div>
        </div>
        {c === null ? (
          <div className="muted">Loading…</div>
        ) : (
          <div className="form-grid">
            {CLINIC_FIELDS.map((fd) => (
              <label key={fd.key} className={fd.wide ? 'field wide' : 'field'}>
                {fd.label}
                <input value={c[fd.key] as string} onChange={(e) => { setC({ ...c, [fd.key]: e.target.value }); setState('idle') }} autoComplete="off" />
                {fd.hint && <span className="hint">{fd.hint}</span>}
              </label>
            ))}
          </div>
        )}
        {c !== null && (
          <div className="form-grid">
            {IMAGES.map((im) => (
              <div className="field" key={im.key}>
                <span>{im.label}</span>
                <div className="img-slot">
                  {c[im.key] ? <img src={c[im.key]} alt={`Current ${im.label.toLowerCase()}`} /> : <span className="muted">None</span>}
                </div>
                <div className="row" style={{ gap: 8 }}>
                  <button type="button" className="btn small" onClick={() => inputs.current[im.key]?.click()}>{c[im.key] ? 'Change' : 'Choose image'}</button>
                  {c[im.key] && <button type="button" className="btn small" onClick={() => { setC({ ...c, [im.key]: '' }); setState('idle') }}>Remove</button>}
                </div>
                <input
                  ref={(el) => { inputs.current[im.key] = el }}
                  type="file" accept="image/*" hidden aria-label={`Choose ${im.label.toLowerCase()} image`}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    e.target.value = ''
                    if (!file) return
                    smallImageDataUrl(file, im.w, im.h).then(
                      (url) => { setC({ ...c, [im.key]: url }); setState('idle'); setError('') },
                      (err: Error) => setError(err.message),
                    )
                  }}
                />
                <span className="hint">{im.hint}</span>
              </div>
            ))}
          </div>
        )}
        <div className="row end">
          {state === 'saved' && <span className="pill ok" role="status">Saved</span>}
          <button type="submit" className="btn primary" disabled={!c || state === 'saving'}>
            {state === 'saving' ? 'Saving…' : 'Save letterhead'}
          </button>
        </div>
      </form>
    </>
  )
}

const MED_FIELDS: { key: keyof RxItem; label: string; wide?: boolean }[] = [
  { key: 'name', label: 'Name, strength and form', wide: true },
  { key: 'dose', label: 'Usual dose' },
  { key: 'frequency', label: 'Frequency' },
  { key: 'route', label: 'Route' },
  { key: 'duration', label: 'Duration' },
  { key: 'instructions', label: 'Instructions', wide: true },
]

function Medicines() {
  const [list, setList] = useState<Medicine[] | null>(null)
  const [draft, setDraft] = useState<RxItem & { id?: string }>({ ...EMPTY_RX })
  // The form to add or change a medicine opens at the top of the list, where it is in view.
  const [adding, setAdding] = useState(false)
  const [q, setQ] = useState('')
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const form = useRef<HTMLFormElement>(null)

  async function reload() {
    try {
      setList(await store.listMedicines())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load medicines.')
      setList([])
    }
  }
  useEffect(() => {
    void reload()
  }, [])
  async function run(job: () => Promise<unknown>) {
    setError('')
    try {
      await job()
      await reload()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Something went wrong.'
      setError(/duplicate key/i.test(msg) ? 'That medicine is already in your list.' : msg)
    }
  }
  function open(m?: Medicine) {
    setDraft(m ? { ...m } : { ...EMPTY_RX })
    setAdding(true)
    setConfirmId(null)
    // The medicine being changed may be far down the list.
    requestAnimationFrame(() => {
      form.current?.scrollIntoView({ block: 'nearest' })
      form.current?.querySelector('input')?.focus()
    })
  }
  function close() {
    setAdding(false)
    setDraft({ ...EMPTY_RX })
  }
  function submit(e: FormEvent) {
    e.preventDefault()
    if (!draft.name.trim()) return
    const changing = !!draft.id
    void run(async () => {
      await store.saveMedicine(draft)
      // A change is finished with; after adding one, the form stays for the next.
      if (changing) close()
      else setDraft({ ...EMPTY_RX })
    })
  }
  const words = q.trim().toLowerCase()
  const shown = (list ?? []).filter((m) => !words || m.name.toLowerCase().includes(words))

  return (
    <>
      {error && <div className="alert">{error}</div>}
      <section className="card">
        <div className="card-head">
          <div className="grow">
            <h2>Your medicines</h2>
            <div className="muted">One tap adds these to a prescription with the directions below already filled in.</div>
          </div>
          {list && list.length === 0 && (
            <button type="button" className="btn outline small" onClick={() => run(async () => { for (const m of STARTER_MEDICINES) await store.saveMedicine(m) })}>
              Add the starter list ({STARTER_MEDICINES.length})
            </button>
          )}
          {list && list.length > 8 && (
            <label className="search">
              {FIND}
              <input type="search" aria-label="Find a medicine in your list" placeholder="Find a medicine" value={q} onChange={(e) => setQ(e.target.value)} />
            </label>
          )}
          {!adding && <button type="button" className="btn small primary" onClick={() => open()}>+ Add a medicine</button>}
        </div>
        {adding && (
          <form ref={form} className="inline-form reveal" onSubmit={submit}>
            <h3 className="t-title wide">{draft.id ? 'Change this medicine' : 'Add a medicine'}</h3>
            {MED_FIELDS.map((fd) => (
              <label key={fd.key} className={fd.wide ? 'field wide' : 'field'}>
                {fd.label}
                <input value={draft[fd.key]} onChange={(e) => setDraft({ ...draft, [fd.key]: e.target.value })} autoComplete="off" />
              </label>
            ))}
            <div className="row end wide">
              <button type="button" className="btn small" onClick={close}>{draft.id ? 'Cancel' : 'Done'}</button>
              <button type="submit" className="btn small primary" disabled={!draft.name.trim()}>{draft.id ? 'Save changes' : 'Add to my list'}</button>
            </div>
          </form>
        )}
        {list === null && <RowsSkeleton rows={4} />}
        {list && list.length === 0 && <div className="empty">No medicines yet. Add your own with "Add a medicine", or begin with the starter list and edit it.</div>}
        {list && list.length > 0 && shown.length === 0 && <div className="empty">No medicine in your list matches "{q.trim()}".</div>}
        {shown.map((m) => (
          <div className="tag-row" key={m.id}>
            <div className="grow">
              <div style={{ fontWeight: 600 }}>{m.name}</div>
              <div className="muted sm">
                {[m.dose, m.route, m.frequency, m.duration, m.instructions].filter((x) => x.trim()).join(' · ') || 'No default directions'}
              </div>
            </div>
            {confirmId === m.id ? (
              <>
                <span>Remove from your list?</span>
                <button type="button" className="btn small" onClick={() => setConfirmId(null)}>Keep</button>
                <button type="button" className="btn danger small" onClick={() => { setConfirmId(null); void run(() => store.deleteMedicine(m.id)) }}>Remove</button>
              </>
            ) : (
              <>
                <button type="button" className="btn small quiet" aria-label={`Edit ${m.name}`} onClick={() => open(m)}>Edit</button>
                <button type="button" className="btn small quiet danger" aria-label={`Remove ${m.name}`} onClick={() => setConfirmId(m.id)}>Remove</button>
              </>
            )}
          </div>
        ))}
        {list && words && shown.length > 0 && <div className="foot">Showing {shown.length} of {list.length}.</div>}
      </section>
    </>
  )
}

function Templates() {
  const [list, setList] = useState<RxTemplate[] | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const reload = () => store.listTemplates().then(setList, (e: Error) => { setError(e.message); setList([]) })
  useEffect(() => {
    void reload()
  }, [])
  return (
    <>
      {error && <div className="alert">{error}</div>}
      <section className="card">
        <div className="card-head">
          <div className="grow">
            <h2>Prescription templates</h2>
            <div className="muted">Create a template from any visit with "Save these medicines as a template".</div>
          </div>
        </div>
        {list === null && <RowsSkeleton rows={4} />}
        {list && list.length === 0 && <div className="empty">No templates yet.</div>}
        {list?.map((t) => (
          <div className="tag-row" key={t.id}>
            <div className="grow">
              <div style={{ fontWeight: 600 }}>{t.name}</div>
              <div className="muted sm">{t.medicines.map((m) => m.name).join(' · ') || 'No medicines'}</div>
            </div>
            {confirmId === t.id ? (
              <>
                <span>Delete this template?</span>
                <button type="button" className="btn small" onClick={() => setConfirmId(null)}>Keep</button>
                <button type="button" className="btn danger small" onClick={() => { setConfirmId(null); store.deleteTemplate(t.id).then(reload, (e: Error) => setError(e.message)) }}>Delete</button>
              </>
            ) : (
              <button type="button" className="btn small quiet danger" aria-label={`Delete template ${t.name}`} onClick={() => setConfirmId(t.id)}>Delete</button>
            )}
          </div>
        ))}
      </section>
    </>
  )
}

function Investigations() {
  const [list, setList] = useState<Investigation[] | null>(null)
  const [panels, setPanels] = useState<Panel[]>([])
  const [tags, setTags] = useState<Condition[]>([])
  const [draft, setDraft] = useState({ name: '', category: '', unit: '' })
  const [q, setQ] = useState('')
  const [confirm, setConfirm] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function reload() {
    try {
      const [i, p, c] = await Promise.all([store.listInvestigations(), store.listPanels(), store.listConditions()])
      setTags(c)
      setList(i)
      setPanels(p)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load investigations.')
      setList([])
    }
  }
  useEffect(() => {
    void reload()
  }, [])
  async function run(job: () => Promise<unknown>) {
    setError('')
    try {
      await job()
      await reload()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Something went wrong.'
      setError(/duplicate key/i.test(msg) ? 'That name is already in your list.' : msg)
    }
  }
  function submit(e: FormEvent) {
    e.preventDefault()
    if (!draft.name.trim()) return
    void run(async () => {
      await store.saveInvestigation(draft)
      setDraft({ name: '', category: draft.category, unit: '' })
    })
  }
  const cats = categoryOrder((list ?? []).map((i) => i.category))
  const words = q.trim().toLowerCase()
  const match = (i: Investigation) => !words || i.name.toLowerCase().includes(words)

  return (
    <>
      {error && <div className="alert">{error}</div>}
      <section className="card">
        <div className="card-head">
          <div className="grow">
            <h2>Your investigations</h2>
            <div className="muted">Shown grouped on the visit screen. The unit is pre-filled when you enter a result.</div>
          </div>
          {list && list.length === 0 && (
            <button
              type="button"
              className="btn outline small"
              onClick={() => run(async () => {
                for (const g of STARTER_INVESTIGATIONS) for (const [name, unit] of g.items) await store.saveInvestigation({ name, unit, category: g.category })
                // Starter panels are tied to the clinic's tags of the same name, where they exist.
                if (panels.length === 0) for (const p of STARTER_PANELS) await store.savePanel({ name: p.name, items: p.items, condition_ids: starterPanelTags(p, tags) })
              })}
            >
              Add the starter list and panels
            </button>
          )}
          {list && list.length > 8 && (
            <label className="search">
              {FIND}
              <input type="search" aria-label="Find an investigation in your list" placeholder="Find an investigation" value={q} onChange={(e) => setQ(e.target.value)} />
            </label>
          )}
        </div>
        {/* Adding one is at the top, so it is reached without scrolling past the whole list. */}
        <form className="tag-row" onSubmit={submit}>
          <input type="text" aria-label="New investigation name" placeholder="New investigation" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          <input type="text" aria-label="Category" placeholder="Category" list="inv-cats" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} style={{ flex: '1 1 150px' }} />
          <datalist id="inv-cats">{cats.map((c) => <option key={c} value={c} />)}</datalist>
          <input type="text" aria-label="Unit" placeholder="Unit" value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value })} style={{ flex: '0 1 100px' }} />
          <button type="submit" className="btn primary small" disabled={!draft.name.trim()}>Add</button>
        </form>
        {list === null && <RowsSkeleton rows={4} />}
        {list && list.length === 0 && <div className="empty">No investigations yet. Add your own above, or begin with the starter list and edit it.</div>}
        {list && list.length > 0 && !list.some(match) && <div className="empty">No investigation in your list matches "{q.trim()}".</div>}
        {cats.map((c) => {
          const items = list!.filter((i) => i.category === c && match(i))
          if (items.length === 0) return null
          return (
            <div key={c}>
              <div className="group-head">{c}</div>
              {items.map((i) => (
              <div className="tag-row" key={i.id} style={{ padding: '6px 16px' }}>
                <div className="grow">{i.name}</div>
                <span className="muted mono">{i.unit}</span>
                {confirm === i.id ? (
                  <>
                    <button type="button" className="btn small" onClick={() => setConfirm(null)}>Keep</button>
                    <button type="button" className="btn danger small" onClick={() => { setConfirm(null); void run(() => store.deleteInvestigation(i.id)) }}>Remove</button>
                  </>
                ) : (
                  <button type="button" className="btn small quiet danger" aria-label={`Remove ${i.name}`} onClick={() => setConfirm(i.id)}>Remove</button>
                )}
              </div>
              ))}
            </div>
          )
        })}
      </section>

      <section className="card">
        <div className="card-head">
          <div className="grow">
            <h2>Panels</h2>
            <div className="muted">Create a panel from any visit with "Save this selection as a panel". Tick the condition tags a panel belongs to: it is then offered on visits of patients with that tag. With no tag ticked it is offered for every patient.</div>
          </div>
        </div>
        {panels.length === 0 && <div className="empty">No panels yet.</div>}
        {panels.map((p) => (
          <div className="tag-row" key={p.id}>
            <div className="grow">
              <div style={{ fontWeight: 600 }}>{p.name}</div>
              <div className="muted sm">{p.items.join(' · ')}</div>
              {tags.length > 0 && (
                <div className="tags" role="group" aria-label={`Condition tags for panel ${p.name}`} style={{ marginTop: 8 }}>
                  <span className="muted" style={{ fontSize: 13, alignSelf: 'center' }}>{p.condition_ids.some((id) => tags.some((t) => t.id === id)) ? 'Offered for:' : 'Offered for every patient. Limit to:'}</span>
                  {tags.map((t) => {
                    const on = p.condition_ids.includes(t.id)
                    return (
                      <TagChip
                        key={t.id}
                        label={t.name}
                        color={t.color}
                        pressed={on}
                        // Ids of tags deleted since are dropped as the list is saved.
                        onClick={() => void run(() => store.savePanel({ id: p.id, name: p.name, items: p.items, condition_ids: (on ? p.condition_ids.filter((x) => x !== t.id) : [...p.condition_ids, t.id]).filter((x) => tags.some((y) => y.id === x)) }))}
                      />
                    )
                  })}
                </div>
              )}
            </div>
            {confirm === p.id ? (
              <>
                <button type="button" className="btn small" onClick={() => setConfirm(null)}>Keep</button>
                <button type="button" className="btn danger small" onClick={() => { setConfirm(null); void run(() => store.deletePanel(p.id)) }}>Delete</button>
              </>
            ) : (
              <button type="button" className="btn small quiet danger" aria-label={`Delete panel ${p.name}`} onClick={() => setConfirm(p.id)}>Delete</button>
            )}
          </div>
        ))}
      </section>
    </>
  )
}

function ThisDevice() {
  const [idle, setIdle] = useState(idleMinutes())
  return (
    <section className="card pad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <h2>This device</h2>
        <div className="muted">These choices are remembered on this computer or phone only.</div>
      </div>
      <div className="field">
        <span id="idle-label">Sign out automatically when the app has not been touched for</span>
        <div className="seg" role="group" aria-labelledby="idle-label">
          {IDLE_CHOICES.map((n) => (
            <button type="button" key={n} aria-pressed={idle === n} onClick={() => { setIdleMinutes(n); setIdle(n) }}>
              {n === 0 ? 'Never' : `${n} min`}
            </button>
          ))}
        </div>
        <span className="hint">{idle === 0 ? 'Not recommended on a shared or clinic computer.' : 'Unsaved visit notes are kept in the tab and come back after signing in again.'}</span>
      </div>
    </section>
  )
}

const TABS = [
  { key: 'clinic', label: 'Letterhead', el: <ClinicDetails /> },
  { key: 'print', label: 'Print layouts', el: <PrintLayouts /> },
  { key: 'tags', label: 'Condition tags', el: <ConditionTags /> },
  { key: 'meds', label: 'Medicines', el: <Medicines /> },
  { key: 'tests', label: 'Investigations', el: <Investigations /> },
  { key: 'templates', label: 'Templates', el: <Templates /> },
  { key: 'signin', label: 'Sign-in', el: <SignInSettings /> },
  { key: 'device', label: 'This device', el: <ThisDevice /> },
]

export default function Settings() {
  useTitle('Settings')
  const [params, setParams] = useSearchParams()
  const wanted = params.get('tab') ?? ''
  const tab = TABS.some((t) => t.key === wanted) ? wanted : 'clinic'
  const setTab = (key: string) => setParams({ tab: key }, { replace: true })
  return (
    <main className="page">
      <h1>Settings</h1>
      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>
      {TABS.find((t) => t.key === tab)?.el}
      {/* Required by the drawings' licence; shown here only, on every Settings tab. */}
      <p className="muted" style={{ fontSize: 12.5, margin: '4px 2px 0' }}>
        Credits. Tanner stage drawings: Michał Komorniczak, Wikimedia Commons, CC BY-SA 3.0 (cropped).
      </p>
    </main>
  )
}
