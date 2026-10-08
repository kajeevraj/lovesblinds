// npm run color-report  ->  reports/color-review.html
// A contact sheet of every swatch grouped by its color family, so mistakes are easy to spot.
// Change a tile's family in the page, then copy the JSON it builds into
// src/data/colorFamilyOverrides.json (overrides win over the script).
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import sharp from 'sharp';
import { mergeCatalogs, orderCatalogs } from '../src/data/mergeSwatches.js';
import { FAMILIES, centerStats } from './lib-color.mjs';
import { familyFromName } from '../src/data/colorFamilyList.js';

const names = readdirSync('src/data').filter(n => /^swatches.*\.json$/.test(n));
const { swatches } = mergeCatalogs(orderCatalogs(names.map(name => ({ name, data: JSON.parse(readFileSync(join('src/data', name), 'utf8')) }))));
const auto = JSON.parse(readFileSync('src/data/colorFamilies.json', 'utf8'));
const over = JSON.parse(readFileSync('src/data/colorFamilyOverrides.json', 'utf8'));
// Tiles you have looked at and confirmed: { id: family }. They stop being flagged while the family is unchanged.
const reviewed = JSON.parse(readFileSync('src/data/colorFamilyReviewed.json', 'utf8'));

// A tile is flagged for a second look when the image decided its family (no family word in the name) and
//  - it was sorted as Pattern/Multi, or
//  - its name still hints at a different family (for example "Latte", "Goose Yellow", "Linen").
const HINTS = [
  [/latte|oat|natural|linen|champagne|bronze|gold|yellow|ecru/i, ['Cream/Ivory', 'Beige/Tan', 'White', 'Brown']],
  [/stone|smoke|ash|fog|glacier|hybrid|slate|steel|pewter/i, ['Gray', 'Charcoal/Black', 'White', 'Blue']],
  [/espresso|walnut|mocha|crimson|burgundy|rose|plum|violet/i, ['Brown', 'Pink/Red', 'Purple', 'Charcoal/Black']],
  [/teal|aqua|mint|olive|sage|lake|avocado/i, ['Blue', 'Green']],
];
const flagReason = (s, fam, byName) => {
  if (byName || reviewed[s.id] === fam) return null;
  if (fam === 'Pattern/Multi') return 'sorted as pattern by the image';
  const hit = s.colorName && HINTS.find(([re]) => re.test(s.colorName));
  if (hit && !hit[1].includes(fam)) return `name "${s.colorName}" hints elsewhere`;
  return null;
};

const groups = Object.fromEntries(FAMILIES.map(f => [f, []]));
for (const s of swatches) {
  const family = over[s.id] || auto[s.id];
  const { lab, meanDE } = await centerStats(join('public', s.thumb));
  const thumb = (await sharp(join('public', s.thumb)).resize(112, 112).jpeg({ quality: 62 }).toBuffer()).toString('base64');
  const byName = !!familyFromName(s.colorName) && !over[s.id];
  const reason = over[s.id] ? null : flagReason(s, family, byName);
  groups[family].push({ s, family, overridden: !!over[s.id], byName, L: lab[0], meanDE, thumb, flag: !!reason, reason });
}
const esc = (v) => String(v ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const total = swatches.length;
const flaggedTiles = Object.values(groups).flat().filter(t => t.flag);
const flagged = flaggedTiles.length;

const sections = FAMILIES.map(f => {
  const tiles = groups[f].sort((a, b) => b.L - a.L).map(t => `
    <figure class="t${t.flag ? ' flag' : ''}" data-id="${esc(t.s.id)}" data-auto="${esc(auto[t.s.id])}">
      <img src="data:image/jpeg;base64,${t.thumb}" alt="">
      <figcaption><b>${esc(t.s.colorName || t.s.fabric)}</b><br>${esc(t.s.code)}<br><i>${esc(t.s.line)}${t.s.family ? '/' + esc(t.s.family) : ''}</i> <small>${t.overridden ? 'override' : t.byName ? 'from name' : reviewed[t.s.id] === t.family ? 'from image, reviewed' : 'from image'}</small>${t.flag ? `<br><span class="why">${esc(t.reason)}</span>` : ''}
      <select aria-label="Family for ${esc(t.s.code)}">${FAMILIES.map(o => `<option${o === t.family ? ' selected' : ''}>${o}</option>`).join('')}</select></figcaption>
    </figure>`).join('');
  return `<section><h2>${f} <small>${groups[f].length}</small></h2><div class="g">${tiles}</div></section>`;
}).join('\n');

const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Color family review</title>
<style>
body{font:14px/1.4 system-ui,sans-serif;margin:0;padding:16px;background:#f6f1e8;color:#221f1a}
h1{margin:0 0 4px;font-size:22px}p{margin:4px 0 12px;max-width:760px}
h2{margin:28px 0 8px;font-size:18px;border-bottom:2px solid #c6a86c;padding-bottom:4px}h2 small{font-weight:400;color:#6b5a3a}
.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(124px,1fr));gap:10px}
.t{margin:0;background:#fff;border-radius:8px;padding:6px;font-size:11px}.t img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:5px;display:block}
.t.flag{outline:2px solid #b3541e}.t.changed{outline:2px solid #2a6f3b}.t select{width:100%;margin-top:4px;font-size:11px}
.why{color:#b3541e}.t small{opacity:.7}
.bar{position:sticky;top:0;background:#221f1a;color:#f6f1e8;padding:10px 14px;margin:0 -16px 12px;z-index:5}
.bar textarea{width:100%;height:70px;font:11px monospace;margin-top:6px}
</style>
<div class="bar"><b>Overrides to save</b> (paste into <code>src/data/colorFamilyOverrides.json</code>)<textarea id="out" readonly></textarea></div>
<h1>Color family review</h1>
<p>${total} swatches grouped by family. A family word in the color name decides the family; the image is used only when the name has none. Orange outline (${flagged} tiles): decided by the image and worth a look. Change a tile's family with its dropdown (green outline); the JSON above updates. Existing overrides are included.</p>
${sections}
<script>
const existing=${JSON.stringify(over)};
const out=document.getElementById('out');
function update(){const o={...existing};document.querySelectorAll('.t').forEach(t=>{const v=t.querySelector('select').value;const id=t.dataset.id;
 if(v!==t.dataset.auto){o[id]=v;t.classList.add('changed')}else{delete o[id];t.classList.remove('changed')}});out.value=JSON.stringify(o,null,1)}
document.addEventListener('change',e=>{if(e.target.tagName==='SELECT')update()});update();
</script>`;
mkdirSync('reports', { recursive: true });
writeFileSync('reports/color-review.html', html);
writeFileSync('docs/color-review.html', html);       // tracked copy, opens from GitHub
console.log(`color-review.html (reports/ and docs/): ${total} swatches, ${flagged} flagged`);
console.log('counts:', FAMILIES.map(f => `${f} ${groups[f].length}`).join(', '));
for (const t of flaggedTiles) console.log(`FLAG ${t.s.id} | ${t.s.colorName || '(no name)'} | ${t.family} | ${t.reason}`);
