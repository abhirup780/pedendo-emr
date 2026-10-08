import { describe, expect, it } from 'vitest'
import { checkReference, findReference, growthPoints, lmsAt, niceAxis, sds, sdsFromLms } from './growth'
import { REFERENCES } from './growth-reference'
import type { ReferenceTable } from './growth-reference'

// A made-up table for testing the mechanics only. Not clinical data.
const toy: ReferenceTable = {
  id: 'toy', label: 'Toy', source: 'test', sex: 'M', measure: 'height', centiles: [3, 50, 97],
  rows: [{ age: 5, values: [100, 110, 120] }, { age: 10, values: [125, 137, 149] }],
  lms: [{ age: 5, L: 1, M: 110, S: 0.05 }, { age: 10, L: 1, M: 140, S: 0.05 }],
}

describe('every reference table added to the app', () => {
  it('is well formed', () => {
    for (const t of REFERENCES) expect(checkReference(t), t.id).toEqual([])
  })
  it('has a unique id', () => {
    expect(new Set(REFERENCES.map((t) => t.id)).size).toBe(REFERENCES.length)
  })
})

describe('checkReference', () => {
  it('accepts a well formed table', () => {
    expect(checkReference(toy)).toEqual([])
  })
  it('reports rows that do not match the centiles or go backwards', () => {
    const bad: ReferenceTable = { ...toy, rows: [{ age: 5, values: [100, 110] }, { age: 4, values: [120, 110, 130] }], lms: undefined }
    const problems = checkReference(bad)
    expect(problems).toContain('age 5: 2 values for 3 centiles')
    expect(problems).toContain('age 4: values do not increase across centiles')
    expect(problems).toContain('age 4: ages are not in increasing order')
  })
})

describe('sdsFromLms', () => {
  it('is 0 at the median and ±1 one S away when L is 1', () => {
    expect(sdsFromLms(110, 1, 110, 0.05)).toBeCloseTo(0, 10)
    expect(sdsFromLms(115.5, 1, 110, 0.05)).toBeCloseTo(1, 10)
    expect(sdsFromLms(104.5, 1, 110, 0.05)).toBeCloseTo(-1, 10)
  })
  it('uses the logarithm when L is 0', () => {
    expect(sdsFromLms(110 * Math.exp(0.1), 0, 110, 0.1)).toBeCloseTo(1, 10)
  })
  it('follows the Box-Cox form for other L', () => {
    expect(sdsFromLms(20, -2, 16, 0.1)).toBeCloseTo((Math.pow(20 / 16, -2) - 1) / (-2 * 0.1), 10)
  })
})

describe('lmsAt and sds', () => {
  it('interpolates between ages', () => {
    expect(lmsAt(toy.lms!, 7.5)).toEqual({ L: 1, M: 125, S: 0.05 })
    expect(lmsAt(toy.lms!, 5)?.M).toBe(110)
    expect(lmsAt(toy.lms!, 10)?.M).toBe(140)
  })
  it('gives nothing outside the table', () => {
    expect(lmsAt(toy.lms!, 4.9)).toBeNull()
    expect(lmsAt(toy.lms!, 10.1)).toBeNull()
  })
  it('computes SDS only when a matching table has LMS', () => {
    expect(sds(125, 'M', 'height', 7.5, [toy])).toBe(0)
    expect(sds(118.75, 'M', 'height', 7.5, [toy])).toBe(-1)
    expect(sds(125, 'F', 'height', 7.5, [toy])).toBeNull()
    expect(sds(125, 'M', 'weight', 7.5, [toy])).toBeNull()
    expect(sds(125, 'M', 'height', 7.5, [{ ...toy, lms: undefined }])).toBeNull()
    expect(sds(125, 'M', 'height', 7.5, [])).toBeNull()
  })
  it('finds the table by sex, measure and age', () => {
    expect(findReference('M', 'height', 9, [toy])?.id).toBe('toy')
    expect(findReference('M', 'height', 12, [toy])).toBeNull()
  })
})

describe('growthPoints', () => {
  const visits = [
    { visit_date: '2026-10-08', height_cm: 121, weight_kg: 24.2 },
    { visit_date: '2026-01-10', height_cm: 114.2, weight_kg: null },
    { visit_date: '2026-07-14', height_cm: null, weight_kg: 23.1 },
  ]
  it('returns points oldest first and skips missing values', () => {
    const h = growthPoints(visits, '2017-05-12', 'height')
    expect(h.map((p) => p.value)).toEqual([114.2, 121])
    expect(h[0].age).toBeCloseTo(8.67, 2)
    expect(growthPoints(visits, '2017-05-12', 'weight').map((p) => p.date)).toEqual(['2026-07-14', '2026-10-08'])
    expect(growthPoints(visits, '2017-05-12', 'bmi').map((p) => p.value)).toEqual([16.5])
  })
})

describe('niceAxis', () => {
  it('encloses the data with round limits', () => {
    expect(niceAxis(110, 121)).toEqual({ min: 110, max: 122, step: 2 })
    expect(niceAxis(18.9, 24.2)).toEqual({ min: 18, max: 25, step: 1 })
    expect(niceAxis(7.7, 9.4, 5)).toEqual({ min: 7.5, max: 9.5, step: 0.5 })
  })
  it('copes with a single value', () => {
    const a = niceAxis(121, 121)
    expect(a.min).toBeLessThan(121)
    expect(a.max).toBeGreaterThan(121)
  })
})
