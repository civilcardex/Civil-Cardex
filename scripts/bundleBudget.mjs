// Presupuesto de bundle ENFORZADO (exit 1 si se pasa): el entry de la app y cada chunk
// lazy tienen un tope duro para que el creep de dependencias no pase de largo sin que
// nadie lo apruebe. Subir un umbral = acuerdo explícito (editar la constante y decirlo
// en el mensaje del commit que lo sube).
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DIST = join(process.cwd(), 'dist');
const KB = 1024;
// Entry: hoy ~430 KB (app + react + router + supabase). +25% de margen.
const TOPE_ENTRY_KB = 550;
// Chunks lazy: hoy el mayor es pdf.worker ~1.26 MB. +10% de margen.
const TOPE_CHUNK_KB = 1400;

const esJs = (n) => n.endsWith('.js');
const kbDe = (n) => Math.round(readFileSync(join(DIST, 'assets', n)).length / KB);

const index = readFileSync(join(DIST, 'index.html'), 'utf8');
const mEntry = index.match(/assets\/(index-[^"']+\.js)/);
if (!mEntry) {
  console.error('[bundleBudget] No encontré el entry index-*.js en dist/index.html');
  process.exit(1);
}
const entry = mEntry[1];

const pasados = [];
const kbEntry = kbDe(entry);
if (kbEntry > TOPE_ENTRY_KB) {
  pasados.push(`${entry}: ${kbEntry} KB > ${TOPE_ENTRY_KB} KB (entry, exceso +${kbEntry - TOPE_ENTRY_KB})`);
}

for (const n of readdirSync(join(DIST, 'assets')).filter(esJs)) {
  if (n === entry) continue;
  const kb = kbDe(n);
  if (kb > TOPE_CHUNK_KB) {
    pasados.push(`${n}: ${kb} KB > ${TOPE_CHUNK_KB} KB (chunk, exceso +${kb - TOPE_CHUNK_KB})`);
  }
}

if (pasados.length) {
  console.error(`[bundleBudget] ${pasados.length} asset(s) fuera de presupuesto:`);
  for (const p of pasados) console.error('  ' + p);
  process.exit(1);
}
console.log(`[bundleBudget] OK — entry ${entry} ${kbEntry} KB ≤ ${TOPE_ENTRY_KB}; chunks ≤ ${TOPE_CHUNK_KB}.`);
