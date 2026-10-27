// Derivaciones de ChequeoBajantesLluvias como funciones puras (antes useMemos inline):
// testeables sin React. Cada una construye UN mapa/columna de la tabla del chequeo.
import { leerDocDePlan } from './readPlanDrawing';
import { splitPtr } from './keys.ts';
import type { DrawingData } from './drawingSync.ts';
import { splitTramo } from './keys.ts';
import { pisoCorto } from '../constants';

/**
 * Inverso de canalAlimIds: clave de bajante `planId|id` → etiqueta del canal que lo recibe.
 * Ej: canal C1 con drawId '7' que alimenta '7|BALL1' → {'7|BALL1': 'C1'}.
 */
export function buildCanalDeBaj(
  canalesLl: { drawId?: string; sector?: string; id: string | number }[],
  canalAlimIds: Record<string, string[]>,
): Map<string, string> {
  const inv = new Map<string, string>();
  for (const c of canalesLl) {
    if (!c.drawId) continue;
    for (const combo of canalAlimIds[c.drawId] || []) {
      if (!inv.has(combo)) inv.set(combo, c.sector || String(c.id));
    }
  }
  return inv;
}

/** Área dibujada (m²) de cada bajante ll de todos los pisos: code e id apuntan al valor. */
export function buildAreaDibujoMap(
  plans: { id: number | string; nivel: number | null }[],
): Record<string, number> {
  const map: Record<string, number> = {};
  for (const plan of plans || []) {
    if (plan.nivel == null) continue;
    const data = leerDocDePlan<DrawingData>(plan.id);
    if (!data) continue;
    for (const b of data.bajantes || []) {
      if (b.net === 'll' && b.tipo !== 'canal' && b.area_m2) {
        map[b.code || b.id] = b.area_m2;
        map[b.id] = b.area_m2;
      }
    }
  }
  return map;
}

/**
 * Bajantes de pisos superiores que descargan en cada bajante (descargaEnId='plan|id' del
 * superior apunta al inferior): escaneo de todos los pisos → mapa inverso. Etiquetas con
 * sufijo de piso ('BALL1-P2'); las cajas CALL quedan fuera (no son bajantes).
 */
export function buildUppersByBajante(
  plans: { id: number | string; nivel: number | null }[],
): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const plan of plans || []) {
    if (plan.nivel == null) continue;
    const data = leerDocDePlan<DrawingData>(plan.id);
    if (!data) continue;
    const suf = pisoCorto(plan.nivel);
    for (const b of data.bajantes || []) {
      if (b.net !== 'll' || b.tipo === 'caja_ll' || !b.descargaEnId) continue;
      // Formato canónico 'plan|id'; el LEGACY sin '|' apunta al MISMO plan — sin
      // normalizarlo la columna "asociados" quedaba en — para esos datos viejos.
      const [dPlan, dId] = splitPtr(b.descargaEnId, plan.id);
      const clave = `${dPlan}|${dId}`;
      if (!map[clave]) map[clave] = [];
      const code = `${b.code || b.id}-${suf}`;
      if (!map[clave].includes(code)) map[clave].push(code);
    }
  }
  return map;
}

/**
 * Ramales que drenan a cada bajante (misma BFS que Diseño de red lluvias, invertida) con
 * etiqueta de piso ('RS1-P1'): fuera los ramales de canal y los Ldesvio (conector entre
 * pisos, no drenaje). El scoping POR PISO es obligatorio: el mismo id de bajante existe en
 * cada piso (BALL1-P1, BALL1-P2) y el find sin planId traía el de otro (incidente 2026-09-25).
 */
export function buildRamalesByBajante(
  bajanteAssociations: Record<string, string[]>,
  canalRamalKeys: Set<string>,
  tramosLl: Array<{
    esBajante?: boolean;
    code?: string;
    id?: string;
    planId?: number | string;
    _key?: string;
  }>,
  plans: { id: number | string; nivel: number | null }[],
): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  const nivelDePlan = new Map((plans || []).map((pl) => [String(pl.id), pl.nivel] as const));
  for (const [ramalKey, codes] of Object.entries(bajanteAssociations)) {
    // El id del ramal puede contener '-' (patrón AC-01-<id>): splitTramo corta por el ÚLTIMO guion.
    const [ramalId, planId] = splitTramo(ramalKey);
    const nivel = nivelDePlan.get(planId);
    const label = nivel != null ? `${ramalId}-${pisoCorto(nivel)}` : ramalId;
    if (canalRamalKeys.has(ramalKey)) continue;
    if (ramalId.startsWith('LD_')) continue;
    for (const code of codes) {
      const t = tramosLl.find(
        (x) =>
          x.esBajante && (x.code === code || x.id === code) && String(x.planId ?? '') === planId,
      );
      const k = t?._key;
      if (!k) continue;
      // Solo ramales del MISMO piso del bajante (orig. usuario).
      if (String(t.planId ?? '') !== planId) continue;
      if (!map[k]) map[k] = [];
      if (!map[k].includes(label)) map[k].push(label);
    }
  }
  return map;
}
