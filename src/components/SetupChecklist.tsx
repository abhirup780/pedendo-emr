import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { todayISO } from '../lib/age'
import { lastBackup } from '../lib/backup'
import { daysBetween } from '../lib/clinical'
import { photoFiles } from '../lib/photofiles'
import { store } from '../lib/store'

interface Item {
  done: boolean
  text: string
  to: string
  action: string
}

/**
 * What is still to do before the app is ready for clinic, shown on the patient list until
 * each item is done. It reads the account's own settings; nothing here is stored.
 */
export default function SetupChecklist({ patients }: { patients: number | null }) {
  const [items, setItems] = useState<Item[] | null>(null)

  useEffect(() => {
    let live = true
    Promise.all([store.getClinic(), store.listConditions(), store.listMedicines(), store.listInvestigations()]).then(
      ([clinic, tags, meds, tests]) => {
        if (!live) return
        const backup = lastBackup()
        const stale = backup == null || (daysBetween(backup, todayISO()) ?? 99) > 7
        setItems([
          { done: !!clinic.doctor_name.trim(), text: 'Letterhead: the doctor and clinic details printed on prescriptions', to: '/settings?tab=clinic', action: 'Fill in' },
          { done: tags.length > 0, text: 'Condition tags for labelling and grouping patients', to: '/settings?tab=tags', action: 'Set up' },
          { done: meds.length > 0, text: 'Your medicine list, for one-tap prescribing', to: '/settings?tab=meds', action: 'Set up' },
          { done: tests.length > 0, text: 'Your investigation list and panels', to: '/settings?tab=tests', action: 'Set up' },
          { done: photoFiles.kind !== 'none', text: 'Google Drive for photographs (optional): not connected to this deployment', to: '', action: '' },
          // Only nag about backups once there is something to lose, and never in the demo.
          { done: store.mode === 'demo' || !patients || !stale, text: backup ? 'Backup: the last one from this browser is over a week old' : 'Backup: none has been downloaded from this browser', to: '/registry', action: 'Back up' },
        ])
      },
      () => live && setItems([]),
    )
    return () => {
      live = false
    }
  }, [patients])

  const open = (items ?? []).filter((i) => !i.done)
  if (open.length === 0) return null
  return (
    <section className="card pad" aria-label="Still to set up">
      <h2 style={{ marginBottom: 8 }}>Still to set up</h2>
      <ul className="checklist">
        {open.map((i) => (
          <li key={i.text}>
            <span className="grow">{i.text}</span>
            {i.to && <Link to={i.to} className="btn small">{i.action}</Link>}
          </li>
        ))}
      </ul>
    </section>
  )
}
