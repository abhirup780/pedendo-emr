// Turns the demo-mode build into one self-contained page fragment (no <html>, <head> or
// <body> tags) that can be published as a shareable preview. Sample data only.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'

const dir = 'dist-preview/assets'
const files = readdirSync(dir)
const read = (ext) => files.filter((f) => f.endsWith(ext)).map((f) => readFileSync(`${dir}/${f}`, 'utf8')).join('\n')
const css = read('.css')
const js = read('.js').replaceAll('</script', '<\\/script')
if (/supabase\.co/.test(js.replace(/YOUR-PROJECT\.supabase\.co/g, ''))) throw new Error('Preview build contains a real Supabase address; refusing to write it.')

const page = `<title>PedEndo EMR Preview</title>
<style>
${css}
</style>
<div id="root"></div>
<script type="module">
${js}
</script>
`
writeFileSync('dist-preview/preview.html', page)
console.log(`dist-preview/preview.html ${(page.length / 1024).toFixed(0)} KB`)
