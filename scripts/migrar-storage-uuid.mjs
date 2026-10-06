// ─────────────────────────────────────────────────────────────────────────────
// Migra los PDFs del bucket plan_pdfs de carpetas numéricas legacy
// (userId/<proyecto_num>/) a carpetas uuid (userId/<cf_proyectos.id>/).
//
// Uso (service key: Supabase → Settings → API → service_role key):
//   SUPABASE_SERVICE_ROLE_KEY=eyJ... node scripts/migrar-storage-uuid.mjs
// (La URL la lee de .env: VITE_SUPABASE_URL.)
//
// Idempotente: los objetos ya movidos simplemente no vuelven a aparecer en el listado
// de la carpeta legacy. Al terminar imprime el resumen por proyecto.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync('.env', 'utf-8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
);

const URL_BASE = (process.env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const BUCKET = 'plan_pdfs';

if (!URL_BASE || !SERVICE_KEY) {
  console.error('Faltan VITE_SUPABASE_URL (.env) o SUPABASE_SERVICE_ROLE_KEY (variable de entorno).');
  process.exit(1);
}

const headers = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
};

async function rpc(name, params) {
  const res = await fetch(`${URL_BASE}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(`${name}: ${res.status} ${await res.text()}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function listPrefix(prefix) {
  const PAGE = 100;
  const out = [];
  let offset = 0;
  // POST /object/list con limit/offset y bucle hasta página parcial: el default del API
  // trunca a 100 objetos y las carpetas grandes perdían PDFs en silencio.
  for (;;) {
    const res = await fetch(`${URL_BASE}/storage/v1/object/list/${BUCKET}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ prefix: prefix + '/', limit: PAGE, offset }),
    });
    if (!res.ok) throw new Error(`list ${prefix}: ${res.status} ${await res.text()}`);
    const page = await res.json();
    if (!Array.isArray(page)) throw new Error(`list ${prefix}: respuesta inesperada`);
    for (const o of page) if (o.name && !o.name.endsWith('/')) out.push(o);
    if (page.length < PAGE) return out;
    offset += page.length;
  }
}

async function move(source, destination) {
  const res = await fetch(`${URL_BASE}/storage/v1/object/${BUCKET}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ bucketId: BUCKET, sourceKey: source, destinationKey: destination }),
  });
  return res.ok;
}

const proyectos = await rpc('get_proyectos_para_migrar_storage', {});
if (!Array.isArray(proyectos) || proyectos.length === 0) {
  console.error(
    'Sin proyectos con legacy_num. ¿Aplicaste la RPC de apoyo (migración 20261005000010)?',
  );
  process.exit(1);
}

let totalOk = 0;
let totalFalla = 0;

for (const proy of proyectos) {
  const prefix = `${proy.user_id}/${proy.legacy_num}`;
  const objetos = await listPrefix(prefix);
  let ok = 0;
  let falla = 0;
  for (const obj of objetos) {
    const destino = `${proy.user_id}/${proy.id}/${obj.name}`;
    if (await move(`${prefix}/${obj.name}`, destino)) ok++;
    else falla++;
  }
  totalOk += ok;
  totalFalla += falla;
  console.log(`${proy.codigo || proy.id}: movidos ${ok}, fallas ${falla}`);
}

console.log(`\nTotal movidos: ${totalOk} · fallas: ${totalFalla}`);
if (totalFalla > 0) process.exit(2);
console.log('Listo: aplica la migración 20261005000011_drop_legacy_num.sql (drop column legacy_num).');
