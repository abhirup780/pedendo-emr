import { describe, expect, it } from 'vitest'
import { bmiBand, bmiExact, chartReference, growthPoints, niceAxis, sds, sdsExact, sdsFromLms, valueFromLms, visitSds } from './growth'
import { iapAt, whoHeightAt } from './growth-reference'

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
  it('and valueFromLms undoes it', () => {
    for (const [L, M, S] of [[1, 110, 0.05], [0, 30, 0.2], [-1.9, 14.2, 0.1], [2.9, 170, 0.04]])
      for (const z of [-3, -2, -0.67, 0, 1.34, 2, 3]) expect(sdsFromLms(valueFromLms(z, L, M, S), L, M, S)).toBeCloseTo(z, 9)
  })
})

describe('sds', () => {
  it('is 0 for a child at the published median, on either reference', () => {
    expect(sds(whoHeightAt('F', 400)!.M, 'F', 'height', 400)).toBe(0)
    const days = Math.round(9 * 365.25)
    expect(sds(iapAt('M', 'height', days / 365.25)!.M, 'M', 'height', days)).toBe(0)
    expect(sds(iapAt('F', 'weight', days / 365.25)!.M, 'F', 'weight', days)).toBe(0)
  })
  it('is rounded to two decimals; sdsExact is not', () => {
    const z = sdsExact(120, 'M', 'height', 3000)!
    expect(sds(120, 'M', 'height', 3000)).toBe(Math.round(z * 100) / 100)
    expect(z).not.toBe(sds(120, 'M', 'height', 3000))
  })
  it('is null where there is no reference, and for values that cannot be', () => {
    expect(sds(15, 'M', 'weight', 1000)).toBeNull()
    expect(sds(170, 'M', 'height', 7000)).toBeNull()
    expect(sds(170, 'M', 'height', 6575)).not.toBeNull()
    expect(sds(170, 'M', 'height', 6576)).toBeNull()
    expect(sds(0, 'M', 'height', 3000)).toBeNull()
    expect(sds(-5, 'M', 'height', 3000)).toBeNull()
  })
  it('falls as a child of the same height gets older', () => {
    expect(sds(120, 'M', 'height', 2600)!).toBeGreaterThan(sds(120, 'M', 'height', 2700)!)
  })
})

describe('visitSds and BMI', () => {
  it('gives all three SDS for a visit, each only where a reference applies', () => {
    const z = visitSds({ visit_date: '2026-10-08', height_cm: 121, weight_kg: 24.2 }, '2017-05-12', 'M')
    expect(z.height).not.toBeNull()
    expect(z.weight).not.toBeNull()
    expect(z.bmi).not.toBeNull()
    const infant = visitSds({ visit_date: '2026-10-08', height_cm: 70, weight_kg: 8 }, '2026-01-08', 'F')
    expect(infant.height).not.toBeNull()
    expect(infant.weight).toBeNull()
    expect(infant.bmi).toBeNull()
    expect(visitSds({ visit_date: '2026-10-08', height_cm: null, weight_kg: 24 }, '2017-05-12', 'M')).toMatchObject({ height: null, bmi: null })
  })
  it('gives no SDS while sex is not assigned', () => {
    expect(visitSds({ visit_date: '2026-10-08', height_cm: 121, weight_kg: 24.2 }, '2017-05-12', 'U')).toEqual({ height: null, weight: null, bmi: null })
    expect(growthPoints([{ visit_date: '2026-10-08', height_cm: 121, weight_kg: 24.2 }], '2017-05-12', 'height', null)[0].sds).toBeNull()
  })
  it('works BMI SDS from the unrounded BMI', () => {
    expect(bmiExact(121, 24.2)).toBeCloseTo(16.529, 3)
    expect(bmiExact(null, 24.2)).toBeNull()
    const days = 3436
    const at = iapAt('M', 'bmi', days / 365.25)!
    expect(visitSds({ visit_date: '2026-10-08', height_cm: 121, weight_kg: 24.2 }, '2017-05-12', 'M').bmi).toBe(Math.round(sdsFromLms(bmiExact(121, 24.2)!, at.L, at.M, at.S) * 100) / 100)
  })
  it('names the BMI ranges by the lines printed in the IAP paper', () => {
    // Boys, 8.0 years (2922 days): printed 3rd 12.5, overweight 16.7, obese 18.8.
    expect(bmiBand(16.69, 'M', 2922)).toBeNull()
    expect(bmiBand(16.7, 'M', 2922)).toBe('overweight range')
    expect(bmiBand(18.79, 'M', 2922)).toBe('overweight range')
    expect(bmiBand(18.8, 'M', 2922)).toBe('obese range')
    expect(bmiBand(12.49, 'M', 2922)).toBe('below the 3rd centile')
    expect(bmiBand(12.5, 'M', 2922)).toBeNull()
    // Girls at the same age have their own lines: overweight 16.9, obese 20.1.
    expect(bmiBand(16.8, 'F', 2922)).toBeNull()
    expect(bmiBand(19, 'F', 2922)).toBe('overweight range')
    expect(bmiBand(20.1, 'F', 2922)).toBe('obese range')
  })
  it('between half years reads the line in proportion, and says nothing outside 5 to 18 years', () => {
    // Boys 8.25 years (3013 days is 8.249 y): overweight line between 16.7 and 17.0.
    expect(bmiBand(16.84, 'M', 3013)).toBeNull()
    expect(bmiBand(16.86, 'M', 3013)).toBe('overweight range')
    expect(bmiBand(30, 'M', 1500)).toBeNull()
    expect(bmiBand(30, 'M', 6576)).toBeNull()
    expect(bmiBand(30, 'M', 6575)).toBe('obese range')
    expect(bmiBand(0, 'M', 2922)).toBeNull()
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
    expect(h[1].ageDays).toBe(3436)
    expect(h[1].sds).toBeNull()
    expect(growthPoints(visits, '2017-05-12', 'weight').map((p) => p.date)).toEqual(['2026-07-14', '2026-10-08'])
    expect(growthPoints(visits, '2017-05-12', 'bmi').map((p) => p.value)).toEqual([16.5])
  })
  it('adds the SDS when the sex is given', () => {
    const h = growthPoints(visits, '2017-05-12', 'height', 'M')
    expect(h[1].sds).toBe(sds(121, 'M', 'height', 3436))
    expect(h[1].sds).not.toBeNull()
    expect(h[1].raw).toBe(121)
    expect(growthPoints(visits, '2017-05-12', 'bmi', 'M')[0].raw).toBeCloseTo(16.529, 3)
  })
})

describe('chartReference', () => {
  it('has nothing to draw without points or outside the references', () => {
    expect(chartReference('M', 'height', [])).toBeNull()
    expect(chartReference('M', 'height', [18.5, 19])).toBeNull()
    expect(chartReference('M', 'weight', [1, 3])).toBeNull()
  })
  it('an infant gets the WHO chart to 2 years, in whole SDs, length only', () => {
    const c = chartReference('F', 'height', [0.3, 0.9])!
    expect([c.from, c.to]).toEqual([0, 2])
    expect(c.refs).toEqual(['who2006'])
    expect(c.lines.map((l) => l.z)).toEqual([-3, -2, -1, 0, 1, 2, 3])
    expect(c.segments.map((s) => s.posture)).toEqual(['length'])
    expect(c.segments[0].ages[0]).toBe(0)
    expect(c.segments[0].ages.at(-1)).toBeCloseTo(730 / 365.25, 9)
    expect(c.segments[0].values[3][0]).toBe(whoHeightAt('F', 0)!.M)
  })
  it('a child under 5 gets WHO to 5 years, with length and height as separate lines', () => {
    const c = chartReference('M', 'height', [1.5, 3.2])!
    expect([c.from, c.to]).toEqual([0, 5])
    expect(c.segments.map((s) => s.posture)).toEqual(['length', 'height'])
    expect(c.segments[1].ages[0]).toBeCloseTo(731 / 365.25, 9)
    expect(c.segments[1].ages.at(-1)).toBeCloseTo(1826 / 365.25, 9)
  })
  it('from 5 years gets the IAP chart with its own seven lines', () => {
    const c = chartReference('M', 'height', [8.7, 9.4])!
    expect([c.from, c.to]).toEqual([5, 18])
    expect(c.refs).toEqual(['iap2015'])
    expect(c.lines.map((l) => l.label)).toEqual(['3', '10', '25', '50', '75', '90', '97'])
    expect(c.segments.length).toBe(1)
    expect(c.segments[0].ages.length).toBe(157)
    expect(c.segments[0].values[3][0]).toBeCloseTo(iapAt('M', 'height', 5)!.M, 9)
    expect(c.segments[0].values[3].at(-1)).toBeCloseTo(iapAt('M', 'height', 18)!.M, 9)
  })
  it('seen on both sides of 5 years: one chart, three separate parts, the same lines throughout', () => {
    const c = chartReference('F', 'height', [3.5, 6.2])!
    expect([c.from, c.to]).toEqual([0, 18])
    expect(c.refs).toEqual(['who2006', 'iap2015'])
    expect(c.segments.map((s) => s.ref)).toEqual(['who2006', 'who2006', 'iap2015'])
    expect(c.lines.map((l) => l.label)).toEqual(['3', '10', '25', '50', '75', '90', '97'])
    for (const s of c.segments) {
      expect(s.values.length).toBe(7)
      expect(s.values.every((v) => v.length === s.ages.length)).toBe(true)
      expect(s.ages.every((a, i) => i === 0 || a > s.ages[i - 1])).toBe(true)
    }
  })
  it('weight and BMI: IAP from 5 years, and room on the axis for earlier or later points', () => {
    expect(chartReference('M', 'weight', [3.2, 7])).toMatchObject({ from: 3, to: 18, refs: ['iap2015'] })
    const b = chartReference('F', 'bmi', [12, 18.6])!
    expect(b.to).toBe(19)
    expect(b.lines.map((l) => l.label)).toEqual(['3', '5', '10', '25', '50', 'OW', 'OB'])
    // The BMI lines are the paper's printed values, half-yearly: boys at 5.0 and 18.0 years.
    const boys = chartReference('M', 'bmi', [9])!
    expect(boys.segments[0].ages.length).toBe(27)
    expect(boys.segments[0].values.map((v) => v[0])).toEqual([12.1, 12.4, 12.8, 13.6, 14.7, 15.7, 17.5])
    expect(boys.segments[0].values.map((v) => v.at(-1))).toEqual([15.6, 16.2, 17.1, 18.9, 21.1, 23.2, 26.6])
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
