"""Cut the two Wikimedia Commons Tanner scale drawings into one small SVG per stage.

Only needed again if the crops should change. It needs Python with Playwright (Chromium) and
svgo, which are not project dependencies:

    python3 -I scripts/build-tanner.py reference-data/tanner /tmp/tanner-raw
    npx svgo --config scripts/tanner-svgo.config.mjs -f /tmp/tanner-raw -o src/assets/tanner

The drawings are only cropped: no line is redrawn or moved. The background panels, Roman
numerals, front view and orchidometer column of the originals are left out. Every stage of a
scale gets the same window size, so the five pictures are to one scale.
"""
import sys, re, json, os
import xml.etree.ElementTree as ET
from playwright.sync_api import sync_playwright
src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
SVG = 'http://www.w3.org/2000/svg'; XL = 'http://www.w3.org/1999/xlink'
ALLOW = {'svg', 'g', 'path', 'defs', 'linearGradient', 'radialGradient', 'stop'}
ET.register_namespace('', SVG); ET.register_namespace('xlink', XL)

def sanitize(path):
    root = ET.parse(path).getroot()
    def clean(e):
        for c in list(e):
            tag = c.tag.split('}')
            if len(tag) != 2 or tag[0] != '{' + SVG or tag[1] not in ALLOW: e.remove(c); continue
            for k in list(c.attrib):
                ns, _, name = k.rpartition('}')
                if ns and ns != '{' + XL: del c.attrib[k]; continue          # inkscape/sodipodi attributes
                if name.lower().startswith('on'): del c.attrib[k]; continue
                if name == 'href' and not c.attrib[k].startswith('#'): del c.attrib[k]
            clean(c)
    clean(root)
    for k in list(root.attrib):
        if '}' in k: del root.attrib[k]
    return root

JS = """() => {
  const svg = document.querySelector('svg'); const o = svg.getBoundingClientRect(); const out = [];
  for (const p of svg.querySelectorAll('path')) {
    if (p.closest('defs')) continue;
    const cs = getComputedStyle(p); if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    let op = 1; for (let e = p; e && e !== svg; e = e.parentElement) op *= parseFloat(getComputedStyle(e).opacity);
    if (op === 0) continue;
    const r = p.getBoundingClientRect(); if (r.width === 0 && r.height === 0) continue;
    const m = p.getCTM(); const c = p.cloneNode(false);
    // inherited presentation from ancestor groups (stroke etc.) is carried onto the path itself
    let inherited = ''; for (let e = p.parentElement; e && e !== svg; e = e.parentElement) inherited = (e.getAttribute('style') || '') + ';' + inherited;
    c.setAttribute('style', (inherited + ';' + (p.getAttribute('style') || '')).replace(/;+/g, ';').replace(/^;/, ''));
    c.setAttribute('transform', `matrix(${[m.a, m.b, m.c, m.d, m.e, m.f].map(v => +v.toFixed(5)).join(' ')})`);
    c.removeAttribute('id');
    out.push({ x: r.left - o.left, y: r.top - o.top, w: r.width, h: r.height, html: new XMLSerializer().serializeToString(c), op });
  }
  return out;
}"""

def defs_for(root, body):
    by = {e.get('id'): e for e in root.iter() if e.get('id') and e.tag.split('}')[1] in ('linearGradient', 'radialGradient')}
    need, todo = [], re.findall(r'url\(#([^)]+)\)', body)
    while todo:
        i = todo.pop()
        if i in need or i not in by: continue
        need.append(i); h = by[i].get('{%s}href' % XL)
        if h: todo.append(h[1:])
    return ''.join(ET.tostring(by[i], encoding='unicode') for i in sorted(need))

def cells(name, cols):
    root = sanitize(f'{src}/Tanner_scale-{name}.svg'); H = float(root.get('height')); W = float(root.get('width')); row_h = H / 5
    text = ET.tostring(root, encoding='unicode')
    with sync_playwright() as p:
        b = p.chromium.launch(); ctx = b.new_context(viewport={'width': 800, 'height': 800}); ctx.route('**/*', lambda r: r.abort())
        pg = ctx.new_page(); pg.set_content(f'<body style="margin:0">{text}</body>'); items = pg.evaluate(JS); b.close()
    grid = {}
    for it in items:
        cx, cy = it['x'] + it['w'] / 2, it['y'] + it['h'] / 2
        col = next((c for c, (a, z) in cols.items() if a <= cx < z), None)
        if col is None: continue
        grid.setdefault((col, min(4, int(cy // row_h))), []).append(it)
    return root, grid, (W, H, row_h)

def box(items):
    x0 = min(i['x'] for i in items); y0 = min(i['y'] for i in items); x1 = max(i['x'] + i['w'] for i in items); y1 = max(i['y'] + i['h'] for i in items)
    return x0, y0, x1, y1

def write(root, items, view, file):
    body = ''.join(i['html'] for i in items).replace(' xmlns="%s"' % SVG, '')
    d = defs_for(root, body).replace(' xmlns="%s"' % SVG, '')
    x, y, w, h = view
    svg = f'<svg xmlns="{SVG}" xmlns:xlink="{XL}" viewBox="{x:.2f} {y:.2f} {w:.2f} {h:.2f}">' + (f'<defs>{d}</defs>' if d else '') + body + '</svg>'
    open(f'{out}/{file}', 'w', encoding='utf-8').write(svg); return len(svg)

def same_size(views, pad=3):
    """Give every stage of one scale the same window size, so the pictures are to one scale."""
    w = max(b[2] - b[0] for b in views) + 2 * pad; h = max(b[3] - b[1] for b in views) + 2 * pad
    return [((b[0] + b[2]) / 2 - w / 2, (b[1] + b[3]) / 2 - h / 2, w, h) for b in views]

report = {}
# Windows are the same size for every stage of a scale, so the five pictures are to one scale.
# Female: side profile for the breast scale; the pubic region, cropped to the middle of the drawing.
root, grid, (W, H, rh) = cells('female', {'profile': (232, 336.6), 'pubic': (336.6, 462)})
views = same_size([box(grid[('profile', r)]) for r in range(5)])
for r in range(5): report[f'b{r+1}.svg'] = write(root, grid[('profile', r)], views[r], f'b{r+1}.svg')
for r in range(5): report[f'pf{r+1}.svg'] = write(root, grid[('pubic', r)], (364, r * rh + 26, 70, 66), f'pf{r+1}.svg')
# Male: the middle of the drawing. The app shows it whole for the genital scale and its upper
# part for the pubic hair scale.
root, grid, (W, H, rh) = cells('male', {'draw': (46, 218.5)})
for r in range(5): report[f'g{r+1}.svg'] = write(root, grid[('draw', r)], (99, r * rh + 3, 70, 87), f'g{r+1}.svg')
print(json.dumps(report))
