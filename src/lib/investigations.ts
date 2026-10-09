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
      ['GH stimulation test (insulin tolerance)', ''],
      ['GH stimulation test (arginine)', ''],
      ['IGF-1 generation test', ''],
      ['GH suppression test (oral glucose)', ''],
      ['Skeletal survey', ''],
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
      ['Total T4', 'µg/dL'],
      ['Total T3', 'ng/dL'],
      ['TSH receptor antibodies (TRAb)', ''],
      ['Thyroglobulin', 'ng/mL'],
      ['Thyroid scan (Tc-99m)', ''],
      ['Calcitonin', 'pg/mL'],
      ['Thyroid FNAC', ''],
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
      ['Random plasma glucose', 'mg/dL'],
      ['Post-prandial plasma glucose', 'mg/dL'],
      ['Fasting insulin', 'µIU/mL'],
      ['Stimulated C-peptide', 'ng/mL'],
      ['ZnT8 antibodies', ''],
      ['Insulin autoantibodies (IAA)', ''],
      ['Islet cell antibodies (ICA)', ''],
      ['Blood ketones (beta-hydroxybutyrate)', 'mmol/L'],
      ['Urine ketones', ''],
      ['Venous blood gas', ''],
      ['Fructosamine', 'µmol/L'],
      ['Dilated fundus examination', ''],
      ['Continuous glucose monitoring report', ''],
      ['Critical sample for hypoglycaemia', ''],
      ['Serum ammonia', 'µmol/L'],
      ['Serum lactate', 'mmol/L'],
      ['Free fatty acids', ''],
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
      ['Free testosterone', ''],
      ['Dihydrotestosterone (DHT)', ''],
      ['Androstenedione', 'ng/mL'],
      ['SHBG', 'nmol/L'],
      ['Inhibin B', 'pg/mL'],
      ['Progesterone', 'ng/mL'],
      ['Beta-hCG', 'mIU/mL'],
      ['Alpha-fetoprotein', 'ng/mL'],
      ['hCG stimulation test', ''],
      ['Testicular ultrasound', ''],
      ['Semen analysis', ''],
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
      ['Low-dose ACTH stimulation test', ''],
      ['Aldosterone', 'ng/dL'],
      ['11-deoxycortisol', ''],
      ['24-hour urinary free cortisol', ''],
      ['Overnight dexamethasone suppression test', ''],
      ['Late-night salivary cortisol', ''],
      ['Plasma metanephrines', ''],
      ['24-hour urinary metanephrines', ''],
      ['Urine steroid profile', ''],
      ['Very long chain fatty acids', ''],
      ['21-hydroxylase antibodies', ''],
      ['CT adrenals', ''],
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
      ['Ionised calcium', 'mmol/L'],
      ['Magnesium', 'mg/dL'],
      ['1,25-dihydroxy vitamin D', 'pg/mL'],
      ['Urine calcium : creatinine ratio', ''],
      ['24-hour urinary calcium', ''],
      ['Tubular reabsorption of phosphate (TmP/GFR)', ''],
      ['FGF23', ''],
      ['DEXA scan (bone density)', ''],
      ['Renal ultrasound', ''],
      ['X-ray spine (lateral)', ''],
    ],
  },
  {
    category: 'Pituitary and water balance',
    items: [
      ['Prolactin', 'ng/mL'],
      ['MRI brain', ''],
      ['Visual field testing', ''],
      ['Serum sodium', 'mmol/L'],
      ['Serum osmolality', 'mOsm/kg'],
      ['Urine osmolality', 'mOsm/kg'],
      ['Urine specific gravity', ''],
      ['Urine sodium', 'mmol/L'],
      ['24-hour urine volume', ''],
      ['Water deprivation test', ''],
      ['Copeptin', 'pmol/L'],
    ],
  },
  {
    category: 'Lipids, liver and obesity',
    items: [
      ['Total cholesterol', 'mg/dL'],
      ['LDL cholesterol', 'mg/dL'],
      ['HDL cholesterol', 'mg/dL'],
      ['Triglycerides', 'mg/dL'],
      ['ALT (SGPT)', 'U/L'],
      ['AST (SGOT)', 'U/L'],
      ['Uric acid', 'mg/dL'],
      ['Ultrasound abdomen', ''],
      ['Sleep study (polysomnography)', ''],
      ['24-hour ambulatory blood pressure', ''],
    ],
  },
  {
    category: 'Genetics',
    items: [
      ['Chromosomal microarray', ''],
      ['FISH for SRY', ''],
      ['Clinical exome sequencing', ''],
      ['Targeted gene panel', ''],
      ['Methylation study (Prader-Willi / Silver-Russell)', ''],
      ['CYP21A2 gene analysis', ''],
      ['SHOX gene analysis', ''],
      ['MODY gene panel', ''],
    ],
  },
  {
    category: 'General',
    items: [
      ['Complete blood count', ''],
      ['Renal function tests', ''],
      ['Liver function tests', ''],
      ['Urine routine', ''],
      ['Haemoglobin', 'g/dL'],
      ['ESR', 'mm/h'],
      ['CRP', 'mg/L'],
      ['Serum creatinine', 'mg/dL'],
      ['Blood urea', 'mg/dL'],
      ['Serum albumin', 'g/dL'],
      ['Ferritin', 'ng/mL'],
      ['Vitamin B12', 'pg/mL'],
      ['ECG', ''],
      ['Echocardiography', ''],
      ['Audiometry', ''],
      ['X-ray chest', ''],
    ],
  },
]

const BONE_AGE = 'Bone age X-ray (left hand and wrist)'
const COELIAC = 'Coeliac screen (tTG-IgA + total IgA)'

/**
 * Starter panels. `tags` names the starter condition tags a panel belongs to: it is then
 * offered on visits of patients carrying that tag. No tags means it is offered for everyone.
 */
export const STARTER_PANELS: { name: string; items: string[]; tags: string[] }[] = [
  { name: 'GH therapy monitoring', tags: ['GH deficiency'], items: ['IGF-1', 'TSH', 'Free T4', 'HbA1c', BONE_AGE] },
  { name: 'Short stature work-up', tags: ['Short stature'], items: ['Complete blood count', 'Renal function tests', 'Liver function tests', 'TSH', 'Free T4', 'IGF-1', 'IGFBP-3', COELIAC, BONE_AGE] },
  { name: 'Type 1 diabetes annual review', tags: ['Type 1 diabetes'], items: ['HbA1c', 'TSH', 'Anti-TPO antibodies', COELIAC, 'Urine albumin : creatinine ratio', 'Fasting lipid profile'] },
  { name: 'Diabetes at diagnosis', tags: ['Type 1 diabetes'], items: ['HbA1c', 'Random plasma glucose', 'Blood ketones (beta-hydroxybutyrate)', 'Venous blood gas', 'C-peptide', 'GAD-65 antibodies', 'IA-2 antibodies', 'TSH', COELIAC] },
  { name: 'Precocious puberty work-up', tags: ['Precocious puberty'], items: ['LH', 'FSH', 'Estradiol', 'GnRH stimulation test', BONE_AGE, 'Pelvic ultrasound'] },
  { name: 'Delayed puberty work-up', tags: ['Delayed puberty'], items: ['LH', 'FSH', 'Testosterone (total)', 'Estradiol', 'Prolactin', 'TSH', 'Free T4', BONE_AGE, 'Karyotype'] },
  { name: 'CAH monitoring', tags: ['CAH'], items: ['17-OH progesterone', 'Testosterone (total)', 'Plasma renin activity', 'Serum electrolytes (Na, K)', BONE_AGE] },
  { name: 'Rickets and bone profile', tags: ['Rickets'], items: ['Calcium', 'Phosphate', 'Alkaline phosphatase', '25-OH vitamin D', 'PTH', 'X-ray wrist and knee'] },
  { name: 'Thyroid profile', tags: ['Hypothyroidism'], items: ['TSH', 'Free T4'] },
  { name: 'Obesity work-up', tags: ['Obesity'], items: ['Fasting plasma glucose', 'HbA1c', 'Fasting lipid profile', 'ALT (SGPT)', 'TSH', 'Ultrasound abdomen'] },
  { name: 'Turner syndrome review', tags: ['Turner syndrome'], items: ['TSH', 'Free T4', COELIAC, 'Liver function tests', 'HbA1c', 'Fasting lipid profile', 'LH', 'FSH', 'Echocardiography', 'Renal ultrasound', 'Audiometry'] },
  { name: 'Hypocalcaemia work-up', tags: [], items: ['Calcium', 'Phosphate', 'Magnesium', 'Alkaline phosphatase', 'PTH', '25-OH vitamin D', 'Urine calcium : creatinine ratio'] },
  { name: 'Polyuria work-up', tags: [], items: ['Serum sodium', 'Serum osmolality', 'Urine osmolality', 'Fasting plasma glucose', 'Calcium', 'Renal function tests'] },
]

/** The ids of the clinic's tags that a starter panel belongs to, matched by name. */
export function starterPanelTags(panel: { tags: string[] }, conditions: { id: string; name: string }[]): string[] {
  return conditions.filter((c) => panel.tags.some((t) => t.toLowerCase() === c.name.trim().toLowerCase())).map((c) => c.id)
}

/**
 * Splits the clinic's panels for one patient: those tied to one of the patient's tags, those
 * offered for everyone (no tags), and the rest (tied only to tags this patient does not have).
 * Tags that have since been deleted do not count.
 */
export function panelsForPatient<P extends { condition_ids: string[] }>(panels: P[], patientTagIds: string[], liveTagIds: string[]): { matched: P[]; general: P[]; other: P[] } {
  const live = new Set(liveTagIds)
  const mine = new Set(patientTagIds)
  const out = { matched: [] as P[], general: [] as P[], other: [] as P[] }
  for (const p of panels) {
    const tags = p.condition_ids.filter((id) => live.has(id))
    if (tags.length === 0) out.general.push(p)
    else if (tags.some((id) => mine.has(id))) out.matched.push(p)
    else out.other.push(p)
  }
  return out
}


/** Categories in clinic order, then any the doctor added, alphabetically. */
export function categoryOrder(categories: string[]): string[] {
  const known = STARTER_INVESTIGATIONS.map((g) => g.category)
  const seen = [...new Set(categories)]
  return [...known.filter((k) => seen.includes(k)), ...seen.filter((c) => !known.includes(c)).sort((a, b) => a.localeCompare(b))]
}

/** Latest result per test (newest first), each with the one before it for comparison. */
/** Every result grouped by test: newest first within a test, tests in order of their newest result. */
export function historyPerTest<T extends { test: string; result_date: string; created_at: string }>(results: T[]): { test: string; results: T[] }[] {
  const sorted = [...results].sort((a, b) => b.result_date.localeCompare(a.result_date) || b.created_at.localeCompare(a.created_at))
  const out = new Map<string, { test: string; results: T[] }>()
  for (const r of sorted) {
    const key = r.test.trim().toLowerCase()
    const hit = out.get(key)
    if (hit) hit.results.push(r)
    else out.set(key, { test: r.test.trim(), results: [r] })
  }
  return [...out.values()]
}

/** A result's value as a number, for drawing a trend. Null for "<0.1", "Positive", "7y 6m". */
export function numericValue(value: string): number | null {
  const t = value.trim()
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : null
}

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
