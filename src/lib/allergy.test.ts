import { describe, expect, it } from 'vitest'
import { allergyStatus, NO_KNOWN_ALLERGY } from './allergy'

describe('allergyStatus', () => {
  it('reads a blank box as not recorded, never as none', () => {
    expect(allergyStatus('')).toBe('unrecorded')
    expect(allergyStatus('   ')).toBe('unrecorded')
  })
  it('knows the stored "none known" sentence and the usual ways of typing it', () => {
    expect(allergyStatus(NO_KNOWN_ALLERGY)).toBe('none')
    for (const t of ['NKDA', 'nil', 'None.', ' none  known ', 'No known allergies']) expect(allergyStatus(t)).toBe('none')
  })
  it('reads "unknown" and the like as not recorded, not as none and not as an allergy', () => {
    for (const t of ['Unknown', 'not known', 'N/A', 'NA', '-', '?']) expect(allergyStatus(t)).toBe('unrecorded')
  })
  it('treats anything else as an allergy', () => {
    expect(allergyStatus('Penicillin')).toBe('some')
    expect(allergyStatus('No penicillin')).toBe('some')
    expect(allergyStatus('None to drugs; egg')).toBe('some')
  })
})
