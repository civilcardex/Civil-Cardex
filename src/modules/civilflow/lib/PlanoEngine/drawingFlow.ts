import type { PlanoRamal } from './PlanoState';
import { pointToSegmentDist } from './HitTester';
import { distToPolyline } from '../shared/geometry';
import { diamPulgFromLabel } from '../../utils/diamPulgFromLabel';
import { ramalContinuesPast } from './drawingUtils';
import { sanFeederMinMsg } from '../../utils/sanitaryDiamCompat';

// Validación de diámetros en nodos de redes de presión (salida ≤ entrada), sobre el estado VIVO
// del motor. Corre en updateElementById para que CUALQUIER camino que escriba `diametro`
// (menú contextual del canvas, editores, etc.) quede validado — no solo las tablas de diseño.
// La entrada llega al ORIGEN de flujo del ramal y las salidas salen de su DESTINO (con
// _tribReversed); cada salida se revisa de forma independiente contra la entrada más restrictiva.
export function diametroCambioPermitido(
  ramales: Array<{
    id: string;
    net?: string;
    pts?: number[][];
    _tribReversed?: boolean;
    diametro?: string;
  }>,
  ramalId: string,
  newLabel: string,
): { ok: boolean; msg?: string } {
  const r = ramales.find((x) => x.id === ramalId);
  if (!r || !r.pts || r.pts.length < 2) return { ok: true };
  const newIn = newLabel ? diamPulgFromLabel(newLabel) : 0;
  if (newIn <= 0) return { ok: true };
  const TOL = 2.0;
  const myOrigin = r._tribReversed ? r.pts[r.pts.length - 1] : r.pts[0];
  const myDest = r._tribReversed ? r.pts[0] : r.pts[r.pts.length - 1];
  const touches = (pts: number[][], pt: number[]): 'endpoint' | 'body' | null => {
    const p0 = pts[0];
    const p1 = pts[pts.length - 1];
    if (Math.hypot(p0[0] - pt[0], p0[1] - pt[1]) < TOL) return 'endpoint';
    if (Math.hypot(p1[0] - pt[0], p1[1] - pt[1]) < TOL) return 'endpoint';
    for (let i = 0; i < pts.length - 1; i++) {
      const ax = pts[i][0],
        ay = pts[i][1],
        bx = pts[i + 1][0],
        by = pts[i + 1][1];
      const dx = bx - ax,
        dy = by - ay,
        len2 = dx * dx + dy * dy;
      if (len2 < 1e-9) continue;
      const t = ((pt[0] - ax) * dx + (pt[1] - ay) * dy) / len2;
      if (t <= 0 || t >= 1) continue;
      if (Math.hypot(pt[0] - (ax + t * dx), pt[1] - (ay + t * dy)) < TOL) return 'body';
    }
    return null;
  };
  let maxParent = 0;
  let parentLbl = '';
  let maxChild = 0;
  let childLbl = '';
  for (const o of ramales) {
    if (o.id === ramalId || o.net !== r.net || !o.pts || o.pts.length < 2) continue;
    const oRev = !!o._tribReversed;
    const oOrigin = oRev ? o.pts[o.pts.length - 1] : o.pts[0];
    const oDest = oRev ? o.pts[0] : o.pts[o.pts.length - 1];
    const oIn = o.diametro ? diamPulgFromLabel(o.diametro) : 0;
    if (oIn <= 0) continue;
    // Entrada: el destino de flujo del otro cae en mi origen (o su cuerpo pasa por mi origen)
    const feedsMe =
      Math.hypot(oDest[0] - myOrigin[0], oDest[1] - myOrigin[1]) < TOL ||
      touches(o.pts, myOrigin) === 'body';
    // Salida: el origen de flujo del otro cae en mi destino o sobre mi cuerpo (unión T)
    const iFeedIt =
      Math.hypot(oOrigin[0] - myDest[0], oOrigin[1] - myDest[1]) < TOL ||
      touches(r.pts, oOrigin) === 'body';
    if (feedsMe && oIn > maxParent) {
      maxParent = oIn;
      parentLbl = o.diametro || '';
    }
    if (iFeedIt && oIn > maxChild) {
      maxChild = oIn;
      childLbl = o.diametro || '';
    }
  }
  if (maxParent > 0 && newIn > maxParent) {
    return {
      ok: false,
      msg: `El diámetro de salida no puede ser mayor que el de entrada (${parentLbl}). Selecciona un diámetro menor o igual al del tramo aguas arriba.`,
    };
  }
  if (maxChild > 0 && newIn < maxChild) {
    return {
      ok: false,
      msg: `El diámetro de entrada no puede ser menor que el de salida (${childLbl}) ya asignado aguas abajo. Selecciona un diámetro mayor o reduce primero la salida.`,
    };
  }
  return { ok: true };
}

// Red sanitaria: el receptor no puede quedar con menor diámetro que el mayor ramal que le
// descarga directo (regla inversa a presión: aguas abajo SIEMPRE >= aguas arriba). Corre en
// updateElementById vía guardDiametroNodo para que CUALQUIER camino de dibujo (menú
// contextual, TramoEditor) quede validado con alerta — igual que la tabla de diseño.
// Solo cuentan alimentadores tipo `ramal` (tributarios y bajantes no restringen).
export function sanReceptorDiametroPermitido(
  ramales: Array<{
    id: string;
    net?: string;
    tipo?: string;
    pts?: number[][];
    _tribReversed?: boolean;
    diametro?: string;
    label?: string;
    fin?: string;
    mergesFrom?: string[];
  }>,
  ramalId: string,
  newLabel: string,
): { ok: boolean; msg?: string } {
  const r = ramales.find((x) => x.id === ramalId);
  if (!r || !r.pts || r.pts.length < 2) return { ok: true };
  const newIn = newLabel ? diamPulgFromLabel(newLabel) : 0;
  if (newIn <= 0) return { ok: true };
  const TOL = 2.0;
  const mergeSiblingPairs = new Set<string>();
  for (const q of ramales) {
    if (q.mergesFrom) mergeSiblingPairs.add([...q.mergesFrom].sort().join('|'));
  }
  let maxFeeder = 0;
  let feederLbl = '';
  for (const o of ramales) {
    // Alimentadores: ramales Y tributarios, con la regla de dirección — un receptor
    // TRIBUTARIO solo recibe de otros tributarios (un ramal nunca alimenta a un tributario).
    if (o.id === ramalId || o.net !== r.net || (o.tipo !== 'ramal' && o.tipo !== 'tributario'))
      continue;
    if (r.tipo === 'tributario' && o.tipo === 'ramal') continue;
    if (!o.pts || o.pts.length < 2) continue;
    if (mergeSiblingPairs.has([o.id, ramalId].sort().join('|'))) continue;
    const oIn = o.diametro ? diamPulgFromLabel(o.diametro) : 0;
    if (oIn <= 0) continue;
    // Destino de flujo del candidato sobre mi cuerpo: me descarga — pero solo si YO
    // continúo aguas abajo de ese punto. Si la unión cae en mi extremo FINAL (yo entrego
    // ahí, no recibo), el candidato no me alimenta y no restringe: el trazo que llega a
    // otro queda vacío y después sí puede fijar un diámetro menor (orig. usuario).
    const oDest = o._tribReversed ? o.pts[0] : o.pts[o.pts.length - 1];
    if (distToPolyline(oDest, r.pts) >= TOL) continue;
    if (!ramalContinuesPast(r, oDest, TOL)) continue;
    // Si el candidato declara `fin` hacia OTRO elemento (bajante u otro ramal), su flujo va
    // allá, no a mí (co-sumideros al mismo bajante, continuación tipeada) — no me alimenta.
    const oFin = o.fin || '';
    if (oFin && oFin !== r.id && oFin !== r.label) continue;
    if (oIn > maxFeeder) {
      maxFeeder = oIn;
      feederLbl = o.label || o.id;
    }
  }
  if (maxFeeder > 0 && newIn < maxFeeder) {
    return { ok: false, msg: sanFeederMinMsg(feederLbl, maxFeeder) };
  }
  return { ok: true };
}

/** Invariante sanitario: el receptor no baja por debajo del mayor alimentador. La SUBIDA del
 *  alimentador por encima del receptor está permitida — se propaga automáticamente aguas
 *  abajo (propagarSanDiametroAguasAbajo) en vez de bloquearse (orig. usuario: no debe saltar
 *  alerta al cambiar el diámetro desde los tributarios que llegan). */
export function sanDiametroPermitido(
  ramales: Parameters<typeof sanReceptorDiametroPermitido>[0],
  ramalId: string,
  newLabel: string,
): { ok: boolean; msg?: string } {
  return sanReceptorDiametroPermitido(ramales, ramalId, newLabel);
}

export function flipRamalFlow(ram: PlanoRamal): void {
  ram.pts = [...ram.pts].reverse();
  const tmpAcc = ram.accesorioInicio;
  ram.accesorioInicio = ram.accesorioFin;
  ram.accesorioFin = tmpAcc;
  const tmpDiam = ram.diametroInicio;
  ram.diametroInicio = ram.diametroFin;
  ram.diametroFin = tmpDiam;
  const tmpApp = ram.aparatoInicio;
  ram.aparatoInicio = ram.aparatoFin;
  ram.aparatoFin = tmpApp;
  const tmpIniFin = ram.ini;
  ram.ini = ram.fin;
  ram.fin = tmpIniFin;
  // Las claves accMed se desplazan porque los vértices interiores se reindexan con el nuevo
  // orden.
  if (ram.accMed) {
    const oldMed = ram.accMed;
    const len = ram.pts.length;
    const newMed: Record<string, string> = {};
    for (const [k, v] of Object.entries(oldMed)) {
      const m = k.match(/^accMed(\d+)$/);
      if (!m) continue;
      const oldIdx = parseInt(m[1], 10);
      const newIdx = len - 1 - oldIdx;
      newMed[`accMed${newIdx}`] = v;
    }
    ram.accMed = newMed;
  }
}

// ————— Helpers compartidos de dirección de flujo (ítems 2, 5, 12, 13) —————

/** Vector de flujo (px, sin normalizar) del ramal en el punto dado — dirección del segmento
 *  más cercano al punto, con la convención de renderRamales.ts (fluye de pts[0] hacia el último
 *  punto, invertido si _tribReversed). @returns null si el punto cae fuera del ramal por más de
 *  tol. */
export function ramalExtremoOcupado(
  ramales: Array<{ id: string; net?: string; pts?: number[][] }>,
  ramal: { id: string; net?: string },
  epPt: number[],
): boolean {
  const TOL = 0.5;
  for (const other of ramales) {
    if (other.id === ramal.id || other.net !== ramal.net) continue;
    const pts = other.pts;
    if (!pts || pts.length < 2) continue;
    if (Math.hypot(pts[0][0] - epPt[0], pts[0][1] - epPt[1]) < TOL) return true;
    if (Math.hypot(pts[pts.length - 1][0] - epPt[0], pts[pts.length - 1][1] - epPt[1]) < TOL)
      return true;
    for (let i = 0; i < pts.length - 1; i++) {
      if (
        pointToSegmentDist(epPt[0], epPt[1], pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]) <
        TOL
      )
        return true;
    }
  }
  return false;
}

/** ¿El extremo `epPt` del ramal está ENTRELAZADO con la red? — extremo/cuerpo de OTRO ramal del
 *  mismo net, o una bajante/montante del mismo net montada en ese punto (incluyendo la
 *  posición DESPLAZADA del bajante: el extremo del ramal se ancla donde el bajante se DIBUJA). */
export function extremoEntrelazado(
  ramales: Array<{ id: string; net?: string; pts?: number[][] }>,
  bajantes: Array<{
    net?: string;
    x: number;
    y: number;
    desplazamientos?: Record<string, { dx?: number; dy?: number }>;
  }>,
  ramal: { id: string; net?: string },
  epPt: number[],
): boolean {
  const TOL = 0.5;
  if (ramalExtremoOcupado(ramales, ramal, epPt)) return true;
  for (const b of bajantes) {
    if (b.net !== ramal.net) continue;
    if (Math.hypot(b.x - epPt[0], b.y - epPt[1]) < TOL) return true;
    for (const d of Object.values(b.desplazamientos || {})) {
      if (Math.hypot(b.x + (d.dx || 0) - epPt[0], b.y + (d.dy || 0) - epPt[1]) < TOL) return true;
    }
  }
  return false;
}

/** ¿El ramal (af/ac/gas) tiene un aparato en un extremo INVÁLIDO? — extremo conectado a la red
 *  (T/Y/bajante) o flujo en contra del extremo aparatado. Reutilizado por el bloqueo al
 *  asignar, el bloqueo al invertir dirección y el barrido de estados persistidos. */
export function aparatoEnExtremoInvalido(
  ramales: Array<{ id: string; net?: string; pts?: number[][] }>,
  bajantes: Array<{
    net?: string;
    x: number;
    y: number;
    desplazamientos?: Record<string, { dx?: number; dy?: number }>;
  }>,
  r: {
    id: string;
    net?: string;
    pts?: number[][];
    _tribReversed?: boolean;
    aparatoInicio?: string;
    aparatoFin?: string;
  },
): boolean {
  if (r.net !== 'af' && r.net !== 'ac' && r.net !== 'gas') return false;
  const pts = r.pts;
  if (!pts || pts.length < 2) return false;
  const bad = (pt: number[], app: string | undefined) =>
    Boolean(app) &&
    (extremoEntrelazado(ramales, bajantes, r, pt) ||
      !flowEndsAt({ pts, _tribReversed: r._tribReversed }, pt, 0.5));
  return bad(pts[0], r.aparatoInicio) || bad(pts[pts.length - 1], r.aparatoFin);
}

/** ¿La polaridad del codo de montante (sube/baja) es coherente con el flujo del ramal en P?
 *  El codo sube solo puede ENTREGAR flujo (el flujo SALE de P hacia el codo) y el codo baja
 *  solo puede RECIBIR (el flujo LLEGA a P desde el codo). En el cuerpo del ramal, donde el
 *  flujo solo pasa de largo, ninguno de los dos es válido. */

import { flowEndsAt } from './flowChecks';
export {
  flowVecAt,
  flowEndsAt,
  flowStartsAt,
  sameNetGroupNet,
  ventSanAngleOk,
  ramalFlowDirectionCheck,
} from './flowChecks';
export { codoPolarityOk, ventFlowsIntoJunction, flowDirectionOkAt } from './flowChecks';
export { pointOnRamalSegment } from './flowChecks';
export function propagarSanDiametroAguasAbajo(
  ramales: Parameters<typeof sanReceptorDiametroPermitido>[0],
  ramalId: string,
  bajantes?: Array<{ recibeDeIds?: string[]; alimentaIds?: string[] }>,
): void {
  const start = ramales.find((x) => x.id === ramalId);
  if (!start || !start.pts || start.pts.length < 2) return;
  const TOL = 2.0;
  const esRedSan = (o: { tipo?: string }) => o.tipo === 'ramal' || o.tipo === 'tributario';
  // Dirección hidráulica (orig. usuario): un RAMAL nunca alimenta a un TRIBUTARIO. Un
  // tributario receptor solo recibe de otros tributarios; un ramal receptor recibe de
  // tributarios (trib→ramal) y de la continuación del tronco (ramal→ramal, piezas de split).
  const puedeAlimentar = (feeder: { tipo?: string }, rec: { tipo?: string }): boolean =>
    rec.tipo === 'ramal' || feeder.tipo === 'tributario';
  const mergeSiblingPairs = new Set<string>();
  for (const q of ramales) {
    if (q.mergesFrom) mergeSiblingPairs.add([...q.mergesFrom].sort().join('|'));
  }
  // Pares co-sumidero: comparten bajante (ambos en recibeDeIds o ambos en alimentaIds).
  const coSumidero = new Set<string>();
  for (const b of bajantes || []) {
    const llegan = b.recibeDeIds || [];
    for (let i = 0; i < llegan.length; i++)
      for (let j = i + 1; j < llegan.length; j++)
        coSumidero.add([llegan[i], llegan[j]].sort().join('|'));
    const nacen = b.alimentaIds || [];
    for (let i = 0; i < nacen.length; i++)
      for (let j = i + 1; j < nacen.length; j++)
        coSumidero.add([nacen[i], nacen[j]].sort().join('|'));
  }
  const esCoSumidero = (a: string, b: string): boolean => coSumidero.has([a, b].sort().join('|'));
  // Alimentadores de un receptor: trazos cuyo punto de descarga (destino de flujo) cae en su
  // cuerpo/extremos, sin contar las mitades de una misma división (hermanas mergesFrom) ni
  // trazos con `fin` declarado hacia otro elemento (co-sumideros). SOLO el destino de flujo:
  // con fallback de dos extremos una pieza de AGUAS ABAJO (su origen toca el cuerpo) se
  // contaba como llegadora y bloqueaba la compuerta de todos-asignados.
  const feedersOf = (rec: (typeof ramales)[0]): typeof ramales => {
    const out: typeof ramales = [];
    for (const o of ramales) {
      if (o.id === rec.id || o.net !== rec.net || !esRedSan(o)) continue;
      if (!puedeAlimentar(o, rec)) continue;
      if (!o.pts || o.pts.length < 2) continue;
      const oDest = o._tribReversed ? o.pts[0] : o.pts[o.pts.length - 1];
      if (distToPolyline(oDest, rec.pts!) >= TOL) continue;
      if (esCoSumidero(o.id, rec.id)) continue;
      // El `fin` declarado excluye solo si apunta a un TERCERO REMOTO. En uniones de split y
      // trib→trib los fin/ini quedan como referencias cruzadas ENTRE PARTICIPANTES de la misma
      // unión (RS1.fin="RS2", RS2.fin="RS1" apuntándose mutuamente — datos reales del usuario):
      // si el tramo declarado pasa por ESTA MISMA descarga, es contabilidad de la conexión y no
      // excluye. Solo un fin hacia un elemento remoto (co-sumidero al bajante, continuación
      // tipeada) sigue excluyendo.
      const oFin = o.fin || '';
      if (oFin && oFin !== rec.id && oFin !== rec.label) {
        const finT = ramales.find(
          (x) => (x.id === oFin || x.label === oFin) && x.pts && x.pts.length >= 2,
        );
        const finEnLaUnion =
          !!finT?.pts &&
          distToPolyline(oDest, finT.pts) < TOL &&
          distToPolyline(oDest, rec.pts!) < TOL;
        if (!finEnLaUnion) continue;
      }
      if (mergeSiblingPairs.has([o.id, rec.id].sort().join('|'))) continue;
      out.push(o);
    }
    return out;
  };
  const processed = new Set<string>();
  const queue: string[] = [start.id];
  while (queue.length > 0) {
    const curId = queue.shift()!;
    if (processed.has(curId)) continue;
    processed.add(curId);
    const cur = ramales.find((x) => x.id === curId);
    if (!cur || !cur.pts || cur.pts.length < 2) continue;
    const curPulg = diamPulgFromLabel(cur.diametro || '');
    if (curPulg <= 0) continue;
    // Descarga de cur: el destino de flujo; si no toca nada (bandera stale), el otro extremo.
    const destFlow = cur._tribReversed ? cur.pts[0] : cur.pts[cur.pts.length - 1];
    const destOther = cur._tribReversed ? cur.pts[cur.pts.length - 1] : cur.pts[0];
    const destOn = (q: typeof cur): boolean =>
      distToPolyline(destFlow, q.pts!) < TOL || distToPolyline(destOther, q.pts!) < TOL;
    // Receptor: tramo mismo net cuyo cuerpo/extremos toca mi descarga — con la misma regla de
    // dirección (el descargo de un ramal solo puede caer en OTRO ramal; la de un tributario,
    // en ramal o tributario). Dos pasadas: PRIMERO los que NACEN en mi descarga (su origen
    // toca el punto — continuación del tronco, RS3 en la unión RS1|RS2|RS3); si no hay, el
    // más cercano. Sin esto un HERMANO que también llega (RS2, origen lejano) podía ganar el
    // desempate por orden de array y "engullir" el caudal (orig. usuario).
    let receptor: typeof cur | null = null;
    let recD = Infinity;
    for (const q of ramales) {
      if (q.id === cur.id || q.net !== cur.net || !esRedSan(q)) continue;
      if (!puedeAlimentar(cur, q)) continue;
      if (esCoSumidero(cur.id, q.id)) continue;
      if (!q.pts || q.pts.length < 2) continue;
      const d = distToPolyline(destFlow, q.pts);
      if (d >= TOL) continue;
      const qOrigin = q._tribReversed ? q.pts[q.pts.length - 1] : q.pts[0];
      if (Math.hypot(qOrigin[0] - destFlow[0], qOrigin[1] - destFlow[1]) < TOL) {
        // nace aquí: candidato preferente inmediato.
        receptor = q;
        recD = d;
        break;
      }
      if (d < recD) {
        recD = d;
        receptor = q;
      }
    }
    if (!receptor) {
      for (const q of ramales) {
        if (q.id === cur.id || q.net !== cur.net || !esRedSan(q)) continue;
        if (!puedeAlimentar(cur, q)) continue;
        if (esCoSumidero(cur.id, q.id)) continue;
        if (!q.pts || q.pts.length < 2) continue;
        const d = distToPolyline(destOther, q.pts);
        if (d >= TOL) continue;
        const qOrigin = q._tribReversed ? q.pts[q.pts.length - 1] : q.pts[0];
        if (Math.hypot(qOrigin[0] - destOther[0], qOrigin[1] - destOther[1]) < TOL) {
          receptor = q;
          recD = d;
          break;
        }
        if (d < recD) {
          recD = d;
          receptor = q;
        }
      }
    }
    if (!receptor || !destOn(receptor)) continue;
    // El receptor toma el MAYOR de los llegadores que tengan diámetro asignado (orig. usuario,
    // regla vigente en marañas reales): los llegadores sin diámetro NO bloquean — una pieza
    // troncal sin llegadores propios (p. ej. T6RS8) congelaría toda la cadena con la compuerta
    // estricta "todos asignados". Nunca baja: solo escribe si el mayor supera al actual.
    const feeders = feedersOf(receptor);
    let maxPulg = 0;
    let maxLbl = '';
    for (const f of feeders) {
      const p = diamPulgFromLabel(f.diametro || '');
      if (p > maxPulg) {
        maxPulg = p;
        maxLbl = f.diametro || '';
      }
    }
    if (maxPulg > 0) {
      const recPulg = diamPulgFromLabel(receptor.diametro || '');
      // Asigna también al receptor VACÍO (recPulg 0): el caso típico es el trazo nuevo que
      // recibe de llegadores ya asignados.
      if (recPulg < maxPulg) receptor.diametro = maxLbl;
    }
    // El receptor continúa la cadena aguas abajo (subiera o no).
    queue.push(receptor.id);
  }
}
