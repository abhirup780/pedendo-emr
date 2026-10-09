import { describe, expect, it } from 'vitest'
import { bestMatch, categoryOrder, historyPerTest, latestPerTest, numericValue, panelsForPatient, rankedMatches, STARTER_INVESTIGATIONS, STARTER_PANELS, starterPanelTags } from './investigations'
import { STARTER_CONDITIONS } from './tags'

describe('starter investigations', () => {
  const names = STARTER_INVESTIGATIONS.flatMap((g) => g.items.map((i) => i[0]))
  it('has no duplicate names', () => {
    expect(new Set(names).size).toBe(names.length)
  })
  it('every panel item exists in the list', () => {
    for (const p of STARTER_PANELS) for (const item of p.items) expect(names, `${p.name}: ${item}`).toContain(item)
  })
})

describe('categoryOrder', () => {
  it('keeps clinic order and appends new categories alphabetically', () => {
    expect(categoryOrder(['Thyroid', 'Zebra', 'General', 'Growth and GH axis', 'Thyroid', 'Apple'])).toEqual(['Growth and GH axis', 'Thyroid', 'General', 'Apple', 'Zebra'])
  })
})

describe('latestPerTest', () => {
  const r = (test: string, date: string, value: string) => ({ test, result_date: date, value, created_at: date + 'T00:00:00Z' })
  it('returns the newest result per test with the one before it', () => {
    const out = latestPerTest([r('TSH', '2026-01-10', '3.1'), r('IGF-1', '2026-04-07', '142'), r('TSH', '2026-04-08', '2.4'), r('tsh ', '2025-07-01', '4.0')])
    expect(out.map((x) => x.latest.test)).toEqual(['TSH', 'IGF-1'])
    expect(out[0].latest.value).toBe('2.4')
    expect(out[0].previous?.value).toBe('3.1')
    expect(out[1].previous).toBeNull()
  })
})

describe('historyPerTest', () => {
  const r = (test: string, date: string, value: string) => ({ test, result_date: date, value, created_at: date + 'T00:00:00Z' })
  it('groups every result by test, newest first, whatever the capitals', () => {
    const out = historyPerTest([r('TSH', '2026-01-10', '3.1'), r('IGF-1', '2026-04-07', '142'), r('TSH', '2026-04-08', '2.4'), r('tsh ', '2025-07-01', '4.0')])
    expect(out.map((g) => g.test)).toEqual(['TSH', 'IGF-1'])
    expect(out[0].results.map((x) => x.value)).toEqual(['2.4', '3.1', '4.0'])
  })
})

describe('numericValue', () => {
  it('reads plain numbers only', () => {
    expect(numericValue(' 142 ')).toBe(142)
    expect(numericValue('7.25')).toBe(7.25)
    for (const t of ['<0.1', '7y 6m', 'Positive', '', '1,250']) expect(numericValue(t)).toBeNull()
  })
})

describe('panels by condition tag', () => {
  const tags = [{ id: 't1', name: 'Hypothyroidism' }, { id: 't2', name: 'Type 1 diabetes' }, { id: 't3', name: 'Obesity' }]
  const panels = [
    { name: 'Thyroid profile', condition_ids: ['t1'] },
    { name: 'Diabetes review', condition_ids: ['t2'] },
    { name: 'Metabolic', condition_ids: ['t2', 't3'] },
    { name: 'Polyuria', condition_ids: [] },
    { name: 'Orphan', condition_ids: ['deleted-tag'] },
  ]
  const names = (list: { name: string }[]) => list.map((p) => p.name)
  const live = tags.map((t) => t.id)
  it('offers a patient the panels of their tags, then the panels for everyone', () => {
    const s = panelsForPatient(panels, ['t2'], live)
    expect(names(s.matched)).toEqual(['Diabetes review', 'Metabolic'])
    expect(names(s.general)).toEqual(['Polyuria', 'Orphan'])
    expect(names(s.other)).toEqual(['Thyroid profile'])
  })
  it('a patient with no tags gets only the panels for everyone', () => {
    const s = panelsForPatient(panels, [], live)
    expect(s.matched).toEqual([])
    expect(names(s.other)).toEqual(['Thyroid profile', 'Diabetes review', 'Metabolic'])
  })
  it('a panel whose only tag was deleted goes back to being for everyone', () => {
    expect(names(panelsForPatient(panels, ['t1'], live).general)).toContain('Orphan')
  })
  it('ties starter panels to tags by name, whatever the capitals, and only to tags that exist', () => {
    expect(starterPanelTags({ tags: ['Hypothyroidism'] }, [{ id: 'a', name: ' hypothyroidism ' }, { id: 'b', name: 'Rickets' }])).toEqual(['a'])
    expect(starterPanelTags({ tags: ['Turner syndrome'] }, tags)).toEqual([])
    expect(starterPanelTags({ tags: [] }, tags)).toEqual([])
  })
  it('every starter panel names only starter condition tags, and every starter tag has a panel', () => {
    const known = STARTER_CONDITIONS.map((c) => c.name)
    for (const p of STARTER_PANELS) for (const t of p.tags) expect(known, `${p.name}: ${t}`).toContain(t)
    for (const k of known) expect(STARTER_PANELS.some((p) => p.tags.includes(k)), k).toBe(true)
  })
})

describe('rankedMatches', () => {
  const list = ['TSH', 'Free T4', 'Free T3', 'Anti-TPO antibodies', 'Thyroid ultrasound', 'Testosterone (total)']
  it('lists every match, best first', () => {
    expect(rankedMatches(list, 't')).toEqual(['TSH', 'Thyroid ultrasound', 'Testosterone (total)', 'Free T3', 'Free T4', 'Anti-TPO antibodies'])
    expect(rankedMatches(list, 'free')).toEqual(['Free T3', 'Free T4'])
    expect(rankedMatches(list, 'sound')).toEqual(['Thyroid ultrasound'])
  })
  it('is empty for nothing typed or no match, and agrees with bestMatch', () => {
    expect(rankedMatches(list, '  ')).toEqual([])
    expect(rankedMatches(list, 'zzz')).toEqual([])
    expect(bestMatch(list, 'thy')).toBe(rankedMatches(list, 'thy')[0])
  })
})

describe('bestMatch', () => {
  // A fixed list, so the examples do not change when the starter list grows.
  const names = ['25-OH vitamin D', 'Plasma renin activity', 'Bone age X-ray (left hand and wrist)', 'Alkaline phosphatase', '8 am cortisol', 'ACTH', 'ACTH stimulation test', 'TSH', 'Free T4', 'Free T3', 'Thyroid ultrasound']
  it('prefers a word that starts with the typed text', () => {
    expect(bestMatch(names, 'vit')).toBe('25-OH vitamin D')
    expect(bestMatch(names, 'bone')).toBe('Bone age X-ray (left hand and wrist)')
    expect(bestMatch(names, 'cort')).toBe('8 am cortisol')
  })
  it('prefers an exact name over longer ones', () => {
    expect(bestMatch(names, 'acth')).toBe('ACTH')
    expect(bestMatch(names, 'tsh')).toBe('TSH')
    expect(bestMatch(names, 'free t')).toBe('Free T3')
  })
  it('returns null when nothing matches or nothing is typed', () => {
    expect(bestMatch(names, 'urine osmolality')).toBeNull()
    expect(bestMatch(names, '  ')).toBeNull()
  })
})
