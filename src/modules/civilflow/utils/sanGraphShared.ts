/** Grafo sanitario compartido por el builder de bajantes y por la conectividad de UD: las
 *  piezas comunes (enlaces verticales/descarga, adyacencia, componentes y orientación) antes
 *  estaban copiadas en los dos archivos. Los enlaces ramal→bajante sí siguen distintos: cada
 *  builder resuelve la dirección de flujo con sus propias reglas. */
import type { Tramo } from '../context/tramosReducer';
import { splitPtr } from './keys.ts';

/** Agrega un hijo al padre en un mapa de adyacencia. */
export type Enlazar = (padre: string, hijo: string) => void;

/** Enlaza las secciones de un mismo bajante entre pisos y las descargas `descargaEnId` hacia ramales existentes. */
export function enlazarSeccionesBajante(tramosSan: Tramo[], enlazar: Enlazar): void {
  const bajantesGroups: Record<string, Tramo[]> = {};
  for (const t of tramosSan) {
    if (t.esBajante && t.id) {
      if (!bajantesGroups[t.id]) bajantesGroups[t.id] = [];
      bajantesGroups[t.id].push(t);
    }
  }
  for (const sections of Object.values(bajantesGroups)) {
    sections.sort((a, b) => (a.piso || 0) - (b.piso || 0));
    for (let i = 0; i < sections.length - 1; i++) {
      const lowerKey = sections[i]._key;
      const upperKey = sections[i + 1]._key;
      if (lowerKey && upperKey) enlazar(lowerKey, upperKey);
    }
  }

  const claves = new Set<string>();
  for (const t of tramosSan) if (t._key) claves.add(t._key);
  for (const t of tramosSan) {
    if (!t.esBajante || !t.descargaEnId || !t._key) continue;
    const [dPlanId, targetRamalId] = splitPtr(t.descargaEnId, '');
    if (!targetRamalId) continue;
    const targetKey = `${targetRamalId}-${dPlanId}`;
    if (claves.has(targetKey)) enlazar(targetKey, t._key);
  }
}

/** Adyacencia NO dirigida (clave tramo/plano → vecinos) desde el mapa padre→hijos. */
export function adyDesdeMapa(
  tramosSan: Tramo[],
  mapa: Map<string, Set<string>>,
): Record<string, Set<string>> {
  const adj: Record<string, Set<string>> = {};
  for (const t of tramosSan) {
    if (t._key) adj[t._key] = new Set();
  }
  for (const [padre, hijos] of mapa) {
    if (!adj[padre]) adj[padre] = new Set();
    for (const hijo of hijos) {
      if (!adj[hijo]) adj[hijo] = new Set();
      adj[padre].add(hijo);
      adj[hijo].add(padre);
    }
  }
  return adj;
}

/** Componentes conexas de la adyacencia: cada tramo queda en exactamente una. */
export function componentesDeAdy(adj: Record<string, Set<string>>): string[][] {
  const visitados = new Set<string>();
  const componentes: string[][] = [];
  for (const nodo of Object.keys(adj)) {
    if (visitados.has(nodo)) continue;
    const comp: string[] = [];
    const q = [nodo];
    visitados.add(nodo);
    while (q.length > 0) {
      const actual = q.shift()!;
      comp.push(actual);
      for (const vecino of adj[actual] || new Set<string>()) {
        if (!visitados.has(vecino)) {
          visitados.add(vecino);
          q.push(vecino);
        }
      }
    }
    componentes.push(comp);
  }
  return componentes;
}

/** Oriente cada componente desde su raíz (menor piso, bajante antes que ramal). */
export function orientarComponentes(
  componentes: string[][],
  adj: Record<string, Set<string>>,
  tramoPorClave: ReadonlyMap<string | number, Tramo>,
): Record<string, string[]> {
  const score = (key: string): number => {
    const tr = tramoPorClave.get(key);
    if (!tr) return 99999999;
    const id = tr.id || '';
    const match = id.match(/^([a-zA-Z]+)(\d+)?$/);
    const num = match && match[2] ? parseInt(match[2]) : 999;
    return (tr.piso || 0) * 100000 + (tr.esBajante ? 0 : 10000) + num;
  };

  const orientadas: Record<string, string[]> = {};
  const visitados = new Set<string>();
  for (const comp of componentes) {
    let raiz = comp[0];
    let min = score(raiz);
    for (const nodo of comp) {
      const s = score(nodo);
      if (s < min) {
        min = s;
        raiz = nodo;
      }
    }
    const q = [raiz];
    visitados.add(raiz);
    while (q.length > 0) {
      const padre = q.shift()!;
      if (!orientadas[padre]) orientadas[padre] = [];
      for (const hijo of adj[padre] || []) {
        if (!visitados.has(hijo)) {
          visitados.add(hijo);
          orientadas[padre].push(hijo);
          q.push(hijo);
        }
      }
    }
  }
  return orientadas;
}
