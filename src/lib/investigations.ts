/**
 * Starter investigation list and panels, offered once from Settings. The doctor owns the list
 * afterwards. Units are common reporting units only; laboratories differ, so the unit stays
 * editable on every result.
 */
export const STARTER_INVESTIGATIONS: { category: string; items: [name: string, unit: string][] }[] = [
  {
    category: 'Growth and GH axis',
    items: [
      ['IGF-1', 'ng/mL'],
      ['IGFBP-3', 'µg/mL'],
      ['GH stimulation test (clonidine)', ''],
      ['GH stimulation test (glucagon)', ''],
      ['Bone age X-ray (left hand and wrist)', ''],
      ['Karyotype', ''],
      ['MRI pituitary with contrast', ''],
      ['Coeliac screen (tTG-IgA + total IgA)', ''],
    ],
  },
  {
    category: 'Thyroid',
    items: [
      ['TSH', 'mIU/L'],
      ['Free T4', 'ng/dL'],
      ['Free T3', 'pg/mL'],
      ['Anti-TPO antibodies', 'IU/mL'],
      ['Anti-thyroglobulin antibodies', 'IU/mL'],
      ['Thyroid ultrasound', ''],
    ],
  },
  {
    category: 'Diabetes and glucose',
    items: [
      ['HbA1c', '%'],
      ['Fasting plasma glucose', 'mg/dL'],
      ['Oral glucose tolerance test', ''],
      ['C-peptide', 'ng/mL'],
      ['GAD-65 antibodies', ''],
      ['IA-2 antibodies', ''],
      ['Urine albumin : creatinine ratio', 'mg/g'],
      ['Fasting lipid profile', ''],
    ],
  },
  {
    category: 'Puberty and gonads',
    items: [
      ['LH', 'IU/L'],
      ['FSH', 'IU/L'],
      ['Estradiol', 'pg/mL'],
      ['Testosterone (total)', 'ng/dL'],
      ['GnRH stimulation test', ''],
      ['DHEAS', 'µg/dL'],
      ['AMH', 'ng/mL'],
      ['Pelvic ultrasound', ''],
    ],
  },
  {
    category: 'Adrenal',
    items: [
      ['8 am cortisol', 'µg/dL'],
      ['ACTH', 'pg/mL'],
      ['17-OH progesterone', 'ng/mL'],
      ['ACTH stimulation test', ''],
      ['Plasma renin activity', 'ng/mL/h'],
      ['Serum electrolytes (Na, K)', 'mmol/L'],
    ],
  },
  {
    category: 'Bone and mineral',
    items: [
      ['Calcium', 'mg/dL'],
      ['Phosphate', 'mg/dL'],
      ['Alkaline phosphatase', 'U/L'],
      ['25-OH vitamin D', 'ng/mL'],
      ['PTH', 'pg/mL'],
      ['X-ray wrist and knee', ''],
    ],
  },
  {
    category: 'General',
    items: [
      ['Complete blood count', ''],
      ['Renal function tests', ''],
      ['Liver function tests', ''],
      ['Urine routine', ''],
    ],
  },
]

const BONE_AGE = 'Bone age X-ray (left hand and wrist)'
const COELIAC = 'Coeliac screen (tTG-IgA + total IgA)'

export const STARTER_PANELS: { name: string; items: string[] }[] = [
  { name: 'GH therapy monitoring', items: ['IGF-1', 'TSH', 'Free T4', 'HbA1c', BONE_AGE] },
  { name: 'Short stature work-up', items: ['Complete blood count', 'Renal function tests', 'Liver function tests', 'TSH', 'Free T4', 'IGF-1', 'IGFBP-3', COELIAC, BONE_AGE] },
  { name: 'Type 1 diabetes annual review', items: ['HbA1c', 'TSH', 'Anti-TPO antibodies', COELIAC, 'Urine albumin : creatinine ratio', 'Fasting lipid profile'] },
  { name: 'Precocious puberty work-up', items: ['LH', 'FSH', 'Estradiol', 'GnRH stimulation test', BONE_AGE, 'Pelvic ultrasound'] },
  { name: 'CAH monitoring', items: ['17-OH progesterone', 'Testosterone (total)', 'Plasma renin activity', 'Serum electrolytes (Na, K)', BONE_AGE] },
  { name: 'Rickets and bone profile', items: ['Calcium', 'Phosphate', 'Alkaline phosphatase', '25-OH vitamin D', 'PTH', 'X-ray wrist and knee'] },
]

/** Categories in clinic order, then any the doctor added, alphabetically. */
export function categoryOrder(categories: string[]): string[] {
  const known = STARTER_INVESTIGATIONS.map((g) => g.category)
  const seen = [...new Set(categories)]
  return [...known.filter((k) => seen.includes(k)), ...seen.filter((c) => !known.includes(c)).sort((a, b) => a.localeCompare(b))]
}

/** Latest result per test (newest first), each with the one before it for comparison. */
export function latestPerTest<T extends { test: string; result_date: string; created_at: string }>(results: T[]): { latest: T; previous: T | null }[] {
  const sorted = [...results].sort((a, b) => b.result_date.localeCompare(a.result_date) || b.created_at.localeCompare(a.created_at))
  const out = new Map<string, { latest: T; previous: T | null }>()
  for (const r of sorted) {
    const key = r.test.trim().toLowerCase()
    const hit = out.get(key)
    if (!hit) out.set(key, { latest: r, previous: null })
    else if (!hit.previous) hit.previous = r
  }
  return [...out.values()]
}

/**
 * The name a typed fragment most likely means: an exact name first, then a name starting with
 * it, then one where a word starts with it ("vit" finds "25-OH vitamin D", not "activity"),
 * then any name containing it. Null when nothing contains it.
 */
export function bestMatch(names: string[], typed: string): string | null {
  return rankedMatches(names, typed)[0] ?? null
}

/** Every name containing what was typed, best first (same order of preference as bestMatch). */
export function rankedMatches(names: string[], typed: string): string[] {
  const t = typed.trim().toLowerCase()
  if (!t) return []
  const rank = (name: string): number => {
    const n = name.toLowerCase()
    if (n === t) return 0
    if (n.startsWith(t)) return 1
    if (n.split(/[^a-z0-9]+/).some((w) => w.startsWith(t))) return 2
    return n.includes(t) ? 3 : 9
  }
  const scored = names.map((name) => ({ name, r: rank(name) })).filter((x) => x.r < 9)
  scored.sort((a, b) => a.r - b.r || a.name.length - b.name.length || a.name.localeCompare(b.name))
  return scored.map((x) => x.name)
}
