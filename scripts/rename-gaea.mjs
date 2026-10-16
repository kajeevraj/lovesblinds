// One-off: the blackout collection "Gare" is a typo of "Gaea". Renames it in the catalog and leaves every id alone
// (fabric id roller:blackout:gare and all of its swatch ids stay, so saved orders keep working).
//   node scripts/rename-gaea.mjs            shows what it would do
//   node scripts/rename-gaea.mjs --apply
import { readFileSync, existsSync } from 'fs';
for (const f of ['.env.seed.local', '.env.local']) if (existsSync(f)) for (const l of readFileSync(f, 'utf8').split('\n')) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ''); }
const U = process.env.SUPABASE_URL, K = process.env.SUPABASE_SERVICE_ROLE_KEY; const h = { apikey: K, Authorization: `Bearer ${K}`, 'Content-Type': 'application/json', Prefer: 'return=representation' };
const ID = 'roller:blackout:gare';
const cur = (await (await fetch(`${U}/rest/v1/fabrics?id=eq.${ID}&select=id,collection_name`, { headers: h })).json())[0];
if (!cur) { console.error('fabric not found'); process.exit(1); }
console.log('now:', cur);
if (cur.collection_name === 'Gaea') { console.log('already renamed'); process.exit(0); }
if (!process.argv.includes('--apply')) { console.log('would rename "Gare" to "Gaea" (dry run; add --apply)'); process.exit(0); }
const r = await fetch(`${U}/rest/v1/fabrics?id=eq.${ID}`, { method: 'PATCH', headers: h, body: JSON.stringify({ collection_name: 'Gaea' }) });
console.log(r.status, JSON.stringify(await r.json()));
