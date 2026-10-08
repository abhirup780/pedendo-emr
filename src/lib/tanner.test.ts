import { describe, expect, it } from 'vitest'
import { EMPTY_TANNER, isBlank, pubertyFlag, pubertyStarted, tannerSummary } from './tanner'

const t = (o: object) => ({ ...EMPTY_TANNER, ...o })

describe('tannerSummary', () => {
  it('describes a boy', () => {
    expect(tannerSummary(t({ g: 1, p: 1, testis_r: 3, testis_l: 3 }), 'M')).toBe('G1 P1 · testes R 3 mL, L 3 mL')
    expect(tannerSummary(t({ testis_r: 4 }), 'M')).toBe('testes R 4 mL, L — mL')
  })
  it('describes a girl and ignores male fields', () => {
    expect(tannerSummary(t({ b: 2, p: 1, g: 3, testis_r: 5 }), 'F')).toBe('B2 P1')
    expect(tannerSummary(t({ b: 4, p: 4, signs: ['Menarche'] }), 'F')).toBe('B4 P4 · menarche attained')
  })
  it('is empty when nothing is staged', () => {
    expect(tannerSummary(null, 'M')).toBe('')
    expect(tannerSummary(EMPTY_TANNER, 'F')).toBe('')
    expect(isBlank(t({ signs: ['Acne'] }))).toBe(false)
  })
})

describe('pubertyStarted', () => {
  it('uses testicular volume of 4 mL or genital stage 2 in boys', () => {
    expect(pubertyStarted(t({ g: 1, testis_r: 3, testis_l: 3 }), 'M')).toBe(false)
    expect(pubertyStarted(t({ g: 1, testis_r: 4, testis_l: 3 }), 'M')).toBe(true)
    expect(pubertyStarted(t({ g: 2 }), 'M')).toBe(true)
  })
  it('uses breast stage 2 in girls', () => {
    expect(pubertyStarted(t({ b: 1 }), 'F')).toBe(false)
    expect(pubertyStarted(t({ b: 2 }), 'F')).toBe(true)
  })
  it('does not decide from pubic hair alone', () => {
    expect(pubertyStarted(t({ p: 3 }), 'M')).toBeNull()
    expect(pubertyStarted(t({ p: 3 }), 'F')).toBeNull()
  })
})

describe('pubertyFlag', () => {
  it('flags early onset', () => {
    expect(pubertyFlag(t({ b: 2 }), 'F', 7.6)?.alert).toBe(true)
    expect(pubertyFlag(t({ testis_r: 4 }), 'M', 8.9)?.alert).toBe(true)
  })
  it('flags no onset by the upper limit', () => {
    expect(pubertyFlag(t({ b: 1 }), 'F', 13)?.alert).toBe(true)
    expect(pubertyFlag(t({ g: 1, testis_r: 3 }), 'M', 14.2)?.alert).toBe(true)
  })
  it('stays quiet inside the usual range', () => {
    expect(pubertyFlag(t({ g: 1, testis_r: 3 }), 'M', 9.4)).toEqual({ alert: false, text: 'Prepubertal, within the usual age range.' })
    expect(pubertyFlag(t({ b: 2 }), 'F', 8)?.alert).toBe(false)
    expect(pubertyFlag(t({ g: 2 }), 'M', 13.9)?.alert).toBe(false)
  })
  it('says nothing without the deciding sign or the age', () => {
    expect(pubertyFlag(t({ p: 2 }), 'F', 7)).toBeNull()
    expect(pubertyFlag(t({ b: 2 }), 'F', null)).toBeNull()
  })
})
