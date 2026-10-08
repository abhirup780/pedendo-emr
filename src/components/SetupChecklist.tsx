import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { todayISO } from '../lib/age'
import { lastBackup } from '../lib/backup'
import { daysBetween } from '../lib/clinical'
import { hiddenReminders, hideReminder } from '../lib/device'
import { store } from '../lib/store'

interface Item {
  id: string
  done: boolean
  text: string
  to: string
  action: string
}

/**
 * What is still to do before the app is ready for clinic, shown on the patient list until
 * each item is done or crossed off. It reads the account's own settings; the only thing stored
 * is which reminders were crossed off on this device.
 */
export default function SetupChecklist({ patients }: { patients: number | null }) {
  const [items, setItems] = useState<Item[] | null>(null)
  const [hidden, setHidden] = useState(hiddenReminders)

  useEffect(() => {
    let live = true
    Promise.all([store.getClinic(), store.listConditions(), store.listMedicines(), store.listInvestigations()]).then(
      ([clinic, tags, meds, tests]) => {
        if (!live) return
        const backup = lastBackup()
        const stale = backup == null || (daysBetween(backup, todayISO()) ?? 99) > 7
        setItems([
          { id: 'clinic', done: !!clinic.doctor_name.trim(), text: 'Letterhead: the doctor and clinic details printed on prescriptions', to: '/settings?tab=clinic', action: 'Fill in' },
          { id: 'tags', done: tags.length > 0, text: 'Condition tags for labelling and grouping patients', to: '/settings?tab=tags', action: 'Set up' },
          { id: 'meds', done: meds.length > 0, text: 'Your medicine list, for one-tap prescribing', to: '/settings?tab=meds', action: 'Set up' },
          { id: 'tests', done: tests.length > 0, text: 'Your investigation list and panels', to: '/settings?tab=tests', action: 'Set up' },
          // Only nag about backups once there is something to lose, and never in the demo.
          { id: 'backup', done: store.mode === 'demo' || !patients || !stale, text: backup ? 'Backup: the last one from this browser is over a week old' : 'Backup: none has been downloaded from this browser', to: '/registry', action: 'Back up' },
        ])
      },
      () => live && setItems([]),
    )
    return () => {
      live = false
    }
  }, [patients])

  const open = (items ?? []).filter((i) => !i.done && !hidden.includes(i.id))
  const hide = (id: string) => {
    hideReminder(id)
    setHidden((h) => [...h, id])
  }
  if (open.length === 0) return null
  return (
    <section className="card pad" aria-label="Still to set up">
      <h2 style={{ marginBottom: 8 }}>Still to set up</h2>
      <ul className="checklist">
        {open.map((i) => (
          <li key={i.id}>
            <span className="grow">{i.text}</span>
            {i.to && <Link to={i.to} className="btn small">{i.action}</Link>}
            <button type="button" className="icon-btn" aria-label={`Hide this reminder: ${i.text}`} title="Hide this reminder" onClick={() => hide(i.id)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
