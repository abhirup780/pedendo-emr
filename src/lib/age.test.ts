import { describe, expect, it } from 'vitest'
import { ageParts, decimalAge, formatAge, midParentalHeight, parseISODate } from './age'

describe('age', () => {
  it('counts completed years and months', () => {
    expect(ageParts('2017-05-12', '2026-10-08')).toEqual({ years: 9, months: 4 })
    expect(ageParts('2017-05-12', '2026-01-10')).toEqual({ years: 8, months: 7 })
    expect(ageParts('2017-05-12', '2026-05-11')).toEqual({ years: 8, months: 11 })
    expect(ageParts('2017-05-12', '2026-05-12')).toEqual({ years: 9, months: 0 })
  })
  it('formats infants in months and newborns in days', () => {
    expect(formatAge('2026-03-01', '2026-10-08')).toBe('7m')
    expect(formatAge('2026-09-26', '2026-10-08')).toBe('12d')
    expect(formatAge('2017-05-12', '2026-10-08')).toBe('9y 4m')
  })
  it('rejects impossible and future dates', () => {
    expect(parseISODate('2026-02-30')).toBeNull()
    expect(ageParts('2027-01-01', '2026-10-08')).toBeNull()
    expect(formatAge('nonsense', '2026-10-08')).toBe('—')
  })
  it('gives decimal age', () => {
    expect(decimalAge('2017-05-12', '2026-10-08')).toBeCloseTo(9.41, 2)
  })
  it('computes mid-parental height by sex', () => {
    expect(midParentalHeight(168, 155, 'M')).toBe(168)
    expect(midParentalHeight(168, 155, 'F')).toBe(155)
    expect(midParentalHeight(null, 155, 'M')).toBeNull()
  })
})
