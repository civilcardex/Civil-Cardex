import type PlanoEngine from '../../../lib/PlanoEngine/PlanoEngine';
import type { PlanoRamal } from '../../../lib/PlanoEngine/PlanoState';
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
