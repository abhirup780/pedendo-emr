import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { store } from '../lib/store'
import { STARTER_CONDITIONS, TAG_COLORS, tagColor } from '../lib/tags'
import type { Condition } from '../lib/types'

function Swatches({ value, onChange, label }: { value: string; onChange: (c: string) => void; label: string }) {
  return (
    <div className="swatches" role="group" aria-label={label}>
      {Object.entries(TAG_COLORS).map(([key, c]) => (
        <button key={key} type="button" className="swatch" aria-label={c.label} aria-pressed={value === key} style={{ background: c.fg }} onClick={() => onChange(key)} />
      ))}
    </div>
  )
}

export default function Settings() {
  const [list, setList] = useState<Condition[] | null>(null)
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [name, setName] = useState('')
  const [color, setColor] = useState('teal')
  const [confirmId, setConfirmId] = useState<string | null>(null)
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
    <main className="page narrow">
      <div>
        <h1>Settings</h1>
        <div className="muted">Condition tags are used to label, filter and group patients.</div>
      </div>
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
    </main>
  )
}
