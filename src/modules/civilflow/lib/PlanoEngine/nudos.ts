import { devError } from '../../../../utils/devError';
import type { IPlanoEngineCore, PlanoRamal } from './PlanoState';
import { pointToSegmentDist } from './HitTester';

/** Chequeo global de redes de presión (docx "Lógica de sentido de flujo en nodos",
 *  fase 2): clasifica nodos (entradas/salidas), extremos (aparato/fuente/nodo/libre),
 *  ciclos y huérfanos. Se ejecuta en cada _markDirty para af/ac/gas/rci. */

export type ExtremoTipo = 'APARATO' | 'FUENTE' | 'NODO' | 'LIBRE';

export interface Incidencia {
  nivel: 'error' | 'adv';
  tipo: string;
  ramalId: string;
  msg: string;
}

/** Redes de presión sujetas al chequeo de nodos. */
export const REDES_PRESION = new Set(['af', 'ac', 'gas', 'rci']);

/** Tipos de bajante que actúan como FUENTE (docx: medidor, calentador, tanque, equipo o
 *  llegada de montante — la llegada de montante a cada piso se trata como fuente). */
const FUENTE_TIPOS = new Set(['red_publica', 'contador', 'calentador', 'montante', 'bomba']);

/** Prefijos de código de fuente (para ramales cuyo extremo lleva la sigla escrita). */
const FUENTE_PFX = ['RP', 'CNT', 'cntAF', 'CALENT', 'BOMAN'];

function esFuenteCode(code: string | undefined): boolean {
  if (!code) return false;
  return FUENTE_PFX.some((p) => code.startsWith(p));
}

/** Distancia de un punto al extremo dado de un ramal. */
function distExtremo(r: PlanoRamal, i0: 0 | -1, pt: number[]): number {
  const p = r.pts?.[i0 < 0 ? r.pts.length - 1 : 0];
  if (!p) return Infinity;
  return Math.hypot(p[0] - pt[0], p[1] - pt[1]);
}

function ramalesDe(engine: IPlanoEngineCore, net: string): PlanoRamal[] {
  return engine.ramales.filter((r) => r.net === net && r.pts && r.pts.length >= 2);
}

/** ¿Hay una FUENTE (bajante de tipo fuente o código fuente) en el punto? */
export function fuenteEnPt(engine: IPlanoEngineCore, net: string, pt: number[], tol = 1): boolean {
  for (const b of engine.bajantes) {
    if (!FUENTE_TIPOS.has(b.tipo || '')) continue;
    if (b.net && b.net !== net) continue;
    if (b.x != null && b.y != null && Math.hypot(b.x - pt[0], b.y - pt[1]) <= tol) return true;
  }
  return false;
}

/** Entradas y salidas de flujo en un punto (docx: clasificar entran/salen). */
export function entradasSalidas(
  engine: IPlanoEngineCore,
  net: string,
  pt: number[],
  tol = 0.5,
): { ent: number; sal: number; total: number } {
  let ent = 0;
  let sal = 0;
  for (const r of ramalesDe(engine, net)) {
    const ends = [
      { pt: r.pts![0] as number[], esIni: true },
      { pt: r.pts![r.pts!.length - 1] as number[], esIni: false },
    ];
    let tocaExtremo = false;
    let atraviesa = false;
    for (const e of ends) {
      if (Math.hypot(e.pt[0] - pt[0], e.pt[1] - pt[1]) < tol) {
        tocaExtremo = true;
        const logicoFin = r._tribReversed ? e.esIni : !e.esIni;
        if (logicoFin) ent += 1;
        else sal += 1;
      }
    }
    if (!tocaExtremo) {
      for (let i = 0; i < r.pts!.length - 1; i++) {
        const p1 = r.pts![i] as number[];
        const p2 = r.pts![i + 1] as number[];
        if (pointToSegmentDist(pt[0], pt[1], p1[0], p1[1], p2[0], p2[1]) < tol) {
          atraviesa = true; // el flujo pasa de largo: entra y sale
          break;
        }
      }
    }
    if (atraviesa) {
      ent += 1;
      sal += 1;
    }
    void tocaExtremo;
  }
  return { ent, sal, total: ent + sal };
}

/** Clasifica el EXTREMO lejano de un ramal (docx: APARATO/FUENTE/NODO/LIBRE). */
export function extremoLejanoTipo(
  engine: IPlanoEngineCore,
  ram: PlanoRamal,
  pt: number[],
  tol = 0.5,
): ExtremoTipo {
  // APARATO: campo de aparato en el extremo que coincide con pt.
  if (
    (distExtremo(ram, 0, pt) < tol && ram.aparatoInicio) ||
    (distExtremo(ram, -1, pt) < tol && ram.aparatoFin)
  ) {
    return 'APARATO';
  }
  // FUENTE: bajante de tipo fuente o código de fuente escrito en el extremo.
  if (fuenteEnPt(engine, ram.net || '', pt, tol)) return 'FUENTE';
  const ends = [ram.pts?.[0] as number[], ram.pts?.[ram.pts.length - 1] as number[]];
  for (const e of ends) {
    if (!e) continue;
    if (Math.hypot(e[0] - pt[0], e[1] - pt[1]) >= tol) continue;
    const ini = String(ram.ini || '');
    const fin = String(ram.fin || '');
    if (esFuenteCode(ini) || esFuenteCode(fin)) return 'FUENTE';
  }
  // NODO: ≥2 EXTREMOS de OTROS ramales de la red aterrizan en el punto.
  let extremosAjenos = 0;
  for (const r2 of ramalesDe(engine, ram.net || '')) {
    if (r2.id === ram.id) continue;
    for (const e of [r2.pts![0] as number[], r2.pts![r2.pts!.length - 1] as number[]]) {
      if (Math.hypot(e[0] - pt[0], e[1] - pt[1]) < tol) extremosAjenos += 1;
    }
  }
  if (extremosAjenos >= 1) return 'NODO';
  return 'LIBRE';
}

/** Puntos de unión y extremos de la red (clusters ≤ tol). */
function clustersDe(ramales: PlanoRamal[], tol = 0.5): { pt: number[]; ids: string[] }[] {
  const out: { pt: number[]; ids: string[] }[] = [];
  for (const r of ramales) {
    for (const e of [r.pts![0] as number[], r.pts![r.pts!.length - 1] as number[]]) {
      const hit = out.find((c) => Math.hypot(c.pt[0] - e[0], c.pt[1] - e[1]) <= tol);
      if (hit) hit.ids.push(r.id);
      else out.push({ pt: [e[0], e[1]], ids: [r.id] });
    }
  }
  return out;
}

/** Chequeo global de una red de presión. Devuelve incidencias (docx tabla de fase 2). */
export function chequearRed(engine: IPlanoEngineCore, net: string, tol = 0.5): Incidencia[] {
  const ramales = ramalesDe(engine, net);
  const inc: Incidencia[] = [];
  if (ramales.length === 0) return inc;

  const clusters = clustersDe(ramales, tol);

  // ── Sale de aparato / entra a fuente ──
  for (const r of ramales) {
    const origen = r._tribReversed
      ? (r.pts![r.pts!.length - 1] as number[])
      : (r.pts![0] as number[]);
    const destino = r._tribReversed
      ? (r.pts![0] as number[])
      : (r.pts![r.pts!.length - 1] as number[]);
    const aparatoOrigen = r._tribReversed ? r.aparatoFin : r.aparatoInicio;
    if (aparatoOrigen) {
      inc.push({
        nivel: 'error',
        tipo: 'sale-de-aparato',
        ramalId: r.id,
        msg: `${r.id}: el tramo SALE de un aparato (${aparatoOrigen}) — debe entrar a él.`,
      });
    }
    if (
      fuenteEnPt(engine, net, destino, 1) ||
      esFuenteCode(r._tribReversed ? String(r.ini || '') : String(r.fin || ''))
    ) {
      inc.push({
        nivel: 'error',
        tipo: 'entra-a-fuente',
        ramalId: r.id,
        msg: `${r.id}: el tramo ENTRA a una fuente — de donde el agua debe salir, no llegar.`,
      });
    }
    void origen;
    void destino;
  }

  // ── Ciclo no declarado: DFS sobre clusters (arista = ramal que une 2 clusters) ──
  const mallas = (engine as { mallasDeclaradas?: Set<string> }).mallasDeclaradas;
  const declarada = mallas?.has(net) ?? false;
  if (!declarada) {
    // aristas: ramal con extremos en 2 clusters distintos
    const aristas: { a: number; b: number; id: string }[] = [];
    ramales.forEach((r, ri) => {
      const a = clusters.findIndex(
        (c) =>
          Math.hypot(c.pt[0] - (r.pts![0] as number[])[0], c.pt[1] - (r.pts![0] as number[])[1]) <=
          tol,
      );
      const b = clusters.findIndex(
        (c) =>
          Math.hypot(
            c.pt[0] - (r.pts![r.pts!.length - 1] as number[])[0],
            c.pt[1] - (r.pts![r.pts!.length - 1] as number[])[1],
          ) <= tol,
      );
      if (a >= 0 && b >= 0 && a !== b) aristas.push({ a, b, id: ralesId(ramales, ri) });
    });
    const adj: number[][] = clusters.map(() => []);
    aristas.forEach((ar, i) => {
      adj[ar.a].push(i);
      adj[ar.b].push(i);
    });
    const visit = new Array(clusters.length).fill(false);
    const parentEdge = new Array(clusters.length).fill(-1);
    let ciclo: { a: number; b: number; id: string } | null = null;
    const dfs = (u: number): void => {
      visit[u] = true;
      for (const ei of adj[u]) {
        const v = aristas[ei].a === u ? aristas[ei].b : aristas[ei].a;
        if (!visit[v]) {
          parentEdge[v] = ei;
          dfs(v);
        } else if (parentEdge[u] !== ei && !ciclo) {
          ciclo = aristas[ei];
        }
      }
    };
    for (let c = 0; c < clusters.length && !ciclo; c++) if (!visit[c]) dfs(c);
    if (ciclo) {
      const cinfo = ciclo as { a: number; b: number; id: string };
      inc.push({
        nivel: 'error',
        tipo: 'ciclo',
        ramalId: cinfo.id,
        msg: `Ciclo en la red (tramo ${cinfo.id} cierra el lazo). Si es intencional, decláralo como malla/recirculación en el menú del tramo.`,
      });
    }
  }

  return inc;
}

function ralesId(ramales: PlanoRamal[], i: number): string {
  return ramales[i]?.id || '';
}

/** Lee las redes declaradas (malla) de un plan. */
export function cargarMallas(planId: string | number | null): Set<string> {
  try {
    const raw = localStorage.getItem(mallasKey(planId));
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

/** Persiste las redes declaradas de un plan. */
export function guardarMallas(planId: string | number | null, redes: Set<string>): void {
  try {
    localStorage.setItem(mallasKey(planId), JSON.stringify([...redes]));
  } catch (e) {
    devError('guardarMallas:', e);
  }
}

/** Clave de storage de mallas declaradas por planId. */
export function mallasKey(planId: string | number | null): string {
  return `civilflow_mallas_${planId ?? 'x'}`;
}

/** Valida el trazo NUEVO de una red de presión ANTES de dejarlo dibujado (finishRamal).
 *  Devuelve el motivo de rechazo o null si pasa. Verifica SOLO:
 *  1) sale-de-aparato: el flujo arranca en un aparato (debe entrar a él);
 *  2) entra-a-fuente: termina en contador/fuente (de ahí sale el fluido);
 *  3) ciclo: cierra un lazo y la red no tiene malla declarada.
 *  El ramal DEBE estar ya agregado a engine.ramales (el caller lo retira si hay motivo). */
export function validarTrazoPresion(engine: IPlanoEngineCore, ram: PlanoRamal): string | null {
  if (!REDES_PRESION.has(ram.net || '')) return null;

  // 1) dirección vs aparato/fuente en este tramo
  const aparatoOrigen = ram._tribReversed ? ram.aparatoFin : ram.aparatoInicio;
  if (aparatoOrigen) {
    return `${ram.id}: el tramo SALE de un aparato (${aparatoOrigen}) — debe entrar a él.`;
  }
  const destinoLogico = ram._tribReversed ? String(ram.ini || '') : String(ram.fin || '');
  const ptDestino = ram._tribReversed
    ? (ram.pts![0] as number[])
    : (ram.pts![ram.pts!.length - 1] as number[]);
  if (esFuenteCode(destinoLogico) || fuenteEnPt(engine, ram.net || '', ptDestino, 1)) {
    return `${ram.id}: el tramo ENTRA a una fuente — de ahí sale el fluido, no hacia ahí.`;
  }

  // 2) ciclo no declarado (DFS sobre clusters, igual que chequearRed)
  const ramales = ramalesDe(engine, ram.net || '');
  const clusters = clustersDe(ramales, 0.5);
  const mallas = (engine as { mallasDeclaradas?: Set<string> }).mallasDeclaradas;
  if (!(mallas?.has(ram.net || '') ?? false)) {
    const idxDe = (pt: number[]): number =>
      clusters.findIndex((c) => Math.hypot(c.pt[0] - pt[0], c.pt[1] - pt[1]) <= 0.5);
    const aristas: { a: number; b: number; id: string }[] = [];
    ramales.forEach((r) => {
      const a = idxDe(r.pts![0] as number[]);
      const b = idxDe(r.pts![r.pts!.length - 1] as number[]);
      if (a >= 0 && b >= 0 && a !== b) aristas.push({ a, b, id: r.id });
    });
    const adj: number[][] = clusters.map(() => []);
    aristas.forEach((ar, i) => {
      adj[ar.a].push(i);
      adj[ar.b].push(i);
    });
    const visit = new Array(clusters.length).fill(false);
    const parentEdge = new Array(clusters.length).fill(-1);
    let ciclo: string | null = null;
    const dfs = (u: number): void => {
      visit[u] = true;
      for (const ei of adj[u]) {
        const v = aristas[ei].a === u ? aristas[ei].b : aristas[ei].a;
        if (!visit[v]) {
          parentEdge[v] = ei;
          dfs(v);
        } else if (parentEdge[u] !== ei && !ciclo) {
          ciclo = aristas[ei].id;
        }
      }
    };
    for (let c = 0; c < clusters.length && !ciclo; c++) if (!visit[c]) dfs(c);
    if (ciclo) {
      return `Ciclo en la red (tramo ${ciclo} cierra el lazo). Si es intencional, decláralo como malla/recirculación en el menú del tramo.`;
    }
  }
  return null;
}
