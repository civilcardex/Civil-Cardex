/**
 * Verificaciones de dibujo (piso activo del visor): distancia MÍNIMA del centro de cada
 * rociador estándar al muro (0,10 m, NFPA 13) y el CRUCE de tubería con muro (§9.5.3). La DMR
 * (distancia MÁXIMA a muro) ya NO se verifica en esta tabla (ped. usuario 2026-11-27): se
 * chequea SOLO en el dibujo, en vivo al crear/mover el ramal (RCIAutoDraw.chequeoMurosTrazo).
 * Ej: centro a 0,05 m del muro → "1 de 1 rociador(es) pegados" en NO CUMPLE.
 */
import { fmtEs as f1 } from '../fmtEs.ts';
import { distToSegment, segmentosSeCruzan, MIN_MURO_M } from '../../shared/geometry.ts';
import type { CentroRociador, ChecksCtx } from './helpers';

/** Norma y doctrina compartidas por las dos filas de muro. */
const NORMA =
  'NFPA 13-2025 §§9.5.3 y 10.2.6 — centro del rociador estándar (colgante/montante) a ≥ 0,10 m del muro. Círculos de radio S = guía visual.';

/** Distancia perpendicular del centro al muro más cercano (m). Sin muros → Infinity. */
function distanciaCentroMuro(c: CentroRociador, muros: number[][][]): number {
  let mejor = Infinity;
  for (const muro of muros) {
    for (let i = 0; i < muro.length - 1; i++) {
      mejor = Math.min(mejor, distToSegment([c.x, c.y], muro[i], muro[i + 1]));
    }
  }
  return mejor;
}

/** Las verificaciones geométricas contra el dibujo del piso activo (rociadores/muros/ramales). */
export function verificarMurosDibujo(ctx: ChecksCtx): void {
  const { add, dibujo } = ctx;
  if (!dibujo) return;

  /* El llamador (RCIDesign) entrega los centros reales leídos de los accesorios del doc de
   * trazos: incluye inicio, fin y TODOS los accMed, es decir los rociadores sembrados en cada
   * segmento de un ramal multisegmento. Los llamadores que solo pasan ramPts usan TODOS sus
   * vértices (no solo el extremo inicial) como centros candidatos — así la DMR también se
   * verifica a lo largo de los segmentos posteriores. */
  /* H-05 (remediación 2026-11-27): `rocPts: []` es una lista EXPLÍCITAMENTE vacía (el visor
   * ya resolvió que no hay rociadores) — NO se cae a los vértices del ramal como centros
   * ficticios. El fallback a ramPts solo aplica cuando el llamador no trajo rocPts (undefined). */
  const centros: CentroRociador[] =
    dibujo.rocPts !== undefined
      ? dibujo.rocPts
      : dibujo.ramPts.flatMap((pts) =>
          pts.map((p) => ({
            x: p[0],
            y: p[1],
            tipo: 'colgante' as const,
            fluye: true,
            ramalId: '',
          })),
        );
  const estandar = centros.filter((c) => c.tipo === 'colgante' || c.tipo === 'montante');

  /* CRUCE de tubería con muro se cuenta PRIMERO: es una fila INDEPENDIENTE (§9.5.3) y esos
     muros se excluyen de la regla de distancia máxima (no se juzga dos veces lo mismo). */
  const aristas = dibujo.muros.flatMap((muro) =>
    muro.slice(1).map((b, j) => ({ a: muro[j], b, cruzada: false })),
  );
  let cruces = 0;
  for (const pts of dibujo.ramPts) {
    for (let j = 0; j < pts.length - 1; j++) {
      for (const arista of aristas) {
        if (segmentosSeCruzan(pts[j], pts[j + 1], arista.a, arista.b)) {
          cruces++;
          arista.cruzada = true;
        }
      }
    }
  }

  if (!dibujo.muros.length) return; // sin muros no hay nada que medir (la DMR vive en el dibujo)

  /* MÍNIMO (centro del rociador estándar): ni pegado ni cruzando el muro. */
  if (estandar.length) {
    const medidas = estandar.map((c) => ({ c, d: distanciaCentroMuro(c, dibujo.muros) }));
    const pegados = medidas.filter((m) => m.d < MIN_MURO_M - 1e-9);
    const menor = Math.min(...medidas.map((m) => m.d));
    add(
      'Distancia mínima ramal–muro ≥ 0,10 m',
      pegados.length ? 'NO CUMPLE' : 'CUMPLE',
      `${pegados.length} de ${estandar.length} rociador(es) pegados · menor ${f1(menor, 2)} m`,
      NORMA,
      pegados.length
        ? 'Aleje el rociador señalado del muro: la distancia mínima centro–muro es de 0,10 m.'
        : '',
      ['rociadores', 'rectangulo'],
    );
  }

  /* CRUCE de tubería con muro: fila INDEPENDIENTE (§9.5.3), no se mezcla con la distancia
     mínima del rociador. Un cruce es NO CUMPLE aunque el rociador esté bien separado. */
  add(
    'Cruce de tubería con muro',
    cruces ? 'NO CUMPLE' : 'CUMPLE',
    `${cruces} cruce(s) tubería–muro en el piso activo`,
    'NFPA 13-2025 §9.5.3 — la tubería no debe cruzar un muro marcado; se informa aparte de la distancia del rociador.',
    cruces ? 'Recorte o re-route el tramo que atraviesa el muro marcado.' : '',
    ['rociadores', 'rectangulo'],
  );
}
