import type PlanoEngine from '../../../lib/PlanoEngine/PlanoEngine';
import type { PlanoRamal } from '../../../lib/PlanoEngine/PlanoState';
import { rootTributarioLabel } from '../../../lib/PlanoEngine/PlanoState';
import { extremoEntrelazado } from '../../../lib/PlanoEngine/PlanoEngineDrawing';

// ¿El punto p cae sobre el CUERPO (mitad de segmento) de pts? Excluye extremos (t<0.02/0.98),
// que se validan por coincidencia de vértice aparte.
/** ¿El punto cae sobre el CUERPO (mitad de segmento) de la polilínea? Excluye los extremos,
 *  que se validan aparte por coincidencia de vértice. */
export function pointOnRamalBody(pts: number[][], p: number[], tol: number): boolean {
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const lenSq = dx * dx + dy * dy;
    if (lenSq < 0.0001) {
      if (Math.hypot(p[0] - a[0], p[1] - a[1]) < tol) return true;
      continue;
    }
    const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lenSq;
    if (t < 0.02 || t > 0.98) continue;
    const px = a[0] + t * dx;
    const py = a[1] + t * dy;
    if (Math.hypot(p[0] - px, p[1] - py) < tol) return true;
  }
  return false;
}

// Un ramal que participa en cualquier unión con otros ramales no debe ver invertido su sentido
// de flujo: invertir pts invalidaría cada extremo compartido, el vínculo con el tributario
// padre, los glifos tee/yee de accMed en la unión y las asignaciones accesorioInicio/Fin de
// los ramales conectados. "Interconexión" = comparte extremo con otro ramal, tiene tributarios
// colgados, es él mismo tributario, o lleva marcadores de unión (accMed / cruces bilaterales /
// pares de ids).
/** ¿El ramal tiene interconexiones que impiden invertir su dirección? Comparte extremo con
 *  otro ramal, tiene tributarios colgados, es tributario o lleva marcadores de unión. */
export function ramalHasInterconnections(eng: PlanoEngine | null, ramal: PlanoRamal): boolean {
  if (!eng) return false;
  const TOL = 0.5;
  const eps = [ramal.pts[0], ramal.pts[ramal.pts.length - 1]];
  // Ítem 11: este ramal es la mitad (aguas arriba o abajo) de una división auto-split — su
  // dirección no se puede invertir sin romper la cadena mergesFrom.
  if (ramal.mergesFrom) return true;
  for (const other of eng.ramales) {
    if (other.id === ramal.id) continue;
    const sameGroup =
      other.net === ramal.net ||
      ((other.net === 'san' || other.net === 'vent') &&
        (ramal.net === 'san' || ramal.net === 'vent'));
    if (!sameGroup) continue;
    if (other.padre === ramal.id) return true;
    if (other.tipo === 'tributario' && ramal.tipo === 'tributario' && other.padre === ramal.padre)
      continue;
    // otro ramal fue partido por este (o referencia este en una cadena de splits)
    if (other.mergesFrom && other.mergesFrom.includes(ramal.id)) return true;
    // extremo-contra-extremo (comportamiento viejo)
    for (const pt of other.pts) {
      if (eps.some((e) => Math.hypot(e[0] - pt[0], e[1] - pt[1]) < TOL)) return true;
    }
    // Ítem 11: extremo del OTRO sentado sobre el CUERPO de este ramal (p. ej. un vent sobre el
    // cuerpo de un san — la unión reventilado no divide, así que antes no se detectaba) y
    // extremo de ESTE sentado sobre el cuerpo del otro.
    for (const pt of other.pts) {
      if (pointOnRamalBody(ramal.pts, pt, TOL)) return true;
    }
    for (const myEp of eps) {
      if (pointOnRamalBody(other.pts, myEp, TOL)) return true;
    }
  }
  // Ítem 11: bajante/montante tocando los extremos — vía recibeDeIds o por posición (con el
  // desplazamiento del piso actual). Invertir el ramal voltearía ini/fin que referencian el
  // código del bajante.
  const lvl = eng.nivelActual?.label ?? '';
  for (const b of eng.bajantes) {
    if (b.recibeDeIds?.includes(ramal.id)) return true;
    const disp = b.desplazamientos?.[lvl] || {};
    const bx = b.x + (disp.dx || 0);
    const by = b.y + (disp.dy || 0);
    if (eps.some((e) => Math.hypot(e[0] - bx, e[1] - by) < TOL)) return true;
  }
  if (ramal.tipo === 'tributario') return true;
  if (ramal.accMed && Object.keys(ramal.accMed).length > 0) return true;
  return false;
}

/** Lado de la COLA de flujo para el codo sube (orig. usuario: en un trazo aislado el
 *  sube va donde NACE el flujo, no donde muere): 0 = inicio, 1 = fin, -1 = ambiguo. */
export function flowTailEnd(endsAtStart: boolean, endsAtEnd: boolean): 0 | 1 | -1 {
  if (endsAtEnd && !endsAtStart) return 0;
  if (endsAtStart && !endsAtEnd) return 1;
  return -1;
}

// ¿El extremo `epPt` del ramal está ENTRELAZADO con la red (otro ramal del mismo net o una
// bajante/montante del mismo net en ese punto)? Cubre la unión en T por montante.
/** ¿El extremo del ramal está entrelazado con la red (otro ramal o un bajante/montante de la
 *  misma red en ese punto)? Cubre la unión en T por montante. */
export function extremumOccupied(
  eng: PlanoEngine | null,
  ramal: PlanoRamal,
  epPt: number[],
): boolean {
  if (!eng) return false;
  return extremoEntrelazado(eng.ramales, eng.bajantes || [], ramal, epPt);
}

const CONV_TOL = 0.5;
const convSameGroup = (a: string, b: string) =>
  a === b || ((a === 'san' || a === 'vent') && (b === 'san' || b === 'vent'));

function ptTouchesRamal(pts: number[][], p: number[]): boolean {
  return (
    pts.some(([x, y]) => Math.hypot(x - p[0], y - p[1]) < CONV_TOL) ||
    pointOnRamalBody(pts, p, CONV_TOL)
  );
}

// Cabeza (= salida) y cola (= entrada) de flujo del tributario: misma convención que
// exitsDeBajante.
function tribHead(o: PlanoRamal): number[] {
  const p = o.pts;
  return o._tribReversed ? p[0] : p[p.length - 1];
}

// Tributarios que SÍ impiden convertir `freshId` (tributario) en ramal: aquellos a los que
// FRESH LLEGA con su cabeza (extremo de salida sobre el tributario ajeno) — el ramal resultante quedaría
// llegando a un tributario y eso está prohibido (alerta "Los ramales no se conectan a
// tributarios": caso T5RS8 llegando a T1RS8). NO bloquean: los segmentos hermanos de su
// misma línea física (linaje de split o unión limpia extremo-con-extremo, ver grupo), ni
// los tributarios que LLEGAN a fresh (él los recibe: caso T1RS8 receptor). Excepción: si el
// punto de toque también pertenece a un TRONCO (ramal no-tributario), la unión es del
// tronco — no cuenta como llegada al tributario.
// El chequeo viejo `o.padre !== fresh.id` nunca reconocía hijos (el padre apunta a la raíz)
// y el BFS por raíz tragaba ramas laterales (misma raíz + toque ≠ misma línea): un caso
// pasaba en silencio y el otro bloqueaba de más.
/** ¿Qué tributarios impiden convertir un tributario en ramal? Vacío = conversión válida. */
export function tribsBlockingRamalConversion(ramales: PlanoRamal[], freshId: string): PlanoRamal[] {
  const fresh = ramales.find((r) => r.id === freshId);
  if (!fresh || fresh.tipo !== 'tributario' || !fresh.pts || fresh.pts.length < 2) return [];
  // Grupo "misma línea": SOLO segmentos colineales del mismo trazo físico —
  // (a) linaje de split (downstream.mergesFrom[0] = tramo que continúa), o
  // (b) unión limpia extremo-con-extremo: mismo raíz, vértice con vértice, sin NINGÚN otro
  //     ramal (tronco o rama) tocando ese punto. En un tee compartido o en una llegada
  //     lateral siempre hay un tercer trazo en el punto → no se fusiona → bloquea.
  const rootLbl = rootTributarioLabel(ramales, fresh.id);
  const group = new Set<string>([fresh.id]);
  const vertexMatch = (a: number[][], b: number[][]): number[] | null => {
    for (const p of a) {
      if (p !== a[0] && p !== a[a.length - 1]) continue;
      for (const q of b) {
        if (q !== b[0] && q !== b[b.length - 1]) continue;
        if (Math.hypot(p[0] - q[0], p[1] - q[1]) < CONV_TOL) return p;
      }
    }
    return null;
  };
  const jointIsClean = (p: number[], idA: string, idB: string): boolean => {
    for (const r of ramales) {
      if (r.id === idA || r.id === idB) continue;
      if (!convSameGroup(r.net, fresh.net) || !r.pts || r.pts.length < 2) continue;
      if (ptTouchesRamal(r.pts, p)) return false;
    }
    return true;
  };
  let grew = true;
  while (grew) {
    grew = false;
    for (const o of ramales) {
      if (
        group.has(o.id) ||
        o.tipo !== 'tributario' ||
        !convSameGroup(o.net, fresh.net) ||
        !o.pts ||
        o.pts.length < 2
      )
        continue;
      let sameLine = false;
      for (const mId of group) {
        const m = ramales.find((r) => r.id === mId);
        if (!m?.pts || m.pts.length < 2) continue;
        // (a) linaje de split: el autocreado continúa al tramo que partió.
        const mfM = (m as { mergesFrom?: string[] }).mergesFrom;
        const mfO = (o as { mergesFrom?: string[] }).mergesFrom;
        if ((mfM && mfM[0] === o.id) || (mfO && mfO[0] === m.id)) {
          sameLine = true;
          break;
        }
        // (b) unión limpia extremo-con-extremo con igual raíz.
        if (!rootLbl || rootTributarioLabel(ramales, o.id) !== rootLbl) continue;
        const jp = vertexMatch(m.pts, o.pts);
        if (jp && jointIsClean(jp, m.id, o.id)) {
          sameLine = true;
          break;
        }
      }
      if (sameLine) {
        group.add(o.id);
        grew = true;
      }
    }
  }
  const blockers: PlanoRamal[] = [];
  if (fresh.padre) {
    const p = ramales.find((r) => r.id === fresh.padre);
    if (p && p.tipo === 'tributario' && convSameGroup(p.net, fresh.net) && !group.has(p.id))
      blockers.push(p);
  }
  const freshHead = tribHead(fresh);
  const trunkAt = (p: number[]): boolean =>
    ramales.some(
      (t) =>
        t.tipo !== 'tributario' &&
        convSameGroup(t.net, fresh.net) &&
        t.pts &&
        t.pts.length >= 2 &&
        ptTouchesRamal(t.pts, p),
    );
  for (const o of ramales) {
    if (o.id === fresh.id || group.has(o.id) || blockers.includes(o)) continue;
    if (o.tipo !== 'tributario' || !convSameGroup(o.net, fresh.net) || !o.pts || o.pts.length < 2)
      continue;
    // Solo bloquea la CABEZA propia sobre el tributario ajeno (fresh entrega ahí):
    // con la cola, fresh RECIBE (el lateral llega a su entrada); con el cuerpo no hay
    // contacto propio. Si un tronco comparte el punto, la unión es del tronco.
    if (ptTouchesRamal(o.pts, freshHead) && !trunkAt(freshHead)) {
      blockers.push(o);
    }
  }
  return blockers;
}
