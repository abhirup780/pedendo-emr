import { PROTOCOL_DATA } from './protocol-data'
import type { Condition, RxItem } from './types'

/**
 * Guideline-based suggestions for a condition: which investigations to advise and when, which
 * medicines are used, and advice lines. They come from reference-data/protocols/*.json, each
 * item with the guideline it was taken from.
 *
 * Rules the screens follow:
 * - A suggestion is only ever offered; nothing is added to a visit unless the doctor picks it.
 * - A medicine is added with its dose BLANK. The guideline's dose range is shown beside the
 *   dose box as a guide, with its source, and only when it was read from a source
 *   (`verified`). The app never works out a dose.
 * - Until the doctor has checked a protocol against the original documents it is a draft, and
 *   the screens say so.
 */
export interface ProtocolSource {
  id: string
  org: string
  year: number
  title: string
  url: string
}
export interface ProtocolTest {
  test: string
  category: string
  unit: string
  note: string
  sources: string[]
}
export interface ProtocolSet {
  name: string
  when: string
  items: ProtocolTest[]
}
export interface ProtocolMedicine {
  generic: string
  /** What is put on the prescription when picked. The dose is always blank. */
  rx: RxItem
  /** Tablet strengths marketed in India, when a source for them was found. */
  strengths: string[]
  verified: boolean
  /** The guideline's dose wording. Empty when no dose could be read from a source. */
  doseGuide: string
  max: string
  indication: string
  monitoring: string
  prescriberNote: string
  note: string
  quote: string
  sources: string[]
  /** The sources for the dose itself (a drug index used only for tablet strengths is left out). */
  doseSources: string[]
}
export interface Protocol {
  key: string
  name: string
  group: string
  /** Tag names that pick this protocol up when the tag has no protocols set by hand. */
  aliases: string[]
  compiledOn: string
  review: string
  sources: ProtocolSource[]
  sets: ProtocolSet[]
  medicines: ProtocolMedicine[]
  advice: { text: string; sources: string[] }[]
  caveats: string
}

export const PROTOCOLS: Protocol[] = PROTOCOL_DATA

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

/** Protocols a tag would pick up from its name alone. */
export function protocolsByName(tagName: string, all: Protocol[] = PROTOCOLS): Protocol[] {
  return all.filter((p) => same(p.name, tagName) || p.aliases.some((a) => same(a, tagName)))
}

/**
 * The protocols that apply to a patient with these tags. A tag with protocols chosen in
 * Settings uses exactly those; any other tag is matched by its name. No repeats, in list order.
 */
export function protocolsForTags(tags: Pick<Condition, 'name' | 'protocols'>[], all: Protocol[] = PROTOCOLS): Protocol[] {
  const keys = new Set<string>()
  for (const t of tags) {
    const chosen = (t.protocols ?? []).filter((k) => all.some((p) => p.key === k))
    for (const k of chosen.length > 0 ? chosen : protocolsByName(t.name, all).map((p) => p.key)) keys.add(k)
  }
  return all.filter((p) => keys.has(p.key))
}

/** "ISPAE 2018, IAP 2022" for a list of source ids. */
export function cite(p: Protocol, ids: string[]): string {
  const labels = ids.map((id) => p.sources.find((s) => s.id === id)).filter((s): s is ProtocolSource => !!s).map((s) => `${s.org} ${s.year}`)
  return [...new Set(labels)].join(', ')
}

export interface DoseGuide {
  protocol: string
  text: string
  max: string
  prescriberNote: string
  source: string
  verified: boolean
}

/**
 * What the patient's protocols say about the dose of a medicine on the prescription, matched
 * by the generic name at the start of the medicine's name ("Levothyroxine tablet 50 mcg").
 */
export function doseGuides(medicineName: string, protocols: Protocol[]): DoseGuide[] {
  const name = medicineName.trim().toLowerCase()
  if (!name) return []
  const out: DoseGuide[] = []
  for (const p of protocols)
    for (const m of p.medicines) {
      const generic = m.generic.toLowerCase().replace(/\s*\(.*\)$/, '')
      if (name === generic || name.startsWith(`${generic} `)) out.push({ protocol: p.name, text: m.doseGuide, max: m.max, prescriberNote: m.prescriberNote, source: cite(p, m.doseSources), verified: m.verified })
    }
  return out
}
