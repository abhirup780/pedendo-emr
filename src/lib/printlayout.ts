/**
 * Print layouts: how a prescription is laid out on a particular paper or pre-printed pad.
 * A doctor can keep several (one per clinic) and choose one when printing. Everything here is
 * plain data and pure functions; `components/RxSheet.tsx` draws it.
 */

export const SECTIONS = [
  { key: 'letterhead', label: 'Letterhead', hint: 'Doctor and clinic details. Hide it for pre-printed paper.', full: true },
  { key: 'patient', label: 'Patient line', hint: 'Name, age, sex, MRN and date', full: true },
  { key: 'vitals', label: 'Measurements', hint: 'Height, weight, BMI, BP', full: false },
  { key: 'tanner', label: 'Pubertal stage', hint: 'Only when staged at the visit', full: false },
  { key: 'allergy', label: 'Drug allergy', hint: 'Only when one is recorded', full: false },
  { key: 'complaint', label: 'Chief complaint', hint: '', full: false },
  { key: 'history', label: 'History and examination', hint: '', full: false },
  { key: 'diagnosis', label: 'Diagnosis', hint: 'The assessment written at the visit', full: false },
  { key: 'rx', label: 'Medicines (℞)', hint: '', full: false },
  { key: 'investigations', label: 'Investigations advised', hint: '', full: false },
  { key: 'plan', label: 'Plan', hint: 'Still follows the per-visit "printed" switch', full: false },
  { key: 'advice', label: 'Advice', hint: '', full: false },
  { key: 'review', label: 'Next review', hint: '', full: false },
  { key: 'signature', label: 'Signature', hint: '', full: true },
  { key: 'note', label: 'Footer note', hint: 'Fixed text such as clinic timings', full: true },
] as const

export type SectionKey = (typeof SECTIONS)[number]['key']

export interface SectionConfig {
  key: SectionKey
  show: boolean
  /** Extra blank space above this section, in mm. */
  space_before: number
  /** In a two-column layout, put this section in the side column. */
  side: boolean
}

export interface PrintConfig {
  paper: { name: string; width: number; height: number }
  /** mm. `top` is for the first page (room for a pre-printed header); `top_next` for the rest. */
  margin: { top: number; top_next: number; right: number; bottom: number; left: number }
  font_pt: number
  line_height: number
  /** Space between sections, mm. */
  gap: number
  accent: string
  /** Width of the side column in mm; 0 for a single column. */
  side_width: number
  side_rule: boolean
  letterhead: {
    /** Clinic lines come from Settings, or are typed here for this clinic only. */
    source: 'settings' | 'custom'
    clinic_name: string
    address: string
    phone: string
    email: string
    logo: boolean
    arrangement: 'split' | 'centred'
    rule: boolean
  }
  patient: { mrn: boolean; date: boolean }
  vitals: 'boxes' | 'inline'
  rx: { symbol: boolean; style: 'detailed' | 'compact' }
  /** `review_beside`: print the next-review date on the same row as the signature, to save space. */
  signature: { image: boolean; name: boolean; patient: boolean; at_foot: boolean; review_beside: boolean }
  page_numbers: boolean
  note: string
  sections: SectionConfig[]
}

export interface PrintLayout {
  id: string
  name: string
  is_default: boolean
  config: PrintConfig
}

export const PAPERS: { name: string; width: number; height: number }[] = [
  { name: 'A4', width: 210, height: 297 },
  { name: 'A5', width: 148, height: 210 },
  { name: 'Letter', width: 215.9, height: 279.4 },
  { name: 'Half letter', width: 139.7, height: 215.9 },
]

export const ACCENTS = [
  { label: 'Teal', value: '#0b5d66' },
  { label: 'Black', value: '#14242b' },
  { label: 'Navy', value: '#1d3a6b' },
  { label: 'Maroon', value: '#7a1f33' },
]

const section = (key: SectionKey, show = true, side = false, space_before = 0): SectionConfig => ({ key, show, side, space_before })

/** The layout used until the doctor makes one: plain A4, the app prints its own letterhead. */
export const STANDARD: PrintConfig = {
  paper: { ...PAPERS[0] },
  margin: { top: 13, top_next: 13, right: 15, bottom: 15, left: 15 },
  font_pt: 12,
  line_height: 1.4,
  gap: 5,
  accent: '#0b5d66',
  side_width: 0,
  side_rule: true,
  letterhead: { source: 'settings', clinic_name: '', address: '', phone: '', email: '', logo: true, arrangement: 'split', rule: true },
  patient: { mrn: true, date: true },
  vitals: 'boxes',
  rx: { symbol: true, style: 'detailed' },
  signature: { image: true, name: true, patient: true, at_foot: true, review_beside: true },
  page_numbers: true,
  note: '',
  sections: SECTIONS.map((s) => section(s.key, !['complaint', 'history', 'note'].includes(s.key))),
}

const withSections = (base: PrintConfig, change: (s: SectionConfig) => Partial<SectionConfig>): SectionConfig[] => base.sections.map((s) => ({ ...s, ...change(s) }))

/** Starting points offered when a new layout is created. Every value stays editable. */
export const PRESETS: { name: string; about: string; config: PrintConfig }[] = [
  { name: 'Plain A4', about: 'Blank paper; the app prints the letterhead.', config: STANDARD },
  {
    name: 'Pre-printed A4 letterhead',
    about: 'Leaves the top and bottom of the page clear for a printed pad.',
    config: { ...STANDARD, accent: '#14242b', margin: { top: 50, top_next: 20, right: 15, bottom: 28, left: 15 }, page_numbers: false, sections: withSections(STANDARD, (s) => (s.key === 'letterhead' ? { show: false } : {})) },
  },
  {
    name: 'A5 pad',
    about: 'Small pre-printed pad: compact text and one-line medicines.',
    config: { ...STANDARD, paper: { ...PAPERS[1] }, accent: '#14242b', margin: { top: 38, top_next: 12, right: 10, bottom: 16, left: 10 }, font_pt: 10, gap: 3.5, vitals: 'inline', rx: { symbol: true, style: 'compact' }, page_numbers: false, signature: { ...STANDARD.signature, patient: false }, sections: withSections(STANDARD, (s) => (s.key === 'letterhead' ? { show: false } : {})) },
  },
  {
    name: 'Two-column A4',
    about: 'Findings and investigations in a side column, medicines beside them.',
    config: { ...STANDARD, side_width: 58, vitals: 'inline', sections: withSections(STANDARD, (s) => (['vitals', 'tanner', 'allergy', 'complaint', 'history', 'investigations'].includes(s.key) ? { side: true } : {})) },
  },
]

const clamp = (v: unknown, min: number, max: number, fallback: number): number => {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback
}
const pick = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T => (allowed.includes(v as T) ? (v as T) : fallback)
const bool = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback)
const text = (v: unknown, max: number): string => (typeof v === 'string' ? v.slice(0, max) : '')

/**
 * Brings any stored config to the current shape: missing options take the standard value,
 * numbers are kept within printable limits, and every section appears exactly once. Layouts
 * saved by an older version of the app therefore keep working when options are added.
 */
export function normalize(raw: unknown): PrintConfig {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const obj = (k: string) => (r[k] && typeof r[k] === 'object' ? (r[k] as Record<string, unknown>) : {})
  const paper = obj('paper')
  const width = clamp(paper.width, 70, 420, STANDARD.paper.width)
  const height = clamp(paper.height, 90, 600, STANDARD.paper.height)
  const m = obj('margin')
  // Margins may not swallow the page: at least 40 mm of width and 50 mm of height stay usable.
  const left = clamp(m.left, 0, (width - 40) / 2, STANDARD.margin.left)
  const right = clamp(m.right, 0, (width - 40) / 2, STANDARD.margin.right)
  const bottom = clamp(m.bottom, 0, (height - 50) / 2, STANDARD.margin.bottom)
  const top = clamp(m.top, 0, height - 50 - bottom, STANDARD.margin.top)
  const top_next = clamp(m.top_next, 0, height - 50 - bottom, Math.min(top, STANDARD.margin.top_next))
  const lh = obj('letterhead')
  const sig = obj('signature')
  const rx = obj('rx')
  const pat = obj('patient')

  const seen = new Set<string>()
  const given = Array.isArray(r.sections) ? (r.sections as Record<string, unknown>[]) : []
  const known = new Map<string, (typeof SECTIONS)[number]>(SECTIONS.map((s) => [s.key, s]))
  const sections: SectionConfig[] = []
  for (const s of given) {
    const def = s && typeof s === 'object' ? known.get(String(s.key)) : undefined
    if (!def || seen.has(def.key)) continue
    seen.add(def.key)
    sections.push({ key: def.key, show: bool(s.show, true), space_before: clamp(s.space_before, 0, 120, 0), side: def.full ? false : bool(s.side, false) })
  }
  // Sections added to the app since this layout was saved go in at their standard place.
  for (const std of STANDARD.sections) {
    if (seen.has(std.key)) continue
    const after = STANDARD.sections.slice(0, STANDARD.sections.indexOf(std)).reverse().find((p) => seen.has(p.key))
    const at = after ? sections.findIndex((s) => s.key === after.key) + 1 : 0
    sections.splice(at, 0, { ...std, show: given.length === 0 ? std.show : false })
    seen.add(std.key)
  }

  return {
    paper: { name: text(paper.name, 40) || (PAPERS.find((p) => p.width === width && p.height === height)?.name ?? 'Custom'), width, height },
    margin: { top, top_next, right, bottom, left },
    font_pt: clamp(r.font_pt, 7, 16, STANDARD.font_pt),
    line_height: clamp(r.line_height, 1, 2.2, STANDARD.line_height),
    gap: clamp(r.gap, 0, 20, STANDARD.gap),
    accent: /^#[0-9a-f]{6}$/i.test(String(r.accent)) ? String(r.accent) : STANDARD.accent,
    side_width: (() => {
      const w = clamp(r.side_width, 0, 120, 0)
      return w === 0 ? 0 : Math.min(Math.max(w, 30), Math.max(30, width - left - right - 60))
    })(),
    side_rule: bool(r.side_rule, true),
    letterhead: {
      source: pick(lh.source, ['settings', 'custom'] as const, 'settings'),
      clinic_name: text(lh.clinic_name, 120),
      address: text(lh.address, 300),
      phone: text(lh.phone, 80),
      email: text(lh.email, 120),
      logo: bool(lh.logo, true),
      arrangement: pick(lh.arrangement, ['split', 'centred'] as const, 'split'),
      rule: bool(lh.rule, true),
    },
    patient: { mrn: bool(pat.mrn, true), date: bool(pat.date, true) },
    vitals: pick(r.vitals, ['boxes', 'inline'] as const, 'boxes'),
    rx: { symbol: bool(rx.symbol, true), style: pick(rx.style, ['detailed', 'compact'] as const, 'detailed') },
    signature: { image: bool(sig.image, true), name: bool(sig.name, true), patient: bool(sig.patient, true), at_foot: bool(sig.at_foot, true), review_beside: bool(sig.review_beside, true) },
    page_numbers: bool(r.page_numbers, true),
    note: text(r.note, 600),
    sections,
  }
}

export type Block = { kind: 'full'; key: SectionKey } | { kind: 'columns'; side: SectionKey[]; main: SectionKey[] }

/**
 * The order things are drawn in. With one column every shown section is simply stacked. With
 * a side column, each run of ordinary sections becomes a two-column block, and the
 * full-width sections (letterhead, patient line, signature, footer note) break across it.
 */
export function blocks(config: PrintConfig): Block[] {
  const shown = config.sections.filter((s) => s.show)
  if (config.side_width === 0) return shown.map((s) => ({ kind: 'full', key: s.key }))
  const full = new Set<string>(SECTIONS.filter((s) => s.full).map((s) => s.key))
  const out: Block[] = []
  for (const s of shown) {
    if (full.has(s.key)) {
      out.push({ kind: 'full', key: s.key })
      continue
    }
    let last = out[out.length - 1]
    if (!last || last.kind !== 'columns') {
      last = { kind: 'columns', side: [], main: [] }
      out.push(last)
    }
    ;(s.side ? last.side : last.main).push(s.key)
  }
  return out
}

/** The page rules for the browser's print engine: paper size, margins, page numbers. */
export function pageCss(c: PrintConfig): string {
  const mm = (n: number) => `${Math.round(n * 10) / 10}mm`
  const numbers = c.page_numbers ? ` @bottom-right { content: 'Page ' counter(page) ' of ' counter(pages); font-family: 'IBM Plex Sans', sans-serif; font-size: 8pt; color: #55656c; }` : ''
  return `@page { size: ${mm(c.paper.width)} ${mm(c.paper.height)}; margin: ${mm(c.margin.top_next)} ${mm(c.margin.right)} ${mm(c.margin.bottom)} ${mm(c.margin.left)};${numbers} }\n@page :first { margin-top: ${mm(c.margin.top)}; }`
}

/** Height available for content on the first page, mm (a little under, to avoid a blank page). */
export function firstPageInnerHeight(c: PrintConfig): number {
  return Math.max(20, c.paper.height - c.margin.top - c.margin.bottom - 3)
}

/**
 * A doctor's qualifications in the pieces a line may break between: one degree to a piece,
 * each with the comma (or other mark) that follows it. "MD (Pediatrics), DM (Endocrinology)"
 * gives "MD (Pediatrics)," and "DM (Endocrinology)", so that a narrow letterhead breaks the
 * line after the comma and not inside a degree. A mark inside brackets does not divide.
 */
export function qualificationParts(text: string): string[] {
  const parts: string[] = []
  let depth = 0
  let from = 0
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '(' || ch === '[') depth++
    else if (ch === ')' || ch === ']') depth = Math.max(0, depth - 1)
    else if (depth === 0 && (ch === ',' || ch === ';' || ch === '|' || ch === '·')) {
      parts.push(text.slice(from, i + 1).trim())
      from = i + 1
    }
  }
  parts.push(text.slice(from).trim())
  return parts.filter(Boolean)
}

/**
 * True for paper that carries its own letterhead: the app prints none, and the top of the
 * first page is left clear for it.
 */
export function preprinted(c: PrintConfig): boolean {
  return !c.sections.find((s) => s.key === 'letterhead')?.show && c.margin.top >= 20
}

export function describe(c: PrintConfig): string {
  const size = PAPERS.find((p) => Math.abs(p.width - c.paper.width) < 0.6 && Math.abs(p.height - c.paper.height) < 0.6)?.name ?? PAPERS.find((p) => Math.abs(p.height - c.paper.width) < 0.6 && Math.abs(p.width - c.paper.height) < 0.6)?.name.concat(' landscape') ?? `${c.paper.width} × ${c.paper.height} mm`
  const head = c.sections.find((s) => s.key === 'letterhead')?.show ? 'prints letterhead' : 'pre-printed paper'
  return [size, head, c.side_width ? 'two columns' : '', `${c.font_pt} pt`].filter(Boolean).join(' · ')
}

const DEVICE_KEY = 'pedendo-print-layout'
/** The layout last used on this device: a clinic's computer keeps using that clinic's pad. */
export function rememberedLayout(): string | null {
  try {
    return localStorage.getItem(DEVICE_KEY)
  } catch {
    return null
  }
}
export function rememberLayout(id: string): void {
  try {
    localStorage.setItem(DEVICE_KEY, id)
  } catch {
    /* falls back to the default layout */
  }
}
