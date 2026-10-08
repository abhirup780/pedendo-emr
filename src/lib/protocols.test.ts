import { describe, expect, it } from 'vitest'
import { cite, doseGuides, PROTOCOLS, protocolsByName, protocolsForTags } from './protocols'

const tag = (name: string, protocols: string[] = []) => ({ name, protocols })
const keys = (list: { key: string }[]) => list.map((p) => p.key)

describe('every protocol in the app', () => {
  it('has a unique key, sources, and cites only its own sources', () => {
    expect(new Set(keys(PROTOCOLS)).size).toBe(PROTOCOLS.length)
    for (const p of PROTOCOLS) {
      expect(p.sources.length, p.key).toBeGreaterThan(0)
      const ids = new Set(p.sources.map((s) => s.id))
      const cited = [...p.sets.flatMap((s) => s.items.flatMap((i) => i.sources)), ...p.medicines.flatMap((m) => m.sources), ...p.advice.flatMap((a) => a.sources)]
      expect(cited.every((id) => ids.has(id)), p.key).toBe(true)
      for (const s of p.sources) expect(s.url, `${p.key} ${s.id}`).toMatch(/^https:\/\//)
    }
  })
  it('never carries a dose onto the prescription, and shows a guide only for a sourced dose', () => {
    for (const p of PROTOCOLS)
      for (const m of p.medicines) {
        expect(m.rx.dose, `${p.key} ${m.generic}`).toBe('')
        expect(m.rx.name.toLowerCase().startsWith(m.generic.toLowerCase().replace(/\s*\(.*\)$/, '')), m.rx.name).toBe(true)
        if (!m.verified) {
          expect(m.doseGuide, `${p.key} ${m.generic}`).toBe('')
          expect(m.max).toBe('')
        } else {
          expect(m.quote.length, `${p.key} ${m.generic} needs its supporting quote`).toBeGreaterThan(10)
          expect(m.sources.length).toBeGreaterThan(0)
        }
      }
  })
  it('every investigation set has a name, a timing and at least one test', () => {
    for (const p of PROTOCOLS)
      for (const s of p.sets) {
        expect(s.name && s.when, `${p.key} ${s.name}`).toBeTruthy()
        expect(s.items.length).toBeGreaterThan(0)
        expect(new Set(s.items.map((i) => i.test)).size, `${p.key} ${s.name} repeats a test`).toBe(s.items.length)
      }
  })
})

describe('linking tags to protocols', () => {
  it('matches a tag by its name or an alias, whatever the capitals', () => {
    expect(keys(protocolsByName('Hypothyroidism'))).toEqual(['congenital-hypothyroidism', 'acquired-hypothyroidism'])
    expect(keys(protocolsByName('  graves DISEASE '))).toEqual(['graves-disease-hyperthyroidism'])
    expect(keys(protocolsByName('Congenital hypothyroidism'))).toEqual(['congenital-hypothyroidism'])
    expect(protocolsByName('Rickets')).toEqual([])
    expect(protocolsByName('Hypo')).toEqual([])
  })
  it('uses the protocols chosen for a tag in place of the name match', () => {
    expect(keys(protocolsForTags([tag('Hypothyroidism', ['acquired-hypothyroidism'])]))).toEqual(['acquired-hypothyroidism'])
    expect(keys(protocolsForTags([tag('My thyroid clinic', ['graves-disease-hyperthyroidism'])]))).toEqual(['graves-disease-hyperthyroidism'])
  })
  it('falls back to the name when the chosen keys no longer exist, and never repeats a protocol', () => {
    expect(keys(protocolsForTags([tag('Hypothyroidism', ['gone'])]))).toEqual(['congenital-hypothyroidism', 'acquired-hypothyroidism'])
    expect(keys(protocolsForTags([tag('Hypothyroidism'), tag('CH'), tag('Short stature')]))).toEqual(['congenital-hypothyroidism', 'acquired-hypothyroidism'])
    expect(protocolsForTags([])).toEqual([])
  })
})

describe('dose guides', () => {
  const hypo = protocolsForTags([tag('Hypothyroidism')])
  const graves = protocolsForTags([tag('Graves disease')])
  it('finds the guide by the generic name at the start of the medicine name', () => {
    const g = doseGuides('Levothyroxine tablet 50 mcg', hypo)
    expect(g.map((x) => x.protocol)).toEqual(['Congenital hypothyroidism', 'Acquired hypothyroidism'])
    expect(g[0].text).toContain('10-15 mcg/kg')
    expect(g[1].text).toContain('3-5 mcg/kg')
    expect(g[0].source).toContain('ISPAE 2018')
    expect(g[0].source).not.toContain('Medindia')
    expect(doseGuides('levothyroxine', hypo).length).toBe(2)
    expect(doseGuides('Methimazole tablet', graves).length).toBe(1)
  })
  it('says nothing for other medicines, other patients, or look-alike names', () => {
    expect(doseGuides('Metformin 500 mg tablet', hypo)).toEqual([])
    expect(doseGuides('Levothyroxine tablet', graves)).toEqual([])
    expect(doseGuides('Levo', hypo)).toEqual([])
    expect(doseGuides('', hypo)).toEqual([])
  })
  it('carries no dose text for a medicine whose dose was not read from a source', () => {
    const g = doseGuides('Propranolol tablet', graves)
    expect(g.length).toBe(1)
    expect(g[0].verified).toBe(false)
    expect(g[0].text).toBe('')
    expect(g[0].prescriberNote).toContain('asthma')
  })
  it('cites by organisation and year without repeats', () => {
    const p = PROTOCOLS.find((x) => x.key === 'congenital-hypothyroidism')!
    expect(cite(p, ['S1', 'S2', 'S3'])).toBe('ISPAE 2018, IAP 2022')
  })
})
