import { devError } from '../../../../utils/devError.ts';
import { origenDe } from '../shared/geometry';
import type { IPlanoEngineCore, PlanoRamal } from './PlanoState.ts';
import { flipRamalFlow } from './drawingFlow.ts';
import { entradasSalidas, extremoLejanoTipo, REDES_PRESION } from './nodos';

/** Re-enraizado de sentido: cuando un ramal nuevo llega a una unión que ya tenía dueño, el
 *  sentido de la tubería vieja puede quedar al revés — aquí se corrige (todo dentro de UN solo
 *  Ctrl+Z). */

/** La inversión de una red de presión (af/ac/gas/rci/vent) solo prende `_tribReversed` (flag de flujo invertido en tributario); las de gravedad (san/ll) voltean pts. */
function usaFlag(net: string): boolean {
  return net !== 'san' && net !== 'll';
}

/** Le da la vuelta al flujo de un tramo: en redes a presión solo prende/apaga _tribReversed; en
 *  sanitarias y lluvias invierte los puntos de verdad. */
function invertirTramo(ram: PlanoRamal): void {
  if (usaFlag(ram.net || '')) ram._tribReversed = !ram._tribReversed;
  else flipRamalFlow(ram);
}

function destinoDe(r: PlanoRamal): number[] {
  return r._tribReversed ? (r.pts![0] as number[]) : (r.pts![r.pts!.length - 1] as number[]);
}

/** En este punto, ¿el tramo ENTREGA agua o se la lleva? null = el tramo no toca el punto. */
function tocaComo(r: PlanoRamal, pt: number[], tol = 0.5): 'entra' | 'sale' | null {
  const dO = Math.hypot(origenDe(r)[0] - pt[0], origenDe(r)[1] - pt[1]);
  const dD = Math.hypot(destinoDe(r)[0] - pt[0], destinoDe(r)[1] - pt[1]);
  if (dD < tol) return 'entra';
  if (dO < tol) return 'sale';
  return null;
}

/** Camina hacia atrás desde un tramo volteando el sentido de cada tubería hasta llegar a la
 *  fuente (el medidor, el calentador, el equipo...). Si aborta (ciclo, dos fuentes o tope),
 *  DESHACE todo lo volteado: el dibujo queda como estaba. */
function reEnraizarDesde(engine: IPlanoEngineCore, idInicial: string): string[] | null {
  const net = engine.ramales.find((r) => r.id === idInicial)?.net || '';
  const invertidos: string[] = [];
  let cur = idInicial;
  const vistos = new Set<string>([cur]);
  const abortar = (motivo: string): null => {
    // Deshacer TODAS las inversiones tocadas: la red queda como antes del re-enraizamiento.
    for (const id of invertidos) {
      const r = engine.ramales.find((x) => x.id === id);
      if (r) invertirTramo(r);
    }
    devError(`reEnraizarDesde abortó (${motivo}) — se revirtieron ${invertidos.length} tramos`);
    return null;
  };
  while (invertidos.length <= engine.ramales.length) {
    const r = engine.ramales.find((x) => x.id === cur);
    if (!r) return abortar('id inexistente');
    invertirTramo(r);
    invertidos.push(cur);
    // Extremo lejano (tras invertir, el origen quedó donde antes estaba el destino).
    const origen = origenDe(r);
    // ¿Llegamos a una FUENTE? Fin del camino (correcto).
    if (extremoLejanoTipo(engine, r, origen, 0.5) === 'FUENTE') return invertidos;
    // Buscar el nodo del extremo lejano: otro tramo que ANTES entraba ahí (ahora, tras
    // nuestra inversión, ese nodo quedó sin entrada por este tramo — hay que corregirlo).
    const { ent } = entradasSalidas(engine, net, origen, 0.5);
    if (ent >= 1) return invertidos; // el nodo aguas arriba sigue alimentado: fin
    // Buscar el tramo vecino que tocaba este extremo para invertirlo y seguir.
    let nxt: string | null = null;
    for (const r2 of engine.ramales) {
      if (r2.net !== r.net || r2.id === r.id || !r2.pts || r2.pts.length < 2) continue;
      for (const e of [r2.pts![0] as number[], r2.pts![r2.pts!.length - 1] as number[]]) {
        if (Math.hypot(e[0] - origen[0], e[1] - origen[1]) < 0.5) {
          nxt = r2.id;
          break;
        }
      }
      if (nxt) break;
    }
    if (!nxt) return abortar('hoja sin alimentación');
    if (vistos.has(nxt)) return abortar('ciclo');
    vistos.add(nxt);
    cur = nxt;
  }
  return abortar('tope de iteraciones');
}

/** Resultado del choque de sentidos: qué trazo quedó como dueño ('nuevo'/'existente') y los ids de los tramos que se voltearon (para un solo Ctrl+Z). */
export interface ResolucionSentido {
  accion: 'nuevo' | 'existente';
  invertidos: string[];
}

/** ¿El ramal nuevo llega ENTREGANDO agua a una unión que ya tenía su entrada? Ese es el choque de
 *  2 entradas que hay que resolver. */
export function conflictoDosEntradas(
  engine: IPlanoEngineCore,
  ep: number[],
  incoming: PlanoRamal,
  net: string,
  tol = 0.5,
): boolean {
  if (!REDES_PRESION.has(net)) return false;
  const como = tocaComo(incoming, ep, tol);
  if (como !== 'entra') return false;
  const { ent } = entradasSalidas(engine, net, ep, tol);
  return ent > 1;
}

/** Resuelve el choque de 2 entradas con las reglas del memo: gana el que llega a un aparato o
 *  viene de una fuente. Si ninguna aplica (regla 5), le pregunta al usuario.
 *  @returns la acción ejecutada, o null si se canceló. */
export function resolverConflictoSentido(
  engine: IPlanoEngineCore,
  ep: number[],
  incoming: PlanoRamal,
  existente: PlanoRamal,
  preguntar: () => Promise<'nuevo' | 'existente' | null>,
): Promise<ResolucionSentido | null> {
  return (async () => {
    // Extremo lejano del entrante = su ORIGEN (entra por el destino ep).
    const farNuevo = origenDe(incoming);
    // Extremo lejano del existente A = su PUNTO LEJANO a ep (la parte que conservó).
    const d0 = Math.hypot(
      (existente.pts![0] as number[])[0] - ep[0],
      (existente.pts![0] as number[])[1] - ep[1],
    );
    const farA =
      d0 > 0.5
        ? (existente.pts![0] as number[])
        : (existente.pts![existente.pts!.length - 1] as number[]);
    const tNuevo = extremoLejanoTipo(engine, incoming, farNuevo, 0.5);
    const tA = extremoLejanoTipo(engine, existente, farA, 0.5);

    const regla = (() => {
      if (tNuevo === 'APARATO') return 'nuevo' as const; // regla 1
      if (tNuevo === 'FUENTE') return 'existente' as const; // regla 2
      if (tA === 'APARATO') return 'existente' as const; // regla 3
      if (tA === 'FUENTE') return 'nuevo' as const; // regla 4
      return null; // regla 5: preguntar
    })();

    const eleccion = regla ?? (await preguntar());
    if (!eleccion) return null;

    engine.pauseHistory?.();
    try {
      let invertidos: string[] = [];
      if (eleccion === 'nuevo') {
        invertirTramo(incoming);
        invertidos = [incoming.id];
      } else {
        const r = reEnraizarDesde(engine, existente.id);
        if (r === null) {
          engine.triggerAlert(
            'No se pudo corregir el sentido',
            'El re-enraizamiento llegó a dos fuentes o un ciclo. Se revirtió — revisa el sentido a mano.',
          );
          return null;
        }
        invertidos = r;
      }
      return { accion: eleccion, invertidos };
    } finally {
      engine.resumeHistory?.();
      engine._markDirty();
    }
  })();
}
