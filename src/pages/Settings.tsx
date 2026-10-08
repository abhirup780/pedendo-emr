import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import PrintLayouts from './PrintLayouts'
import { store } from '../lib/store'
import { EMPTY_RX } from '../lib/clinical'
import { IDLE_CHOICES, idleMinutes, setIdleMinutes } from '../lib/device'
import { smallImageDataUrl } from '../lib/image'
import { categoryOrder, STARTER_INVESTIGATIONS, STARTER_PANELS } from '../lib/investigations'
import { STARTER_MEDICINES } from '../lib/medicines'
import { Swatches } from '../components/Tag'
import { cite, PROTOCOLS, protocolsByName } from '../lib/protocols'
import { STARTER_CONDITIONS, tagColor } from '../lib/tags'
import type { Clinic, Condition, Investigation, Medicine, Panel, RxItem, RxTemplate } from '../lib/types'

/** The built-in guideline suggestions, laid out for the doctor to read and check. Read-only. */
function ProtocolLibrary() {
  return (
    <>
      <div className="note" style={{ fontWeight: 400 }}>
        <strong>Draft content, for your review.</strong> These suggestions were compiled from the guidelines listed under each condition.
        The wording was read through an automated reader, and some documents could only be read in part, so check each item against
        the source before relying on it. The app never fills in a dose: the guideline range is shown beside the dose box as a guide only.
      </div>
      {PROTOCOLS.map((p) => (
        <details className="card proto" key={p.key}>
          <summary>
            <span className="grow"><strong>{p.name}</strong> <span className="muted">· {p.sets.reduce((n, s) => n + s.items.length, 0)} investigations in {p.sets.length} sets · {p.medicines.length} {p.medicines.length === 1 ? 'medicine' : 'medicines'}</span></span>
            <span className="muted" style={{ fontSize: 13 }}>compiled {p.compiledOn}</span>
          </summary>
          <div className="proto-body">
            <div>
              <h2 className="proto-h">Tag names that bring this up</h2>
              <div className="muted">{[p.name, ...p.aliases].join(' · ')}. Any other tag can be linked under Condition tags.</div>
            </div>
            <div>
              <h2 className="proto-h">Sources</h2>
              <ul>
                {p.sources.map((s) => (
                  <li key={s.id}><strong>{s.org} {s.year}.</strong> <a href={s.url} target="_blank" rel="noreferrer">{s.title}</a></li>
                ))}
              </ul>
            </div>
            <div>
              <h2 className="proto-h">Investigations</h2>
              {p.sets.map((s) => (
                <div className="proto-set" key={s.name}>
                  <div><strong>{s.name}.</strong> <span className="muted">{s.when}</span></div>
                  <ul>
                    {s.items.map((i) => (
                      <li key={i.test}>{i.test}{i.note && <span className="muted">: {i.note}</span>} <span className="src">({cite(p, i.sources)})</span></li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div>
              <h2 className="proto-h">Medicines</h2>
              {p.medicines.map((m) => (
                <div className="proto-set" key={m.generic}>
                  <div><strong>{m.rx.name}</strong>{m.strengths.length > 0 && <span className="muted"> · {m.strengths.join(', ')}</span>} {!m.verified && <span className="draft">dose not verified</span>}</div>
                  <ul>
                    <li><span className="muted">Used for:</span> {m.indication}</li>
                    <li><span className="muted">Dose guide:</span> {m.verified && m.doseGuide ? <>{m.doseGuide}{m.max && ` ${m.max}`}</> : 'none held; the dose could not be read from a guideline'} <span className="src">({cite(p, m.sources)})</span></li>
                    {m.quote && <li><span className="muted">Source wording:</span> "{m.quote}"</li>}
                    <li><span className="muted">Put on the prescription:</span> {[m.rx.route, m.rx.frequency, m.rx.duration].filter(Boolean).join(', ') || 'name only'}{m.rx.instructions && `. ${m.rx.instructions}`}</li>
                    {m.monitoring && <li><span className="muted">Monitoring:</span> {m.monitoring}</li>}
                    {m.prescriberNote && <li><span className="muted">Note:</span> {m.prescriberNote}</li>}
                    {m.note && <li><span className="muted">Compiler's note:</span> {m.note}</li>}
                  </ul>
                </div>
              ))}
            </div>
            {p.advice.length > 0 && (
              <div>
                <h2 className="proto-h">Advice lines</h2>
                <ul>{p.advice.map((a) => <li key={a.text}>{a.text} <span className="src">({cite(p, a.sources)})</span></li>)}</ul>
              </div>
            )}
            {p.caveats && (
              <div>
                <h2 className="proto-h">Read this before relying on it</h2>
                <div>{p.caveats}</div>
              </div>
            )}
          </div>
        </details>
      ))}
    </>
  )
}

function ConditionTags() {
  const [list, setList] = useState<Condition[] | null>(null)
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [name, setName] = useState('')
  const [color, setColor] = useState('teal')
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [linking, setLinking] = useState<string | null>(null)
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

        {list === null && <div className="empty">Loading…</div>}
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
            <Swatches value={c.color} label={`Colour of ${c.name}`} onChange={(col) => void run(() => store.saveCondition({ id: c.id, name: c.name, color: col }))} />
            {PROTOCOLS.length > 0 && (() => {
              const chosen = c.protocols.filter((k) => PROTOCOLS.some((p) => p.key === k))
              const byName = protocolsByName(c.name)
              const n = chosen.length || byName.length
              return (
                <button type="button" className="btn small" aria-expanded={linking === c.id} onClick={() => setLinking(linking === c.id ? null : c.id)}>
                  {n === 0 ? 'Link a protocol' : `${n} ${n === 1 ? 'protocol' : 'protocols'}`}
                </button>
              )
            })()}
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
              <button type="button" className="btn small" onClick={() => setConfirmId(c.id)}>
                Delete
              </button>
            )}
            {linking === c.id && (() => {
              const chosen = c.protocols.filter((k) => PROTOCOLS.some((p) => p.key === k))
              const byName = protocolsByName(c.name).map((p) => p.key)
              // With nothing chosen the tag's name decides; the first click starts from that.
              const current = chosen.length > 0 ? chosen : byName
              const toggle = (key: string) => void run(() => store.saveCondition({ id: c.id, name: c.name, color: c.color, protocols: current.includes(key) ? current.filter((k) => k !== key) : [...current, key] }))
              return (
                <div className="tag-link" role="group" aria-label={`Protocols for ${c.name}`}>
                  <div className="muted" style={{ fontSize: 13 }}>
                    Patients with this tag are offered these guideline suggestions on a visit.
                    {chosen.length === 0 && (byName.length > 0 ? ' Matched by the tag name for now.' : ' None matches the tag name.')}
                  </div>
                  <div className="tags">
                    {PROTOCOLS.map((p) => (
                      <button type="button" key={p.key} className="chip plain" aria-pressed={current.includes(p.key)} onClick={() => toggle(p.key)}>{p.name}</button>
                    ))}
                  </div>
                </div>
              )
            })()}
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
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [error, setError] = useState('')

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
  function submit(e: FormEvent) {
    e.preventDefault()
    if (!draft.name.trim()) return
    void run(async () => {
      await store.saveMedicine(draft)
      setDraft({ ...EMPTY_RX })
    })
  }

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
        </div>
        {list === null && <div className="empty">Loading…</div>}
        {list && list.length === 0 && <div className="empty">No medicines yet. Add your own below, or begin with the starter list and edit it.</div>}
        {list?.map((m) => (
          <div className="tag-row" key={m.id}>
            <div className="grow">
              <div style={{ fontWeight: 600 }}>{m.name}</div>
              <div className="muted" style={{ fontSize: 13 }}>
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
                <button type="button" className="btn small" onClick={() => setDraft({ ...m })}>Edit</button>
                <button type="button" className="btn small" onClick={() => setConfirmId(m.id)}>Remove</button>
              </>
            )}
          </div>
        ))}
      </section>

      <form className="card pad" onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h2>{draft.id ? 'Edit medicine' : 'Add a medicine'}</h2>
        <div className="form-grid">
          {MED_FIELDS.map((fd) => (
            <label key={fd.key} className={fd.wide ? 'field wide' : 'field'}>
              {fd.label}
              <input value={draft[fd.key]} onChange={(e) => setDraft({ ...draft, [fd.key]: e.target.value })} autoComplete="off" />
            </label>
          ))}
        </div>
        <div className="row end">
          {draft.id && <button type="button" className="btn" onClick={() => setDraft({ ...EMPTY_RX })}>Cancel</button>}
          <button type="submit" className="btn primary" disabled={!draft.name.trim()}>{draft.id ? 'Save changes' : 'Add to my list'}</button>
        </div>
      </form>
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
        {list === null && <div className="empty">Loading…</div>}
        {list && list.length === 0 && <div className="empty">No templates yet.</div>}
        {list?.map((t) => (
          <div className="tag-row" key={t.id}>
            <div className="grow">
              <div style={{ fontWeight: 600 }}>{t.name}</div>
              <div className="muted" style={{ fontSize: 13 }}>{t.medicines.map((m) => m.name).join(' · ') || 'No medicines'}</div>
            </div>
            {confirmId === t.id ? (
              <>
                <span>Delete this template?</span>
                <button type="button" className="btn small" onClick={() => setConfirmId(null)}>Keep</button>
                <button type="button" className="btn danger small" onClick={() => { setConfirmId(null); store.deleteTemplate(t.id).then(reload, (e: Error) => setError(e.message)) }}>Delete</button>
              </>
            ) : (
              <button type="button" className="btn small" onClick={() => setConfirmId(t.id)}>Delete</button>
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
  const [draft, setDraft] = useState({ name: '', category: '', unit: '' })
  const [confirm, setConfirm] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function reload() {
    try {
      const [i, p] = await Promise.all([store.listInvestigations(), store.listPanels()])
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
                if (panels.length === 0) for (const p of STARTER_PANELS) await store.savePanel(p)
              })}
            >
              Add the starter list and panels
            </button>
          )}
        </div>
        {list === null && <div className="empty">Loading…</div>}
        {list && list.length === 0 && <div className="empty">No investigations yet. Add your own below, or begin with the starter list and edit it.</div>}
        {cats.map((c) => (
          <div key={c}>
            <div className="group-head">{c}</div>
            {list!.filter((i) => i.category === c).map((i) => (
              <div className="tag-row" key={i.id} style={{ padding: '6px 16px' }}>
                <div className="grow">{i.name}</div>
                <span className="muted mono">{i.unit}</span>
                {confirm === i.id ? (
                  <>
                    <button type="button" className="btn small" onClick={() => setConfirm(null)}>Keep</button>
                    <button type="button" className="btn danger small" onClick={() => { setConfirm(null); void run(() => store.deleteInvestigation(i.id)) }}>Remove</button>
                  </>
                ) : (
                  <button type="button" className="btn small" aria-label={`Remove ${i.name}`} onClick={() => setConfirm(i.id)}>Remove</button>
                )}
              </div>
            ))}
          </div>
        ))}
        <form className="tag-row" onSubmit={submit} style={{ borderBottom: 0 }}>
          <input type="text" aria-label="New investigation name" placeholder="New investigation" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          <input type="text" aria-label="Category" placeholder="Category" list="inv-cats" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} style={{ flex: '1 1 150px' }} />
          <datalist id="inv-cats">{cats.map((c) => <option key={c} value={c} />)}</datalist>
          <input type="text" aria-label="Unit" placeholder="Unit" value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value })} style={{ flex: '0 1 100px' }} />
          <button type="submit" className="btn primary small" disabled={!draft.name.trim()}>Add</button>
        </form>
      </section>

      <section className="card">
        <div className="card-head">
          <div className="grow">
            <h2>Panels</h2>
            <div className="muted">Create a panel from any visit with "Save this selection as a panel".</div>
          </div>
        </div>
        {panels.length === 0 && <div className="empty">No panels yet.</div>}
        {panels.map((p) => (
          <div className="tag-row" key={p.id}>
            <div className="grow">
              <div style={{ fontWeight: 600 }}>{p.name}</div>
              <div className="muted" style={{ fontSize: 13 }}>{p.items.join(' · ')}</div>
            </div>
            {confirm === p.id ? (
              <>
                <button type="button" className="btn small" onClick={() => setConfirm(null)}>Keep</button>
                <button type="button" className="btn danger small" onClick={() => { setConfirm(null); void run(() => store.deletePanel(p.id)) }}>Delete</button>
              </>
            ) : (
              <button type="button" className="btn small" aria-label={`Delete panel ${p.name}`} onClick={() => setConfirm(p.id)}>Delete</button>
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
  { key: 'protocols', label: 'Protocols', el: <ProtocolLibrary /> },
  { key: 'meds', label: 'Medicines', el: <Medicines /> },
  { key: 'tests', label: 'Investigations', el: <Investigations /> },
  { key: 'templates', label: 'Templates', el: <Templates /> },
  { key: 'device', label: 'This device', el: <ThisDevice /> },
]

export default function Settings() {
  const [params, setParams] = useSearchParams()
  const wanted = params.get('tab') ?? ''
  const tab = TABS.some((t) => t.key === wanted) ? wanted : 'clinic'
  const setTab = (key: string) => setParams({ tab: key }, { replace: true })
  return (
    <main className={tab === 'print' ? 'page' : 'page narrow'}>
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
