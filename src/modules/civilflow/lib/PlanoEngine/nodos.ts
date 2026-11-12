import type { IPlanoEngineCore, PlanoRamal } from './PlanoState.ts';
import { pointToSegmentDist } from './HitTester.ts';

/** Revisión de las tuberías a presión (el agua empuja, no cae sola): af (Agua Fría), ac (Agua
 *  Caliente), gas (Gas) y rci (Red Contra Incendio). Cada tramo debe tener por dónde le LLEGA
 *  el agua y por dónde SALE; aquí se detecta lo que quedó mal conectado. */

/** Qué hay en el extremo de un ramal: APARATO (llega a un inodoro, un lavamanos...), FUENTE
 *  (medidor, calentador, equipo de presión), NODO (se une a otros ramales) o LIBRE (la punta no
 *  conecta con nada). */
type ExtremoTipo = 'APARATO' | 'FUENTE' | 'NODO' | 'LIBRE';

/** Un problema hallado en la revisión de la red: nivel error (rompe el diseño) o adv (advertencia), de qué tipo y en qué ramal. */
interface Incidencia {
  nivel: 'error' | 'adv';
  tipo: string;
  ramalId: string;
  msg: string;
}

/** Las redes que se revisan con estas reglas (todas trabajan a presión). */
export const REDES_PRESION = new Set(['af', 'ac', 'gas', 'rci']);

/** Los elementos que hacen de "llegada del servicio" (fuente): el medidor, el calentador, el
 *  equipo de presión o la bajada de un montante del piso de arriba. La red arranca en uno de
 *  estos y sin ellos un extremo suelto es sospechoso. */
export const FUENTE_TIPOS = new Set(['red_publica', 'contador', 'calentador', 'montante', 'bomba']);

/** A veces la fuente no es un elemento del plano sino una anotación en el extremo del ramal
 *  (ini/fin = 'CNTAF-1', 'CALENT...'): estas siglas también delatan una fuente. */
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

/** ¿Toca este punto una fuente (medidor, calentador, montante, bomba)? Tol en pixels de plano. */
function fuenteEnPt(engine: IPlanoEngineCore, net: string, pt: number[], tol = 1): boolean {
  for (const b of engine.bajantes) {
    if (!FUENTE_TIPOS.has(b.tipo || '')) continue;
    if (b.net && b.net !== net) continue;
    if (b.x != null && b.y != null && Math.hypot(b.x - pt[0], b.y - pt[1]) <= tol) return true;
  }
  return false;
}

/** Cuenta, en una unión, cuántos ramales ENTREGAN agua y cuántos se la llevan. Un ramal que solo
 *  pasa de largo por el punto suma una entrada Y una salida. Respeta _tribReversed (ramal dibujado
 *  al revés de su flujo real). */
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

/** Clasifica el extremo de un ramal según lo que haya ahí (APARATO / FUENTE / NODO / LIBRE). */
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

/** Revisa TODA una red a presión y devuelve la lista de problemas encontrados: tramos que SALEN
 *  de un aparato (el agua debe entrar en él). (El chequeo de ciclos/mallas se retiró — ped.
 *  usuario.) */
export function chequearRed(engine: IPlanoEngineCore, net: string): Incidencia[] {
  const ramales = ramalesDe(engine, net);
  const inc: Incidencia[] = [];
  if (ramales.length === 0) return inc;

  // ── Sale de aparato / entra a fuente ──
  for (const r of ramales) {
    const aparatoOrigen = r._tribReversed ? r.aparatoFin : r.aparatoInicio;
    if (aparatoOrigen) {
      inc.push({
        nivel: 'error',
        tipo: 'sale-de-aparato',
        ramalId: r.id,
        msg: `${r.id}: el tramo SALE de un aparato (${aparatoOrigen}) — debe entrar a él.`,
      });
    }
    // 'entra-a-fuente' retirada (orig. usuario): un montante SÍ puede recibir un trazo
    // (la alimentación llega a él); no es incidencia.
  }

  return inc;
}

/** Antes de dejar un trazo nuevo en el plano, lo rechaza si sale de un aparato. (El chequeo de
 *  ciclos/mallas se retiró — ped. usuario.) Devuelve el motivo (null = el trazo es válido). */
export function validarTrazoPresion(ram: PlanoRamal): string | null {
  if (!REDES_PRESION.has(ram.net || '')) return null;

  // 1) dirección vs aparato/fuente en este tramo
  const aparatoOrigen = ram._tribReversed ? ram.aparatoFin : ram.aparatoInicio;
  if (aparatoOrigen) {
    return `${ram.id}: el tramo SALE de un aparato (${aparatoOrigen}) — debe entrar a él.`;
  }
  // 'entra-a-fuente' retirada (orig. usuario): un montante SÍ puede recibir un trazo.

  return null;
}
