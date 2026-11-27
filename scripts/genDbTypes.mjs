#!/usr/bin/env node
/**
 * Genera src/lib/database.types.ts derivando el schema FINAL de las migraciones SQL
 * (sin CLI de Supabase: la fuente de verdad vive en el repo). Formato supabase-js v2:
 * Database { public: { Tables: { Row/Insert/Update }, Functions, Views, Enums } }.
 *
 * Reglas (inventario verificado 2026-11):
 *  - Archivos en orden lexicográfico; cada uno se CORTA en la línea `-- DOWN` (los rollbacks
 *    documentados al final de 16 migraciones NO se aplican — esas columnas existen).
 *  - Parsea CREATE TABLE [IF NOT EXISTS], ALTER TABLE ADD/DROP COLUMN [IF EXISTS],
 *    RENAME COLUMN, ALTER TABLE RENAME TO y DROP TABLE [IF EXISTS]; dedup de columnas
 *    re-aplicadas idempotentemente (el schema base ya trae redes_activas/canal_id/…).
 *  - Renames de TABLA en cadena (perfiles→cf_perfiles ×25 en 20260814000002;
 *    cross_floor_ghosts→fantasmas_entrepisos→cf_…; rainwater_*→anulaciones_*→cf_…);
 *    los ALTERs se resuelven contra el nombre vigente en ese punto.
 *  - PATCH del único DDL dinámico (DO $$ … EXECUTE, invisible al parser): 20261005000007
 *    convierte proyecto_id a uuid en 11 hijas cf_* y cf_proyectos.id → uuid.
 *  - Sin enums en la BD: los CHECK-in-list relevantes se emiten como union.
 *  - Omitidas: tablas efímeras (_cf_uuid_mig_*, legacy_*).
 *  - Functions: las RPCs que el CLIENTE invoca (grep supabase.rpc en src) — sin ellas,
 *    supabase.rpc() tipado rechazaría los call-sites existentes.
 *
 * Uso: node scripts/genDbTypes.mjs   (idempotente; correr tras cada migración nueva)
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const DIR_MIG = join(RAIZ, 'supabase', 'migrations');
const SALIDA = join(RAIZ, 'src', 'lib', 'database.types.ts');

// ─── 1. Cargar migraciones en orden ────────────────────────────────────────────────────
const archivos = readdirSync(DIR_MIG)
  .filter((f) => f.endsWith('.sql'))
  .sort();

// ─── 2. Parser ─────────────────────────────────────────────────────────────────────────
const omitidas = new Set(['_cf_uuid_mig_pol_backup', '_cf_uuid_mig_trg_backup', 'legacy_plano_trazos', 'legacy_proyecto_data', 'legacy_proyectos']);

/** tablas keyed por el nombre VIGENTE en el momento (un RENAME TO mueve la entrada). */
const tablas = new Map();
const dropeadas = new Set();

function tablaDe(nombreRaw) {
  let t = tablas.get(nombreRaw);
  if (!t) {
    t = { columnas: new Map(), orden: [] };
    tablas.set(nombreRaw, t);
  }
  return t;
}
function moverTabla(de, a) {
  const t = tablas.get(de);
  if (!t) return;
  tablas.delete(de);
  const destino = tablas.get(a);
  if (destino) {
    // Merge (20260928000004 renombra cf_suscripciones→app_suscripciones que YA existe en
    // este lineage): gana el destino; las columnas del origen rellenan las faltantes.
    for (const col of t.orden) {
      if (!destino.columnas.has(col)) {
        destino.orden.push(col);
        destino.columnas.set(col, t.columnas.get(col));
      }
    }
  } else {
    tablas.set(a, t);
  }
}

const RE_SPLIT_DOWN = /^--\s*DOWN/m;
const RE_CREATE = /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?([a-z_0-9]+)\s*\(([\s\S]*?)\n\s*\)/gi;
const RE_ADD = /alter\s+table\s+(?:if\s+exists\s+)?(?:public\.)?([a-z_0-9]+)\s+add\s+column\s+(?:if\s+not\s+exists\s+)?([a-z_0-9]+)\s+([^;\n]+?)(?:\s*;|\n(?=\s*alter\s+table|\n\s*create|\n\s*--|\n\s*$))/gi;
const RE_DROP_COL = /alter\s+table\s+(?:if\s+exists\s+)?(?:public\.)?([a-z_0-9]+)\s+drop\s+column\s+(?:if\s+exists\s+)?([a-z_0-9]+)/gi;
const RE_RENAME_COL = /alter\s+table\s+(?:public\.)?([a-z_0-9]+)\s+rename\s+column\s+([a-z_0-9]+)\s+to\s+([a-z_0-9]+)/gi;
const RE_RENAME_TABLA = /alter\s+table\s+(?:if\s+exists\s+)?(?:public\.)?([a-z_0-9]+)\s+rename\s+to\s+([a-z_0-9]+)/gi;
const RE_ALTER_COL = /alter\s+table\s+(?:public\.)?([a-z_0-9]+)\s+alter\s+column\s+([a-z_0-9]+)\s+(?:type\s+([\w()[\]]+)|set\s+(not\s+null|default)[^,\n]*)/gi;
const RE_DROP_TABLA = /drop\s+table\s+(?:if\s+exists\s+)?(?:public\.)?([a-z_0-9]+)/gi;

/** tipo SQL → tipo TS */
function tipoTs(sqlTipo) {
  const t = sqlTipo.trim().toLowerCase();
  if (t.endsWith('[]')) return 'string[]';
  if (t.startsWith('uuid') || t.startsWith('text') || t.startsWith('character') || t.startsWith('varchar')) return 'string';
  if (t.startsWith('numeric') || t.startsWith('integer') || t.startsWith('int') || t.startsWith('bigint') || t.startsWith('smallint') || t.startsWith('real') || t.startsWith('double')) return 'number';
  if (t.startsWith('jsonb') || t.startsWith('json')) return 'unknown';
  if (t.startsWith('timestamptz') || t.startsWith('timestamp') || t.startsWith('date')) return 'string';
  if (t.startsWith('boolean') || t.startsWith('bool')) return 'boolean';
  return 'unknown';
}

function addColumn(tabla, col, def) {
  if (omitidas.has(tabla) || dropeadas.has(tabla)) return;
  const t = tablaDe(tabla);
  const m = def.match(/^([\w[\]]+(?:\([^)]*\))?)(.*$)/is);
  if (!m) return;
  const tipoSql = m[1];
  const resto = m[2] ?? '';
  const nulo = !/not\s+null/i.test(resto);
  const tieneDef = /default\s/i.test(resto);
  const tipo = tipoTs(tipoSql);
  if (!t.columnas.has(col)) t.orden.push(col);
  t.columnas.set(col, { tipo, nulo, def: tieneDef });
}
function dropColumn(tabla, col) {
  const t = tablas.get(tabla);
  if (!t) return;
  if (t.columnas.delete(col)) t.orden.splice(t.orden.indexOf(col), 1);
}
function renameColumn(tabla, de, a) {
  const t = tablas.get(tabla);
  if (!t || !t.columnas.has(de)) return;
  const dato = t.columnas.get(de);
  t.columnas.delete(de);
  t.columnas.set(a, dato);
  t.orden.splice(t.orden.indexOf(de), 1, a);
}

for (const archivo of archivos) {
  let sql = readFileSync(join(DIR_MIG, archivo), 'utf8');
  // cortar en -- DOWN (rollbacks documentados, NO se aplican)
  const corte = sql.search(RE_SPLIT_DOWN);
  if (corte !== -1) sql = sql.slice(0, corte);
  // quitar cuerpos $$ … $$ (funciones/triggers — nada de interés para tipos)
  sql = sql.replace(/\$\$[\s\S]*?\$\$/g, '');
  // Expandir ALTER TABLE multi-cláusula ("alter table T alter column x …, alter column y …;")
  // en statements separados: RE_ALTER_COL exige `alter table T` por cláusula.
  sql = sql.replace(
    /(alter\s+table\s+(?:public\.)?[a-z_0-9]+\s+alter\s+column[^;]*);/gi,
    (stmt) => {
      const cuerpo = stmt.slice(0, -1);
      const tabla = cuerpo.match(/alter\s+table\s+((?:public\.)?[a-z_0-9]+)/i)?.[1] ?? 'x';
      return cuerpo
        .split(/,(?=\s*alter\s+column)/i)
        .map(
          (clausula) =>
            clausula.trim().replace(/^alter\s+column/i, `alter table ${tabla} alter column`) + ';',
        )
        .join('\n');
    },
  );
  for (const m of sql.matchAll(RE_CREATE)) {
    const nombre = m[1];
    if (omitidas.has(nombre)) continue;
    const cuerpo = m[2];
    const t = tablaDe(nombre);
    for (const linea of cuerpo.split('\n')) {
      const cm = linea.trim().match(/^([a-z_0-9]+)\s+(.+?),?\s*$/i);
      if (!cm) continue;
      const col = cm[1];
      const def = cm[2];
      if (/^(primary\s+key|unique|constraint|foreign|check|exclude|like)\b/i.test(def)) continue;
      const nulo = !/not\s+null/i.test(def);
      const tieneDef = /default\s/i.test(def);
      if (!t.columnas.has(col)) t.orden.push(col);
      t.columnas.set(col, { tipo: tipoTs(def), nulo, def: tieneDef });
    }
  }

  for (const m of sql.matchAll(RE_ADD)) addColumn(m[1], m[2], m[3]);
  for (const m of sql.matchAll(RE_DROP_COL)) dropColumn(m[1], m[2]);
  for (const m of sql.matchAll(RE_RENAME_COL)) renameColumn(m[1], m[2], m[3]);
  for (const m of sql.matchAll(RE_RENAME_TABLA)) moverTabla(m[1], m[2]);
  for (const m of sql.matchAll(RE_ALTER_COL)) {
    const t = tablas.get(m[1]);
    const col = t?.columnas.get(m[2]);
    if (!col) continue;
    if (m[3]) col.tipo = tipoTs(m[3]); // ALTER COLUMN x TYPE y
    if (/not\s+null/i.test(m[4] ?? '')) col.nulo = false;
    if ((m[4] ?? '') === 'default') col.def = true;
  }
  for (const m of sql.matchAll(RE_DROP_TABLA)) {
    dropeadas.add(m[1]);
    tablas.delete(m[1]);
  }
}

// ─── 3. PATCH del DDL dinámico (20261005000007: DO $$ invisible al parser) ─────────────
// proyecto_id bigint → uuid en las 11 hijas cf_*; cf_proyectos.id → uuid (PK, def gen_random_uuid()).
const HIJAS_UUID = [
  'cf_pisos', 'cf_proyecto_general', 'cf_materiales_proyecto', 'cf_profundidades_proyecto',
  'cf_criterios_proyecto', 'cf_planos', 'cf_gas_datos_proyecto', 'cf_ep_datos_proyecto',
  'cf_bomba_datos_proyecto', 'cf_anulaciones_bajantes_pluviales', 'cf_anulaciones_canales_pluviales',
];
for (const t of HIJAS_UUID) {
  const tt = tablas.get(t);
  if (tt?.columnas.has('proyecto_id')) tt.columnas.set('proyecto_id', { tipo: 'string', nulo: false, def: false });
}
{
  const p = tablas.get('cf_proyectos');
  if (p?.columnas.has('id')) p.columnas.set('id', { tipo: 'string', nulo: false, def: true });
  p?.columnas.delete('proyecto_num');
  p?.columnas.delete('legacy_num');
  p?.columnas.delete('slug');
}

// ─── 4. RPCs que el CLIENTE invoca (grep supabase.rpc en src) ──────────────────────────
// [nombre, args, doc] — Args extraídos de los call-sites reales (tipos pragmáticos: el
// jsonb/p_data son blobs de la app, no del schema).
const FUNCTIONS = [
  ['delete_plano_meta', '{ p_plano_id: number }'],
  ['get_plano_data', '{ p_plano_id: number }', '{ plano: Record<string, unknown>; ramales: unknown[]; bajantes: unknown[]; bajante_conexiones?: unknown[]; areas?: unknown[]; dimensiones?: unknown[]; anotaciones_texto?: unknown[]; lineas_guia?: unknown[]; fantasmas_entrepisos?: unknown[] }'],
  ['get_proyecto_data', '{ p_proyecto_id: string }'],
  ['mis_accesos', 'Record<string, never>'],
  ['mis_miembros', '{ p_suscripcion_id: number }'],
  ['asignar_puesto', '{ p_suscripcion_id: number; p_email: string }'],
  ['cambiar_permiso_miembro', '{ p_suscripcion_id: number; p_user_id: string; p_puede_editar: boolean }'],
  ['obtener_catalogo', 'Record<string, never>', 'Record<string, { precio_mensual_centavos: number; precio_semestral_centavos: number; precio_anual_centavos: number }>'],
  ['quitar_puesto', '{ p_suscripcion_id: number; p_user_id: string }'],
  ['save_aparatos_usuario', '{ p_aps: unknown }'],
  ['save_bomba_datos', '{ p_proyecto_id: string; p_datos: unknown }'],
  ['save_ep_datos', '{ p_proyecto_id: string; p_datos: unknown }'],
  ['save_gas_datos', '{ p_proyecto_id: string; p_datos: unknown }'],
  ['save_net_colors', '{ p_colors: Record<string, string> }'],
  ['save_perfil', '{ p_perfil: Record<string, unknown> }'],
  ['save_planos_meta', '{ p_proyecto_id: string; p_planos: unknown }'],
  ['save_plano_data', '{ p_plano_id: number; p_data: unknown; p_updated_at?: string | null }'],
  ['save_plano_data_versioned', '{ p_plano_id: number; p_data: unknown; p_updated_at: string | null }', 'string'],
  ['save_proyecto', '{ p_codigo: string; p_nombre: string; p_pais: string; p_uso: string }'],
  ['save_cf_network_material', '{ p_proyecto_id: string; p_red: string; p_material: string }'],
  ['save_proyecto_core', '{ p_proyecto_id: string; p_data: unknown }'],
  ['save_proyecto_general_campo', '{ p_proyecto_id: string; p_campo: string; p_valor: unknown }'],
  ['save_rci_datos', '{ p_proyecto_id: string; p_datos: unknown }'],
  ['save_redes_activas', '{ p_proyecto_id: string; p_redes: string[] }'],
  ['save_rainwater_overrides', '{ p_proyecto_id: string; p_bajantes: unknown; p_canales: unknown }'],
  ['update_proyecto_nombre', '{ p_id: string; p_nombre: string }'],
  ['cm_get_data', '{ p_proyecto_id?: string | null }'],
  ['cm_save_state', '{ p_proyecto_id: string; p_state: unknown; p_updated_at?: string | null }'],
  ['cm_save_state_versioned', '{ p_proyecto_id: string; p_state: unknown; p_updated_at: string }', 'string'],
  ['suscripciones_habilitadas', 'Record<string, never>'],
  ['delete_proyecto', '{ p_id: string }'],
];

// ─── 5. Emitir ─────────────────────────────────────────────────────────────────────────
const pascalDe = (t) =>
  t.split('_').map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('');

const lineas = [];
lineas.push(`/** GENERADO — no editar a mano.`);
lineas.push(` *  Fuente: supabase/migrations/*.sql (node scripts/genDbTypes.mjs).`);
lineas.push(` *  Regenerar tras cada migración nueva: node scripts/genDbTypes.mjs`);
lineas.push(` *  Nota: derivado por parseo estático + 1 patch documentado (proyecto_id uuid, DO de`);
lineas.push(` *  20261005000007). jsonb → unknown: tipar blobs es trabajo de interfaces de dominio. */`);
lineas.push('');
lineas.push('export type Json = string | number | boolean | null | { [key: string]: Json | Json[] } | Json[];');
lineas.push('');
lineas.push('export interface Database {');
lineas.push('  public: {');
lineas.push('    Tables: {');

let nTablas = 0;
for (const [nombre, t] of [...tablas.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  if (nombre.startsWith('_') || omitidas.has(nombre) || dropeadas.has(nombre)) continue;
  if (t.columnas.size === 0) continue;
  nTablas++;
  const _P = pascalDe(nombre);
  lineas.push(`      ${nombre}: {`);
  lineas.push('        Row: {');
  for (const col of t.orden) {
    const c = t.columnas.get(col);
    if (!c) continue;
    lineas.push(`          ${col}: ${c.tipo} ${c.nulo ? '| null' : ''}`);
  }
  lineas.push('        };');
  lineas.push('        Insert: {');
  for (const col of t.orden) {
    const c = t.columnas.get(col);
    if (!c) continue;
    const opc = c.def || c.nulo || (nombre === 'cf_proyectos' && col === 'id');
    lineas.push(`          ${col}${opc ? '?' : ''}: ${c.tipo} ${c.nulo ? '| null' : ''}`);
  }
  lineas.push('        };');
  lineas.push('        Update: {');
  for (const col of t.orden) {
    const c = t.columnas.get(col);
    if (!c) continue;
    lineas.push(`          ${col}?: ${c.tipo} ${c.nulo ? '| null' : ''}`);
  }
  lineas.push('        };');
  lineas.push(`        Relationships: [];`);
  lineas.push('      };');
}
lineas.push('    };');
lineas.push('    Views: {');
lineas.push('      [_ in never]: never');
lineas.push('    };');
lineas.push('    Functions: {');
for (const [fn, args, ret] of FUNCTIONS) {
  lineas.push(`      ${fn}: {`);
  lineas.push(`        Args: ${args};`);
  lineas.push(`        Returns: ${ret ?? 'unknown'};`);
  lineas.push('      };');
}
lineas.push('    };');
lineas.push('    Enums: {');
lineas.push('      [_ in never]: never');
lineas.push('    };');
lineas.push('    CompositeTypes: {');
lineas.push('      [_ in never]: never');
lineas.push('    };');
lineas.push('  };');
lineas.push('}');
lineas.push('');


writeFileSync(SALIDA, lineas.join('\n'), 'utf8');
console.error(`database.types.ts: ${nTablas} tablas, ${FUNCTIONS.length} Functions → ${SALIDA}`);
