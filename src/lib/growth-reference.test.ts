import { describe, expect, it } from 'vitest'
import { sdsFromLms, valueFromLms } from './growth'
import { IAP_BMI_PRINTED, IAP_LMS, WHO_LHFA } from './growth-data'
import { BMI_LINE, IAP_BMI_LINES, IAP_HEIGHT_WEIGHT_LINES, iapAt, iapBmiPrintedAt, referenceAt, WHO_SD_LINES, whoHeightAt } from './growth-reference'
import type { Measure } from './growth-reference'
import type { RefSex as Sex } from './types'
import { ageInDays } from './age'
import iapLmsCsv from '../../reference-data/iap2015-lms.csv?raw'
import iapPaperCsv from '../../reference-data/iap2015-paper-tables.csv?raw'
import whoBoysCsv from '../../reference-data/who2006-lhfa-boys.csv?raw'
import whoGirlsCsv from '../../reference-data/who2006-lhfa-girls.csv?raw'

/**
 * These tests read the published tables in reference-data/ directly and hold the app to them,
 * number by number. They are the proof that what the screen shows is what was published.
 */
const text = (file: string): Record<string, string>[] => {
  const [head, ...lines] = file.trim().split('\n')
  const cols = head.split(',')
  return lines.map((line) => Object.fromEntries(line.split(',').map((cell, i) => [cols[i], cell])))
}
const csv = (file: string): Record<string, number>[] => text(file).map((row) => Object.fromEntries(Object.entries(row).map(([k, v]) => [k, Number(v)])))
const WHO = { boys: whoBoysCsv, girls: whoGirlsCsv }
const SEXES: [Sex, 'boys' | 'girls'][] = [['M', 'boys'], ['F', 'girls']]
const MEASURES: Measure[] = ['height', 'weight', 'bmi']
/** SDS of the exact 3rd centile of a normal distribution. */
const Z3 = -1.8807936

/** Normal distribution function (Abramowitz and Stegun 7.1.26, error below 1.5e-7). */
function phi(z: number): number {
  const t = 1 / (1 + 0.3275911 * (Math.abs(z) / Math.SQRT2))
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(z * z) / 2)
  return 0.5 * (1 + Math.sign(z) * y)
}

describe('WHO 2006 length/height-for-age, birth to 5 years', () => {
  for (const [sex, name] of SEXES) {
    const table = csv(WHO[name])

    it(`${name}: holds every published day, 0 to 1856, with M and S unchanged`, () => {
      expect(table.length).toBe(1857)
      expect(WHO_LHFA[sex].M.length).toBe(1857)
      table.forEach((row, day) => {
        expect(row.Day).toBe(day)
        expect(row.L).toBe(1)
        expect(whoHeightAt(sex, day)).toMatchObject({ L: 1, M: row.M, S: row.S, ref: 'who2006' })
      })
    })

    it(`${name}: reproduces all nine published SD columns on every day`, () => {
      // WHO prints the columns to 0.001 cm. 1857 days x 9 columns, none further off than that rounding.
      let worst = 0
      for (const row of table) {
        const at = whoHeightAt(sex, row.Day)!
        const published = [row.SD4neg, row.SD3neg, row.SD2neg, row.SD1neg, row.SD0, row.SD1, row.SD2, row.SD3, row.SD4]
        published.forEach((cm, i) => {
          worst = Math.max(worst, Math.abs(valueFromLms(i - 4, at.L, at.M, at.S) - cm))
        })
      }
      expect(worst).toBeLessThan(0.00051)
    })

    it(`${name}: a child on a published line gets that SDS`, () => {
      for (const day of [0, 1, 91, 365, 730, 731, 1095, 1826]) {
        const row = table[day]
        expect(referenceAt(sex, 'height', day)).not.toBeNull()
        const at = referenceAt(sex, 'height', day)!
        expect(sdsFromLms(row.SD2neg, at.L, at.M, at.S)).toBeCloseTo(-2, 2)
        expect(sdsFromLms(row.SD0, at.L, at.M, at.S)).toBeCloseTo(0, 2)
        expect(sdsFromLms(row.SD3, at.L, at.M, at.S)).toBeCloseTo(3, 2)
      }
    })

    it(`${name}: keeps the drop from length to height at 2 years`, () => {
      expect(whoHeightAt(sex, 730)!.posture).toBe('length')
      expect(whoHeightAt(sex, 731)!.posture).toBe('height')
      // Children grow about 0.03 cm a day at this age; the table falls by about 0.67 cm overnight.
      expect(table[730].M - table[731].M).toBeGreaterThan(0.6)
      expect(whoHeightAt(sex, 730)!.M - whoHeightAt(sex, 731)!.M).toBeCloseTo(table[730].M - table[731].M, 10)
    })
  }

  it('is only looked up on whole days inside the table', () => {
    expect(whoHeightAt('M', -1)).toBeNull()
    expect(whoHeightAt('M', 365.5)).toBeNull()
    expect(whoHeightAt('M', 1857)).toBeNull()
  })
})

describe('IAP 2015, 5 to 18 years', () => {
  const table = csv(iapLmsCsv)

  it('holds every month from 5 to 18 years with L, M and S unchanged', () => {
    expect(table.length).toBe(157)
    table.forEach((row, i) => {
      expect(row.age_months).toBe(60 + i)
      // The workbook prints ages to three decimals (5.083 for 5 years 1 month).
      expect(Math.abs(row.age_years_printed - row.age_months / 12)).toBeLessThan(0.00051)
      for (const [sex, name] of SEXES)
        for (const m of MEASURES) {
          expect(IAP_LMS[m][sex].L[i]).toBe(row[`${m}_${name}_L`])
          expect(IAP_LMS[m][sex].M[i]).toBe(row[`${m}_${name}_M`])
          expect(IAP_LMS[m][sex].S[i]).toBe(row[`${m}_${name}_S`])
          expect(row[`${m}_${name}_M`]).toBeGreaterThan(0)
          expect(row[`${m}_${name}_S`]).toBeGreaterThan(0)
        }
    })
  })

  it('at a whole month gives exactly the SDS of the IAP calculator formula', () => {
    // The calculator: ((value / M) ^ L − 1) / (L × S), with L, M and S from that month's row.
    for (const months of [60, 61, 100, 144, 215, 216]) {
      const row = table[months - 60]
      for (const [sex, name] of SEXES)
        for (const m of MEASURES) {
          const [L, M, S] = [row[`${m}_${name}_L`], row[`${m}_${name}_M`], row[`${m}_${name}_S`]]
          const at = iapAt(sex, m, months / 12)!
          expect(at).toMatchObject({ ref: 'iap2015' })
          expect(at.L).toBeCloseTo(L, 9)
          expect(at.M).toBeCloseTo(M, 9)
          expect(at.S).toBeCloseTo(S, 9)
          const value = M * 0.9
          expect(sdsFromLms(value, at.L, at.M, at.S)).toBeCloseTo((Math.pow(value / M, L) - 1) / (L * S), 8)
        }
    }
  })

  it('between two months lies in proportion between them', () => {
    const a = table[24]
    const b = table[25]
    const mid = iapAt('M', 'height', 7 + 0.5 / 12)!
    expect(mid.M).toBeCloseTo((a.height_boys_M + b.height_boys_M) / 2, 9)
    expect(mid.L).toBeCloseTo((a.height_boys_L + b.height_boys_L) / 2, 9)
    expect(mid.S).toBeCloseTo((a.height_boys_S + b.height_boys_S) / 2, 9)
    const quarter = iapAt('F', 'bmi', 7 + 0.25 / 12)!
    expect(quarter.M).toBeCloseTo(a.bmi_girls_M + (b.bmi_girls_M - a.bmi_girls_M) / 4, 9)
  })

  it('stops at the published ages', () => {
    expect(iapAt('M', 'height', 4.999)).toBeNull()
    expect(iapAt('M', 'height', 5)).not.toBeNull()
    expect(iapAt('M', 'height', 18)).not.toBeNull()
    expect(iapAt('M', 'height', 18.01)).toBeNull()
    expect(iapAt('F', 'bmi', Number.NaN)).toBeNull()
  })

  describe('against the tables printed in the paper (Indian Pediatrics 2015;52:47-55, Tables II to VII)', () => {
    const paper = text(iapPaperCsv)
    const cells = (r: Record<string, string>) => [1, 2, 3, 4, 5, 6, 7].map((i) => Number(r[`c${i}`]))
    const at = (r: Record<string, string>) => iapAt(r.sex === 'boys' ? 'M' : 'F', r.measure as Measure, Number(r.age_years))!

    it('has all six tables, half-yearly from 5 to 18 years', () => {
      expect(paper.length).toBe(6 * 27)
    })

    it('height and weight: all 756 printed values match, to the 0.1 they are printed to', () => {
      // The seven printed columns (headed 3, 10, 25, 50, 75, 90, 97) are the lines at
      // −2, −1⅓, −⅔, 0, +⅔, +1⅓ and +2 SD. Half of 0.1 is the rounding; 0.002 allows for a
      // printed value that was rounded from exactly …5.
      let n = 0
      for (const r of paper.filter((x) => x.measure !== 'bmi')) {
        const p = at(r)
        cells(r).forEach((printed, i) => {
          n++
          expect(Math.abs(valueFromLms(IAP_HEIGHT_WEIGHT_LINES[i].z!, p.L, p.M, p.S) - printed), `${r.measure} ${r.sex} ${r.age_years} column ${i + 1}`).toBeLessThan(0.052)
        })
      }
      expect(n).toBe(756)
    })

    it('height and weight: the exact 3rd and 97th centiles would NOT match the printed columns', () => {
      // Guards the finding above: if someone "corrects" the lines to true centiles, the chart
      // stops agreeing with the published one by up to a centimetre.
      const boys18 = paper.find((r) => r.measure === 'height' && r.sex === 'boys' && r.age_years === '18.0')!
      const p = at(boys18)
      expect(Math.abs(valueFromLms(Z3, p.L, p.M, p.S) - Number(boys18.c1))).toBeGreaterThan(0.9)
      expect(Math.abs(valueFromLms(-2, p.L, p.M, p.S) - Number(boys18.c1))).toBeLessThan(0.052)
    })

    it('BMI: the chart lines ARE the printed table, value for value', () => {
      for (const r of paper.filter((x) => x.measure === 'bmi')) {
        const sex = r.sex === 'boys' ? 'M' : 'F'
        expect(iapBmiPrintedAt(sex, Number(r.age_years)), `${r.sex} ${r.age_years}`).toEqual(cells(r))
      }
      expect(IAP_BMI_PRINTED.M.length).toBe(27)
      expect(IAP_BMI_PRINTED.F.length).toBe(27)
      expect(IAP_BMI_LINES.length).toBe(7)
    })

    it('BMI: printed lines rise across the columns and never fall with age', () => {
      for (const sex of ['M', 'F'] as const)
        IAP_BMI_PRINTED[sex].forEach((row, i) => {
          expect(row.every((v, j) => j === 0 || v > row[j - 1])).toBe(true)
          if (i > 0) expect(row.every((v, j) => v >= IAP_BMI_PRINTED[sex][i - 1][j])).toBe(true)
        })
    })

    it('BMI: between half years the lines lie in proportion, and stop at 5 and 18', () => {
      const a = IAP_BMI_PRINTED.M[4]
      const b = IAP_BMI_PRINTED.M[5]
      const mid = iapBmiPrintedAt('M', 7.25)!
      mid.forEach((v, j) => expect(v).toBeCloseTo((a[j] + b[j]) / 2, 9))
      expect(iapBmiPrintedAt('M', 4.99)).toBeNull()
      expect(iapBmiPrintedAt('M', 18.01)).toBeNull()
      expect(iapBmiPrintedAt('F', 18)).toEqual(IAP_BMI_PRINTED.F[26])
    })

    it('BMI: the calculator L, M, S (used for BMI SDS) follow the printed centile columns within a quarter unit', () => {
      // Columns 1 to 5 are the 3rd, 5th, 10th, 25th and 50th centiles. The SDS comes from the
      // calculator's L, M, S; this records how closely those follow the printed table
      // (largest gap 0.22 kg/m², 3rd centile in boys at 18 years).
      const z = [Z3, -1.6448536, -1.2815516, -0.6744898, 0]
      for (const r of paper.filter((x) => x.measure === 'bmi')) {
        const p = at(r)
        const printed = cells(r)
        z.forEach((zi, col) => {
          expect(Math.abs(valueFromLms(zi, p.L, p.M, p.S) - printed[col]), `${r.sex} ${r.age_years} column ${col + 1}`).toBeLessThan(0.25)
        })
      }
    })

    it('BMI: the overweight and obesity lines reach about 23 and 27 at 18 years', () => {
      for (const sex of ['M', 'F'] as const) {
        const last = iapBmiPrintedAt(sex, 18)!
        expect(Math.abs(last[BMI_LINE.overweight] - 23)).toBeLessThan(0.25)
        expect(Math.abs(last[BMI_LINE.obese] - 27)).toBeLessThan(0.45)
      }
    })
  })
})

describe('choosing the reference by age', () => {
  it('uses WHO by day under 5 years and IAP from 5 years', () => {
    expect(referenceAt('M', 'height', 0)).toMatchObject({ ref: 'who2006', posture: 'length' })
    expect(referenceAt('M', 'height', 1000)).toMatchObject({ ref: 'who2006', posture: 'height' })
    // 1826 days is 4.9993 years, 1827 days is 5.002 years.
    expect(referenceAt('M', 'height', 1826)).toMatchObject({ ref: 'who2006' })
    expect(referenceAt('M', 'height', 1827)).toMatchObject({ ref: 'iap2015' })
    expect(referenceAt('F', 'height', 4000)).toMatchObject({ ref: 'iap2015' })
  })
  it('never leaves a gap or an overlap between birth and 18 years for height', () => {
    for (let day = 0; day <= Math.floor(18 * 365.25); day++) expect(referenceAt('F', 'height', day), `day ${day}`).not.toBeNull()
  })
  it('has no weight or BMI reference under 5 years, and nothing after 18', () => {
    expect(referenceAt('M', 'weight', 1000)).toBeNull()
    expect(referenceAt('M', 'bmi', 1826)).toBeNull()
    expect(referenceAt('M', 'weight', 1827)).toMatchObject({ ref: 'iap2015' })
    expect(referenceAt('M', 'height', 6574)).not.toBeNull()
    expect(referenceAt('M', 'height', 6576)).toBeNull()
  })
  it('counts the 18th birthday as 18.0 years whichever day it falls on', () => {
    // Born 1 March 2008, seen 1 March 2026: 6574 days. Born 1 March 2007, seen 1 March 2025: 6575.
    expect(ageInDays('2008-03-01', '2026-03-01')).toBe(6574)
    expect(ageInDays('2007-03-01', '2025-03-01')).toBe(6575)
    const last = iapAt('F', 'height', 18)!
    expect(referenceAt('F', 'height', 6575)).toEqual(last)
    expect(referenceAt('F', 'bmi', 6575)).toEqual(iapAt('F', 'bmi', 18))
    expect(referenceAt('F', 'height', 6574)!.M).toBeLessThan(last.M)
    expect(referenceAt('M', 'height', 12.5)).toBeNull()
    expect(referenceAt('M', 'height', -3)).toBeNull()
  })
})

describe('chart line positions', () => {
  it('centile SDS constants are the normal quantiles they claim to be', () => {
    expect(phi(Z3)).toBeCloseTo(0.03, 6)
    expect(phi(-1.6448536)).toBeCloseTo(0.05, 6)
    expect(phi(-1.2815516)).toBeCloseTo(0.1, 6)
    expect(phi(-0.6744898)).toBeCloseTo(0.25, 6)
  })
  it('lines are in increasing order with unique labels', () => {
    for (const lines of [IAP_HEIGHT_WEIGHT_LINES, WHO_SD_LINES, IAP_BMI_LINES]) {
      if (lines !== IAP_BMI_LINES) expect(lines.every((l, i) => i === 0 || l.z! > lines[i - 1].z!)).toBe(true)
      expect(new Set(lines.map((l) => l.label)).size).toBe(lines.length)
    }
  })
  it('every line is defined and increasing at every age it is drawn', () => {
    for (const [sex] of SEXES)
      for (const m of ['height', 'weight'] as const)
        for (let i = 0; i <= 156; i++) {
          const p = iapAt(sex, m, 5 + i / 12)!
          const values = IAP_HEIGHT_WEIGHT_LINES.map((l) => valueFromLms(l.z!, p.L, p.M, p.S))
          expect(values.every((v, j) => Number.isFinite(v) && v > 0 && (j === 0 || v > values[j - 1])), `${m} ${sex} month ${60 + i}`).toBe(true)
        }
  })
})
