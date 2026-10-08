import { describe, expect, it } from 'vitest'
import { autoSlash, monthCells, parseTyped, shiftDays, showDate } from './dateinput'

describe('showDate', () => {
  it('shows day first', () => {
    expect(showDate('2026-10-08')).toBe('08/10/2026')
    expect(showDate('')).toBe('')
    expect(showDate('rubbish')).toBe('')
  })
})

describe('parseTyped', () => {
  const T = '2026-10-08'
  it('reads day, month, year in the usual ways of writing it', () => {
    for (const text of ['8/10/2026', '08/10/2026', '8-10-2026', '8.10.2026', '8 10 2026', '08102026', '8/10/26', '8 Oct 2026', '8 october 2026', '08-Oct-26', '8oct2026', '2026-10-08'])
      expect(parseTyped(text, T), text).toBe('2026-10-08')
  })
  it('never reads the month first', () => {
    expect(parseTyped('10/8/2026', T)).toBe('2026-08-10')
    expect(parseTyped('13/01/2026', T)).toBe('2026-01-13')
    expect(parseTyped('01/13/2026', T)).toBeNull()
  })
  it('takes a two-digit year as this century unless that would be the future', () => {
    expect(parseTyped('12/05/17', T)).toBe('2017-05-12')
    expect(parseTyped('1/1/27', T)).toBe('2027-01-01')
    expect(parseTyped('1/1/28', T)).toBe('1928-01-01')
    expect(parseTyped('1/1/99', T)).toBe('1999-01-01')
  })
  it('refuses dates that do not exist and half-typed text', () => {
    for (const text of ['31/02/2026', '29/02/2025', '0/10/2026', '8/13/2026', '8/10', '8/10/202', 'tomorrow', '8 Xyz 2026', '', '  ', '08/10/1850'])
      expect(parseTyped(text, T), text).toBeNull()
    expect(parseTyped('29/02/2024', T)).toBe('2024-02-29')
  })
})

describe('autoSlash', () => {
  it('adds the slashes as digits are typed', () => {
    expect(autoSlash('0', '')).toBe('0')
    expect(autoSlash('08', '0')).toBe('08/')
    expect(autoSlash('08/1', '08/')).toBe('08/1')
    expect(autoSlash('08/10', '08/1')).toBe('08/10/')
    expect(autoSlash('08/10/2026', '08/10/202')).toBe('08/10/2026')
    expect(autoSlash('08102026', '')).toBe('08/10/2026')
  })
  it('stays out of the way when deleting or typing another style', () => {
    expect(autoSlash('08', '08/')).toBe('08')
    expect(autoSlash('8/1', '8/')).toBe('8/1')
    expect(autoSlash('8 Oct', '8 Oc')).toBe('8 Oct')
    expect(autoSlash('2026-10', '2026-1')).toBe('2026-10')
  })
})

describe('monthCells and shiftDays', () => {
  it('lays a month out in six weeks from Monday', () => {
    const c = monthCells(2026, 10)
    expect(c.length).toBe(42)
    // 1 October 2026 is a Thursday.
    expect(c[0].iso).toBe('2026-09-28')
    expect(c[3]).toEqual({ iso: '2026-10-01', day: 1, inMonth: true })
    expect(c.filter((x) => x.inMonth).length).toBe(31)
    expect(c[41].iso).toBe('2026-11-08')
    expect(monthCells(2024, 2).filter((x) => x.inMonth).length).toBe(29)
  })
  it('moves by days across months and years', () => {
    expect(shiftDays('2026-10-08', 7)).toBe('2026-10-15')
    expect(shiftDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(shiftDays('2024-03-01', -1)).toBe('2024-02-29')
  })
})
