import { readFile, readdir, writeFile } from 'node:fs/promises';
const assets = await readdir(new URL('../dist/assets/', import.meta.url));
const js = await readFile(new URL('../dist/assets/' + assets.find(f => f.endsWith('.js')), import.meta.url), 'utf8');
const css = await readFile(new URL('../dist/assets/' + assets.find(f => f.endsWith('.css')), import.meta.url), 'utf8');
const original = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
const html = original
  .replace(/<script type="module" crossorigin src="[^"]+"><\/script>/, '')
  .replace(/<link rel="stylesheet" crossorigin href="[^"]+">/, () => `<style>${css}</style>`)
  .replace(/<link rel="icon"[^>]+>/, '')
  .replace('</body>', () => `<script type="module">${js.replaceAll('</script>', '<\\/script>')}</script></body>`);
await writeFile(new URL('../dist/ridni-demo.html', import.meta.url), html);
console.log('Portable demo: dist/ridni-demo.html');
