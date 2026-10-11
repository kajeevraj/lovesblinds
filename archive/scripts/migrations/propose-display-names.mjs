// One-off: proposes customer-facing display names (src/data/displayNames.json) and writes the review sheet
// docs/display-names.html. Rules:
//  - a supplier color name that is unique within its product line is kept as is
//  - a name that collides with another swatch in the same line, or is missing (Roman, Curtains), gets a new
//    "<Descriptor> <Base>" name, ordered light to dark inside each base-color group
//  - no digits, no supplier collection name, no supplier code in any name
// Edits go in src/data/displayNames.json (or paste from the review sheet); this script never overwrites a
// names file that already exists unless run with --force.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import sharp from 'sharp';
import { classifyFile } from '../lib-color.mjs';

const J = f => JSON.parse(readFileSync(f, 'utf8'));
const data = J('src/data/swatches.json');
const fam = { ...J('src/data/colorFamilies.json'), ...J('src/data/colorFamilyOverrides.json') };
const MANUAL = existsSync('scripts/migrations/display-name-manual.json') ? J('scripts/migrations/display-name-manual.json') : {};
const force = process.argv.includes('--force');

// ---- vocabulary: descriptors per base color, light to dark. tone: w warm, c cool, g green, n any ------------
const V = (s) => s.split(',').map(x => x.trim()).filter(Boolean).map(x => { const [d, t = 'n'] = x.split(':'); return { d, t }; });
const VOCAB = {
  // No fiber or weave words (linen, cotton, silk, velvet, tweed, bamboo...): a name must not hint at a material the fabric is not.
  White: V('Snow:c,Frost:c,Arctic:c,Polar:c,Crystal:c,Opal:c,Quartz:c,Salt:c,Cloud:c,Chalk:c,Crisp:c,Bright:c,Mist:c,Winter:c,Ghost:c,Moonbeam:c,Starlight:c,Alpine:c,Glacier:c,Iceberg:c,Flurry:c,Blizzard:c,Foam:c,Surf:c,Edelweiss:c,Tundra:c,Swan:n,Lily:n,Daisy:n,Birch:n,Aspen:n,Paper:n,Bleached:n,Whisper:n,Porcelain:n,Sugar:n,Angel:n,Dove:n,Gossamer:n,Powder:n,Lotus:n,Plaster:n,Limewash:n,Whitewash:n,Gesso:n,Stucco:n,Marble:n,Talc:n,Pristine:n,Airy:n,Breeze:n,Feather:n,Wisp:n,Blossom:n,Pearl:w,Milk:w,Vanilla:w,Magnolia:w,Gardenia:w,Jasmine:w,Alabaster:w,Shell:w,Seashell:w,Eggshell:w,Bone:w,Rice:w,Coconut:w,Marshmallow:w,Meringue:w,Buttermilk:w,Almond:w,Candlelight:w,Bisque:w,Narcissus:w,Dewdrop:w,Fresh:n,Clean:n'),
  Cream: V('Butter:w,Vanilla:w,Champagne:w,Custard:w,Eggshell:w,Meringue:w,Buttermilk:w,Antique:w,Candlelight:w,Honey:w,Pale:n,Soft:n,Warm:w,Golden:w,Sorbet:w,Pudding:w'),
  Ivory: V('Antique:w,Warm:w,Soft:n,Pale:n,Candlelight:w,Vintage:w,Heirloom:w,Classic:n,Timeless:n'),
  Gray: V('Mist:c,Cloud:c,Dove:n,Silver:c,Platinum:c,Frost:c,Haze:c,Drizzle:c,Rain:c,Ash:n,Pebble:w,Heather:w,Oyster:w,Pewter:c,Flint:c,Slate:c,Smoke:n,Graphite:c,Storm:c,Steel:c,Granite:n,Shadow:n,Gunmetal:c,Iron:c,Cinder:w,Asphalt:n,Concrete:n,Cement:n,Mineral:c,Seal:n,Elephant:w,Thunder:c,Taupe:w,Mushroom:w,Anchor:c,Twilight:c,Sterling:c,Dusk:c,Fossil:w,Nickel:c,Zinc:c,Lead:c,Pigeon:n,Morning:n,Soot:n,Gravel:n,Shale:n,Chrome:c,Tin:c,Wolf:n,Dolphin:c,Whale:c,Seagull:c'),
  Charcoal: V('Smoke:n,Slate:c,Storm:c,Iron:c,Ash:n,Shadow:n,Granite:n,Gunmetal:c,Flint:c,Cinder:w,Asphalt:n,Soot:n,Basalt:n,Graphite:c,Coal:n,Pewter:c,Tar:n,Anthracite:n'),
  Black: V('Jet:n,Onyx:n,Ink:c,Midnight:c,Raven:n,Ebony:w,Obsidian:n,Coal:n,Licorice:w,Carbon:c,Tuxedo:n,Panther:n,Pitch:n,Noir:n,Eclipse:n,Night:c,Crow:n,Soot:n'),
  Beige: V('Oatmeal:w,Almond:w,Sand:w,Biscotti:w,Fawn:w,Buff:w,Cashew:w,Nougat:w,Parchment:w,Champagne:w,Pebble:n,Barley:w,Ecru:w,Shell:w,Pumice:n,Putty:n,Taupe:n,Mushroom:n,Camel:w,Praline:w,Toast:w,Desert:w,Dune:w,Clay:w,Hazelnut:w,Cappuccino:w,Mocha:w,Driftwood:n,Wheat:w,Shortbread:w,Biscuit:w,Brioche:w,Granola:w,Macaroon:w,Nutmeg:w,Butterscotch:w,Cracker:w,Sandbar:w'),
  Khaki: V('Sandstone:w,Dune:w,Wheat:w,Straw:w,Biscuit:w,Sahara:w,Desert:w,Safari:w,Driftwood:n,Clay:w,Camel:w,Taupe:n,Mushroom:n,Prairie:w,Savanna:w,Dust:n,Mesa:w,Canyon:w,Ridge:n,Gravel:n,Trail:n,Terrain:n,Olive:g,Moss:g,Sage:g,Fern:g,Cactus:g,Army:g'),
  Brown: V('Caramel:w,Toffee:w,Hazelnut:w,Cinnamon:w,Chestnut:w,Pecan:w,Walnut:n,Mocha:n,Cocoa:n,Cedar:w,Teak:w,Sable:n,Truffle:n,Umber:n,Mahogany:w,Java:n,Espresso:n,Bark:n,Acorn:w,Tobacco:w,Saddle:w,Cognac:w,Bronze:w,Mink:n'),
  Chocolate: V('Milk:w,Hazelnut:w,Mocha:n,Truffle:n,Bittersweet:n,Dark:n,Cocoa:n'),
  Coffee: V('Iced:w,Roasted:n,Morning:n,Hazelnut:w,Mocha:n,Fresh:n,Black:n'),
  Latte: V('Oat:w,Vanilla:w,Caramel:w,Honey:w,Chai:w,Maple:w,Hazelnut:w,Almond:w,Cinnamon:w'),
  Blue: V('Sky:c,Powder:c,Cornflower:c,Baby:c,Harbor:c,Ocean:c,Slate:c,Steel:c,Indigo:c,Navy:c,Sapphire:c,Cobalt:c,Lake:c,Aqua:g,Seafoam:g,Teal:g,Midnight:c,Ink:c,Twilight:c'),
  Green: V('Mint:g,Celery:g,Pear:g,Sage:g,Fern:g,Moss:g,Olive:g,Basil:g,Jade:g,Eucalyptus:g,Pine:g,Forest:g,Avocado:g,Meadow:g,Lime:g,Seafoam:g,Ivy:g'),
  Pink: V('Blush:w,Petal:w,Peony:w,Rose:w,Coral:w,Salmon:w,Carnation:w,Bubblegum:w,Flamingo:w,Ballet:w'),
  Red: V('Cherry:w,Brick:w,Ruby:w,Garnet:w,Cranberry:w,Scarlet:w,Berry:w,Crimson:w,Poppy:w,Rust:w'),
  Purple: V('Lavender:c,Lilac:c,Wisteria:c,Heather:c,Iris:c,Plum:n,Amethyst:n,Mauve:w,Grape:n,Thistle:c,Eggplant:n'),
  Yellow: V('Butter:w,Lemon:w,Honey:w,Straw:w,Sunbeam:w,Canary:w,Buttercup:w,Daffodil:w,Maize:w,Mustard:w'),
  Silver: V('Sterling:c,Platinum:c,Nickel:c,Chrome:c,Frosted:c,Polished:n,Brushed:n,Tin:c'),
};
// A descriptor that already ends the base word's own meaning would read badly ("Chocolate Chocolate"); filter at use.

// ---- banned words: any supplier collection name, as whole words ----------------------------------------------
const collections = [...new Set(data.fabrics.map(f => f.fabric.toLowerCase()))];
const banned = (name) => collections.some(c => new RegExp(`\\b${c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(name));

// ---- base color word -----------------------------------------------------------------------------------------
const KEEP_WORDS = { khaki: 'Khaki', latte: 'Latte', coffee: 'Coffee', chocolate: 'Chocolate', yellow: 'Yellow', silver: 'Silver', ivory: 'Ivory', cream: 'Cream' };
const FAMILY_BASE = { White: 'White', 'Cream/Ivory': 'Cream', 'Beige/Tan': 'Beige', Gray: 'Gray', 'Charcoal/Black': 'Black', Brown: 'Brown', Blue: 'Blue', Green: 'Green', 'Pink/Red': 'Pink', Purple: 'Purple', 'Pattern/Multi': null };
function baseOf(s, lab) {
  const words = (s.colorName || '').toLowerCase().match(/[a-z]+/g) || [];
  // The last family-ish word in the supplier name decides, so "White Grey" is a Gray and "Black Brown" a Brown.
  for (let i = words.length - 1; i >= 0; i--) {
    const w = words[i];
    if (KEEP_WORDS[w]) return KEEP_WORDS[w];
    if (['gray', 'grey'].includes(w)) return 'Gray';
    if (w === 'red') return 'Red';
    if (w === 'pink') return 'Pink';
    if (['blue', 'navy'].includes(w)) return 'Blue';
    if (w === 'green') return 'Green';
    if (['purple', 'lilac', 'mauve'].includes(w)) return 'Purple';
    if (w === 'brown') return 'Brown';
    if (['white', 'off-white'].includes(w)) return 'White';
    if (w === 'black') return 'Black';                         // the supplier's own base word stays
    if (['beige', 'tan', 'sand'].includes(w)) return 'Beige';
    if (w === 'charcoal') return 'Charcoal';
  }
  const b = FAMILY_BASE[fam[s.id]];
  if (b === 'Black' && lab[0] > 22) return 'Charcoal';
  return b;
}
// Typical lightness range of each base color, light to dark. A swatch's own lightness picks its place in the list.
const L_RANGE = { White: [98, 78], Cream: [96, 78], Ivory: [96, 78], Beige: [90, 55], Khaki: [92, 45], Gray: [90, 30], Charcoal: [42, 15], Black: [30, 5], Brown: [55, 15], Chocolate: [42, 15], Coffee: [48, 15], Latte: [85, 50], Blue: [88, 30], Green: [88, 35], Pink: [90, 50], Red: [60, 25], Purple: [88, 35], Yellow: [95, 70], Silver: [90, 55] };
const toneOf = ([L, a, b]) => (a < -2.5 && b > 0 ? 'g' : b < 1.5 ? 'c' : b >= 4 ? 'w' : 'n');

// ---- gather features -----------------------------------------------------------------------------------------
const lines = ['roller', 'zebra', 'shangri-la', 'cellular', 'dream-curtains', 'drapery'];
const label = s => s.colorName || fam[s.id];
// Roller and Cellular show one family at a time, so a name only has to be unique inside its family.
const scopeOf = s => (['roller', 'cellular'].includes(s.line) ? `${s.line}/${s.family}` : s.line);
const items = [];
for (const s of data.swatches) {
  const { lab } = await classifyFile('public' + s.thumb, s.line);
  items.push({ s, lab, base: baseOf(s, lab), tone: toneOf(lab) });
}

// ---- find collisions, propose names --------------------------------------------------------------------------
const names = {};      // id -> displayName
const meta = {};       // id -> { status, reason }
for (const line of lines) {
  const inLine = items.filter(i => i.s.line === line);
  const counts = new Map();
  for (const i of inLine) { const k = `${scopeOf(i.s)}|${label(i.s).trim().toLowerCase()}`; counts.set(k, (counts.get(k) || 0) + 1); }
  const keepers = new Set();
  for (const i of inLine) {
    const k = `${scopeOf(i.s)}|${label(i.s).trim().toLowerCase()}`;
    const unique = counts.get(k) === 1 && i.s.colorName;
    if (unique && !banned(i.s.colorName)) { names[i.s.id] = i.s.colorName; meta[i.s.id] = { status: 'kept' }; keepers.add(names[i.s.id].toLowerCase()); }
    else if (unique) meta[i.s.id] = { status: 'rename', reason: 'name contains a collection name' };
    else meta[i.s.id] = { status: 'rename', reason: i.s.colorName ? `"${i.s.colorName}" is used by ${counts.get(k)} swatches in this ${['roller', 'cellular'].includes(line) ? 'family' : 'line'}` : 'no supplier name (color family shown today)' };
  }
  const used = new Set(keepers);
  const todo = inLine.filter(i => meta[i.s.id].status === 'rename');
  const groups = new Map();
  for (const i of todo) { const g = i.base || 'Pattern'; (groups.get(g) || groups.set(g, []).get(g)).push(i); }
  for (const [base, g] of groups) {
    const list = (VOCAB[base] || []).filter(v => !banned(`${v.d} ${base}`) && !v.d.toLowerCase().includes(base.toLowerCase()) && !base.toLowerCase().includes(v.d.toLowerCase()));
    g.sort((a, b) => b.lab[0] - a.lab[0]);                       // light to dark: lighter swatches choose first
    const orig = new Set(g.map(i => (i.s.colorName || '').toLowerCase()));
    g.forEach((i, rank) => {
      const manual = MANUAL[i.s.id];
      if (manual) { names[i.s.id] = manual; used.add(manual.toLowerCase()); return; }
      if (!list.length) return;                                  // handled manually
      const [hi, lo] = L_RANGE[base] || [95, 5];
      const t = Math.min(1, Math.max(0, (hi - i.lab[0]) / (hi - lo)));
      const pool = list.filter(v => v.t === i.tone || v.t === 'n');
      const use = pool.length >= g.length ? pool : list;
      let idx = Math.round(t * (use.length - 1)), step = 0, pick = null;
      while (!pick && step <= use.length) {
        for (const j of [idx + step, idx - step]) {
          const v = use[j]; const nm = v && `${v.d} ${base}`.toLowerCase(); if (v && !used.has(nm) && !orig.has(nm)) { pick = v; break; }
        }
        step++;
      }
      if (!pick) pick = list.find(v => !used.has(`${v.d} ${base}`.toLowerCase()) && !orig.has(`${v.d} ${base}`.toLowerCase()));
      if (pick) { names[i.s.id] = `${pick.d} ${base}`; used.add(names[i.s.id].toLowerCase()); }
    });
  }
  for (const i of inLine) if (MANUAL[i.s.id] && !names[i.s.id]) names[i.s.id] = MANUAL[i.s.id];
}
// manual names can also replace a kept name or fill a gap
for (const [id, n] of Object.entries(MANUAL)) names[id] = n;
const missing = items.filter(i => !names[i.s.id]);
if (missing.length) console.log('NO NAME YET:', missing.map(i => `${i.s.id} (${i.base})`).join(', '));

if (!existsSync('src/data/displayNames.json') || force) {
  const sorted = Object.fromEntries(data.swatches.filter(s => names[s.id]).map(s => [s.id, names[s.id]]));
  writeFileSync('src/data/displayNames.json', JSON.stringify(sorted, null, 1) + '\n');
}

// ---- stats ---------------------------------------------------------------------------------------------------
const stat = {};
for (const line of lines) {
  const inLine = items.filter(i => i.s.line === line);
  const kept = inLine.filter(i => meta[i.s.id].status === 'kept').length;
  const dupSw = inLine.filter(i => meta[i.s.id].reason?.includes('is used by')).length;
  const nameless = inLine.filter(i => !i.s.colorName).length;
  stat[line] = { swatches: inLine.length, kept, renamed: inLine.length - kept, dupSwatches: dupSw, nameless };
}
console.log(JSON.stringify(stat, null, 1));

// ---- review sheet --------------------------------------------------------------------------------------------
const esc = v => String(v ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const final = J('src/data/displayNames.json');
const sections = [];
for (const line of lines) {
  const inLine = items.filter(i => i.s.line === line).sort((a, b) => (a.base || '').localeCompare(b.base || '') || b.lab[0] - a.lab[0]);
  const tiles = [];
  for (const i of inLine) {
    const thumb = (await sharp('public' + i.s.thumb).resize(112, 112).jpeg({ quality: 62 }).toBuffer()).toString('base64');
    const m = meta[i.s.id];
    const changed = final[i.s.id] !== i.s.colorName;
    tiles.push(`<figure class="t ${changed ? 'chg' : 'keep'}" data-id="${esc(i.s.id)}" data-orig="${esc(final[i.s.id])}" data-line="${line}">
      <img src="data:image/jpeg;base64,${thumb}" alt="">
      <figcaption><span class="cur">Now: ${esc(label(i.s))}</span>
      <input value="${esc(final[i.s.id])}" aria-label="Display name for ${esc(i.s.code)}">
      <span class="code">${esc(i.s.code)}</span>
      ${changed ? `<span class="why">${esc(m.reason || 'renamed')}</span>` : '<span class="ok">kept</span>'}</figcaption></figure>`);
  }
  const s = stat[line];
  sections.push(`<section id="${line}"><h2>${line} <small>${s.swatches} swatches: ${s.kept} kept, ${s.renamed} renamed</small></h2><div class="g">${tiles.join('')}</div></section>`);
}
const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Display names review</title>
<style>body{font:14px/1.4 system-ui,sans-serif;margin:0;padding:16px;background:#f6f1e8;color:#221f1a}h1{margin:0 0 4px;font-size:22px}p{max-width:820px;margin:4px 0 12px}
h2{margin:28px 0 8px;font-size:18px;border-bottom:2px solid #c6a86c;padding-bottom:4px}h2 small{font-weight:400;color:#6b5a3a;font-size:13px}
.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}.t{margin:0;background:#fff;border-radius:8px;padding:6px;font-size:11px}.t img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:5px;display:block}
.t.chg{outline:2px solid #b3541e}.t.keep{outline:2px solid #2a6f3b}.t.edited{background:#fff6d6}.t.dup{background:#ffd9d9}
.cur{display:block;color:#6b5a3a;margin-top:4px}.t input{width:100%;box-sizing:border-box;font:600 13px system-ui;margin:3px 0;padding:3px}.code{display:block;color:#555}.why{display:block;color:#b3541e}.ok{color:#2a6f3b}
.bar{position:sticky;top:0;background:#221f1a;color:#f6f1e8;padding:10px 14px;margin:0 -16px 12px;z-index:5}.bar textarea{width:100%;height:60px;font:11px monospace;margin-top:6px}
nav a{margin-right:12px}</style>
<div class="bar"><b>Edited names</b> (paste into <code>src/data/displayNames.json</code>; a pink tile is a duplicate inside its line)<textarea id="out" readonly></textarea></div>
<h1>Display names review</h1>
<p><b>Orange</b> = new name proposed (the supplier name is shared with other swatches in its line, or missing). <b>Green</b> = supplier name kept (unique in its line). Tiles are sorted by base color word, light to dark. Edit a name in its box; the JSON above collects only your edits, and duplicates inside a line turn pink.</p>
<nav>${lines.map(l => `<a href="#${l}">${l}</a>`).join('')}</nav>
${sections.join('\n')}
<script>
const out=document.getElementById('out');
function update(){const edits={};const seen={};let dups=0;
 document.querySelectorAll('.t').forEach(t=>{t.classList.remove('dup')});
 document.querySelectorAll('.t').forEach(t=>{const v=t.querySelector('input').value.trim();const k=t.dataset.line+'|'+v.toLowerCase();(seen[k]=seen[k]||[]).push(t);
  if(v!==t.dataset.orig){edits[t.dataset.id]=v;t.classList.add('edited')}else t.classList.remove('edited')});
 Object.values(seen).forEach(a=>{if(a.length>1)a.forEach(t=>t.classList.add('dup'))});
 out.value=JSON.stringify(edits,null,1)}
document.addEventListener('input',e=>{if(e.target.tagName==='INPUT')update()});update();
</script>`;
mkdirSync('docs', { recursive: true });
writeFileSync('docs/display-names.html', html);
console.log('docs/display-names.html written');
