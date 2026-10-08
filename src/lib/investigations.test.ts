import { describe, expect, it } from 'vitest'
import { bestMatch, categoryOrder, latestPerTest, STARTER_INVESTIGATIONS, STARTER_PANELS } from './investigations'

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

describe('bestMatch', () => {
  const names = STARTER_INVESTIGATIONS.flatMap((g) => g.items.map((i) => i[0]))
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
