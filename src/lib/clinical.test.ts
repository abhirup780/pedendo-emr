import { describe, expect, it } from 'vitest'
import { addMonths, bmi, dosePerKg, heightVelocity, rxLine, validBp } from './clinical'

describe('bmi', () => {
  it('rounds to one decimal', () => {
    expect(bmi(121, 24.2)).toBe(16.5)
    expect(bmi(110, 18.9)).toBe(15.6)
  })
  it('needs both values', () => {
    expect(bmi(null, 20)).toBeNull()
    expect(bmi(120, 0)).toBeNull()
  })
})

describe('heightVelocity', () => {
  const earlier = [
    { visit_date: '2026-07-14', height_cm: 118.7 },
    { visit_date: '2026-04-08', height_cm: 116.3 },
    { visit_date: '2026-01-10', height_cm: 114.2 },
  ]
  it('uses the most recent height at least about 3 months old', () => {
    const v = heightVelocity(121, '2026-10-08', earlier)
    expect(v?.fromDate).toBe('2026-07-14')
    expect(v?.days).toBe(86)
    expect(v?.cmPerYear).toBe(9.8)
  })
  it('skips measurements that are too recent', () => {
    const v = heightVelocity(119.5, '2026-08-20', earlier)
    expect(v?.fromDate).toBe('2026-04-08')
    expect(v?.cmPerYear).toBeCloseTo(8.7, 1)
  })
  it('gives nothing without a usable earlier height', () => {
    expect(heightVelocity(121, '2026-10-08', [{ visit_date: '2026-09-20', height_cm: 120.5 }])).toBeNull()
    expect(heightVelocity(121, '2026-10-08', [{ visit_date: '2026-01-10', height_cm: null }])).toBeNull()
    expect(heightVelocity(null, '2026-10-08', earlier)).toBeNull()
  })
})

describe('dosePerKg', () => {
  it('reads a number and a unit', () => {
    expect(dosePerKg('0.7 mg', 24.2)).toBe('0.029 mg/kg')
    expect(dosePerKg('25 mcg', 20)).toBe('1.3 mcg/kg')
    expect(dosePerKg('500mg', 25)).toBe('20 mg/kg')
    expect(dosePerKg('6 units', 30)).toBe('0.20 units/kg')
  })
  it('refuses what it cannot read confidently', () => {
    expect(dosePerKg('1 sachet', 24)).toBeNull()
    expect(dosePerKg('5-10 mg', 24)).toBeNull()
    expect(dosePerKg('0.7 mg', null)).toBeNull()
    expect(dosePerKg('', 24)).toBeNull()
  })
})

describe('validBp', () => {
  it('accepts systolic over diastolic', () => {
    expect(validBp('102/68')).toBe(true)
    expect(validBp(' 110 / 70 ')).toBe(true)
    expect(validBp('')).toBe(true)
  })
  it('rejects malformed or implausible readings', () => {
    expect(validBp('102')).toBe(false)
    expect(validBp('68/102')).toBe(false)
    expect(validBp('abc')).toBe(false)
  })
})

describe('addMonths', () => {
  it('adds calendar months', () => {
    expect(addMonths('2026-10-08', 3)).toBe('2027-01-08')
    expect(addMonths('2026-10-08', 6)).toBe('2027-04-08')
  })
  it('clamps to the end of a shorter month', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonths('2027-11-30', 3)).toBe('2028-02-29')
  })
})

describe('rxLine', () => {
  it('builds printed directions', () => {
    expect(rxLine({ dose: '0.7 mg', route: 'Subcutaneous', frequency: 'Once daily at bedtime', duration: 'Continue' })).toBe('0.7 mg subcutaneous once daily at bedtime, continue')
    expect(rxLine({ dose: '1 sachet', route: 'Oral', frequency: 'Once weekly', duration: '8 weeks' })).toBe('1 sachet oral once weekly, for 8 weeks')
    expect(rxLine({ dose: '', route: '', frequency: '', duration: '' })).toBe('')
  })
})
