import { describe as group, expect, it } from 'vitest'
import { blocks, describe, firstPageInnerHeight, normalize, pageCss, PRESETS, qualificationParts, SECTIONS, STANDARD } from './printlayout'

group('presets', () => {
  it('are already in normal form, so saving one changes nothing', () => {
    for (const p of PRESETS) expect(normalize(p.config), p.name).toEqual(p.config)
  })
  it('each list every section exactly once', () => {
    for (const p of PRESETS) expect(p.config.sections.map((s) => s.key).sort(), p.name).toEqual(SECTIONS.map((s) => s.key).sort())
  })
})

group('normalize', () => {
  it('gives the standard layout for nothing or nonsense', () => {
    expect(normalize(null)).toEqual(STANDARD)
    expect(normalize('junk')).toEqual(STANDARD)
    expect(normalize({ font_pt: 'big', vitals: 'sideways', accent: 'red' })).toEqual(STANDARD)
  })
  it('keeps numbers within printable limits', () => {
    const c = normalize({ paper: { name: 'Tiny', width: 10, height: 5000 }, font_pt: 99, gap: -4, line_height: 9, margin: { top: 5000, left: 5000, right: -3, bottom: 5000, top_next: 5000 } })
    expect(c.paper).toEqual({ name: 'Tiny', width: 70, height: 600 })
    expect([c.font_pt, c.gap, c.line_height]).toEqual([16, 0, 2.2])
    expect(c.margin.right).toBe(0)
    expect(c.paper.width - c.margin.left - c.margin.right).toBeGreaterThanOrEqual(40)
    expect(c.paper.height - c.margin.top - c.margin.bottom).toBeGreaterThanOrEqual(50)
    expect(c.paper.height - c.margin.top_next - c.margin.bottom).toBeGreaterThanOrEqual(50)
  })
  it('keeps the saved order, drops unknown or repeated sections, and adds missing ones hidden', () => {
    const c = normalize({ sections: [{ key: 'rx', show: true }, { key: 'made-up' }, { key: 'patient', show: true, space_before: 12 }, { key: 'rx', show: false }] })
    const keys = c.sections.map((s) => s.key)
    expect(keys.filter((k) => k === 'rx')).toHaveLength(1)
    expect(keys.indexOf('rx')).toBeLessThan(keys.indexOf('patient'))
    expect(keys.sort()).toEqual(SECTIONS.map((s) => s.key).sort())
    expect(c.sections.find((s) => s.key === 'patient')?.space_before).toBe(12)
    expect(c.sections.filter((s) => s.show).map((s) => s.key).sort()).toEqual(['patient', 'rx'])
  })
  it('never puts a full-width section in the side column', () => {
    const c = normalize({ side_width: 60, sections: [{ key: 'letterhead', side: true }, { key: 'signature', side: true }, { key: 'vitals', side: true }] })
    expect(c.sections.filter((s) => s.side).map((s) => s.key)).toEqual(['vitals'])
  })
  it('keeps the side column narrow enough to leave room for the medicines', () => {
    expect(normalize({ side_width: 500 }).side_width).toBe(120)
    const a5 = normalize({ paper: { width: 148, height: 210 }, margin: { left: 10, right: 10 }, side_width: 110 })
    expect(a5.side_width).toBe(68)
    expect(normalize({ side_width: 5 }).side_width).toBe(30)
    expect(normalize({ side_width: 0 }).side_width).toBe(0)
  })
  it('survives a round trip through JSON, as the database stores it', () => {
    for (const p of PRESETS) expect(normalize(JSON.parse(JSON.stringify(p.config)))).toEqual(p.config)
  })
})

group('blocks', () => {
  it('stacks shown sections in order when there is one column', () => {
    const b = blocks(STANDARD)
    expect(b.every((x) => x.kind === 'full')).toBe(true)
    expect(b.map((x) => (x.kind === 'full' ? x.key : ''))).toEqual(STANDARD.sections.filter((s) => s.show).map((s) => s.key))
  })
  it('groups ordinary sections into columns between the full-width ones', () => {
    const two = PRESETS.find((p) => p.name === 'Two-column A4')!.config
    const b = blocks(two)
    expect(b.map((x) => x.kind)).toEqual(['full', 'full', 'columns', 'full'])
    const cols = b[2]
    if (cols.kind !== 'columns') throw new Error('expected columns')
    expect(cols.side).toEqual(['vitals', 'tanner', 'allergy', 'investigations'])
    expect(cols.main).toEqual(['diagnosis', 'rx', 'plan', 'advice', 'review'])
  })
  it('starts a new column block after a full-width section placed in the middle', () => {
    const c = normalize({ side_width: 50, sections: [{ key: 'rx' }, { key: 'signature' }, { key: 'advice' }, { key: 'vitals', side: true }].map((s) => ({ show: true, ...s })) })
    expect(blocks(c).map((x) => x.kind)).toEqual(['columns', 'full', 'columns'])
  })
})

group('pageCss', () => {
  it('sets the paper size and margins, with the first page separate', () => {
    const pre = PRESETS.find((p) => p.name === 'Pre-printed A4 letterhead')!.config
    const css = pageCss(pre)
    expect(css).toContain('size: 210mm 297mm')
    expect(css).toContain('margin: 20mm 15mm 28mm 15mm')
    expect(css).toContain('@page :first { margin-top: 50mm; }')
    expect(css).not.toContain('counter(page)')
    expect(pageCss(STANDARD)).toContain("'Page ' counter(page) ' of ' counter(pages)")
  })
  it('leaves the first page a little short so a full page does not spill', () => {
    expect(firstPageInnerHeight(STANDARD)).toBe(297 - 13 - 15 - 3)
  })
})

group('describe', () => {
  it('summarises a layout in a line', () => {
    expect(describe(STANDARD)).toBe('A4 · prints letterhead · 12 pt')
    expect(describe(PRESETS[2].config)).toBe('A5 · pre-printed paper · 10 pt')
    expect(describe(PRESETS[3].config)).toBe('A4 · prints letterhead · two columns · 12 pt')
    expect(describe(normalize({ paper: { width: 297, height: 210 } }))).toBe('A4 landscape · prints letterhead · 12 pt')
    expect(describe(normalize({ paper: { width: 120, height: 180 } }))).toBe('120 × 180 mm · prints letterhead · 12 pt')
  })
})

group('qualifications on the letterhead', () => {
  it('are one degree to a piece, each keeping the comma after it', () => {
    expect(qualificationParts('MD (Pediatrics), DM (Pediatric Endocrinology)')).toEqual(['MD (Pediatrics),', 'DM (Pediatric Endocrinology)'])
    expect(qualificationParts('MBBS; MD | DNB · FRCPCH')).toEqual(['MBBS;', 'MD |', 'DNB ·', 'FRCPCH'])
  })
  it('are not divided at a comma inside brackets', () => {
    expect(qualificationParts('MD (Pediatrics, Gold Medal), DM [Endocrinology, AIIMS]')).toEqual(['MD (Pediatrics, Gold Medal),', 'DM [Endocrinology, AIIMS]'])
  })
  it('stay whole when there is nothing to divide at, and lose only stray spaces', () => {
    expect(qualificationParts('MD Pediatrics')).toEqual(['MD Pediatrics'])
    expect(qualificationParts('  MD ,DM,  ')).toEqual(['MD ,', 'DM,'])
    expect(qualificationParts('')).toEqual([])
    // A bracket that is never closed must not swallow the rest.
    expect(qualificationParts('MD (Pediatrics, DM')).toEqual(['MD (Pediatrics, DM'])
    expect(qualificationParts('MD), DM')).toEqual(['MD),', 'DM'])
  })
})
