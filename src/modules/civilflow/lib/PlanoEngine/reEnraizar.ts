import { origenDe } from '../shared/geometry';
import type { IPlanoEngineCore, PlanoRamal } from './PlanoState';
import { flipRamalFlow } from './drawingFlow';
import { entradasSalidas, extremoLejanoTipo, REDES_PRESION } from './nudos';

/** Re-enraizamiento automático (docx fase 2, ítem 2): cuando un tramo nuevo queda
 *  ENTRANDO a una tee donde ya había alimentación, corrige los sentidos del dibujo
 *  con las reglas 1-5 y agrupa todo en un solo Ctrl+Z. */

/** ¿La red usa _tribReversed como inversión real? af/ac/gas/rci/vent SÍ; san/ll usan
 *  flip geométrico (flipRamalFlow). */
function usaFlag(net: string): boolean {
  return net !== 'san' && net !== 'll';
}

/** Invierte el sentido de flujo de un tramo (la inversión REAL de su red). */
export function invertirTramo(ram: PlanoRamal): void {
  if (usaFlag(ram.net || '')) ram._tribReversed = !ram._tribReversed;
  else flipRamalFlow(ram);
}

function destinoDe(r: PlanoRamal): number[] {
  return r._tribReversed ? (r.pts![0] as number[]) : (r.pts![r.pts!.length - 1] as number[]);
}

/** ¿Entradas/salidas del tramo respecto a un punto (extremo en el punto)? */
function tocaComo(r: PlanoRamal, pt: number[], tol = 0.5): 'entra' | 'sale' | null {
  const dO = Math.hypot(origenDe(r)[0] - pt[0], origenDe(r)[1] - pt[1]);
  const dD = Math.hypot(destinoDe(r)[0] - pt[0], destinoDe(r)[1] - pt[1]);
  if (dD < tol) return 'entra';
  if (dO < tol) return 'sale';
  return null;
}

/** Camina aguas arriba invirtiendo (docx "algoritmo de re-enraizamiento"). Devuelve los
 *  ids invertidos o null si aborta (dos fuentes / ciclo / tope). */
export function reEnraizarDesde(engine: IPlanoEngineCore, idInicial: string): string[] | null {
  const net = engine.ramales.find((r) => r.id === idInicial)?.net || '';
  const invertidos: string[] = [];
  let cur = idInicial;
  const vistos = new Set<string>([cur]);
  while (invertidos.length <= engine.ramales.length) {
    const r = engine.ramales.find((x) => x.id === cur);
    if (!r) return null;
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
    if (!nxt || vistos.has(nxt)) return invertidos; // hoja o ciclo: fin
    vistos.add(nxt);
    cur = nxt;
  }
  return invertidos.length ? invertidos : null;
}

export interface ResolucionSentido {
  accion: 'nuevo' | 'existente';
  invertidos: string[];
}

/** ¿El tramo entrante QUEDA ENTRANDO a la tee (conflicto de 2 entradas)? */
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

/** Reglas 1-5 del docx para resolver el conflicto. `farDe` clasifica el extremo lejano.
 *  Devuelve la acción ejecutada (o 'preguntar' si aplica la regla 5). */
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
