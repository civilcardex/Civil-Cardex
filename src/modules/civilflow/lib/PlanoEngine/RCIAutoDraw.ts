/** Dibujo automático de la red rci (Red Contra Incendio) con los S/L del proyecto: sembrar
 *  rociadores colgantes sobre un ramal cada S (m) desde el INICIO del trazo (pts[0]) y crear
 *  ramales paralelos al primero separados L (m) — con CONECTOR físico hasta las cabezas, para
 *  que la red quede realmente unida y su longitud entre al cálculo de pérdidas.
 *  Ej: sembrarRociadores(eng, 'RRCI1', 3.2) deja un rociador en la cabeza y uno cada 3,2 m. */
import type { IPlanoEngineCore, PlanoRamal } from './PlanoState.ts';
import { cmToPlanePx, factorMPorPx } from './planoCoords.ts';
import { calculateRamalLength } from './ramalMeasure.ts';
import { nextFreeRamalId } from './planoNumbering.ts';
import { _firstSegmentAngle } from './drawingAngles.ts';
import { distSegSeg, MIN_MURO_M } from '../shared/geometry.ts';

/** Recorre la polilínea desde pts[0] y devuelve el punto (y el índice de inserción) que está a
 *  `distPx` px acumulados. null si la distancia se pasa del final. */
function puntoADistancia(
  pts: number[][],
  distPx: number,
): { x: number; y: number; idx: number; dist: number } | null {
  let acum = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const dx = pts[i + 1][0] - pts[i][0];
    const dy = pts[i + 1][1] - pts[i][1];
    const seg = Math.hypot(dx, dy);
    if (acum + seg >= distPx) {
      const t = seg > 0 ? (distPx - acum) / seg : 0;
      return { x: pts[i][0] + dx * t, y: pts[i][1] + dy * t, idx: i + 1, dist: distPx };
    }
    acum += seg;
  }
  return null;
}

/** Corre las claves accMed{n} del índice `desde` en `delta` (shift del splice de vértices,
 *  mismo criterio de midRamalAccessorySelector). */
function shiftAccMed(
  accMed: Record<string, string>,
  desde: number,
  delta: number,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(accMed)) {
    const m = k.match(/^accMed(\d+)$/);
    const n = m ? +m[1] : null;
    if (n !== null && n >= desde) out[`accMed${n + delta}`] = v;
    else out[k] = v;
  }
  return out;
}

/** Distancia mínima (px) entre dos polilíneas (mín entre todos sus pares de segmentos). */
function distPoli(a: number[][], b: number[][]): number {
  let mejor = Infinity;
  for (let i = 0; i < a.length - 1; i++) {
    for (let j = 0; j < b.length - 1; j++) {
      mejor = Math.min(mejor, distSegSeg(a[i], a[i + 1], b[j], b[j + 1]));
    }
  }
  return mejor;
}

/** Siembra rociadores colgantes ('rociador') sobre el ramal cada `sM` metros, COMENZANDO en el
 *  extremo donde se empezó a dibujar el trazo (pts[0]): el primero va en el propio extremo
 *  (accesorioInicio) y los demás como marcadores de cuerpo (accMed). No toca los accesorios
 *  existentes (solo desplaza sus claves al insertar vértices). IDEMPOTENTE: las posiciones
 *  que ya tienen rociador no se duplican (segunda llamada con el mismo S → no-op).
 *  Devuelve n.º de rociadores NUEVOS sembrados.
 *  Ej: ramal de 10 m con S = 2.5 sin rociadores previos → 4. */
export function sembrarRociadores(engine: IPlanoEngineCore, ramalId: string, sM: number): number {
  const r = engine.ramales.find((x) => x.id === ramalId);
  if (!r || !r.pts || r.pts.length < 2) return 0;
  const pasoPx = cmToPlanePx(engine.scaleM, sM * 100);
  if (!(pasoPx > 0)) return 0;
  /** ¿Ya hay un rociador en ese punto (vértice marcado accMed 'rociador')? Evita duplicar
   *  rociadores superpuestos al repetir la acción. Ej: 2.ª pasada con el mismo S → todas las
   *  posiciones ocupadas → 0 inserciones. (La cabeza no aplica: las inserciones empiezan en
   *  d = pasoPx > 1 px del vértice 0.) */
  const yaSembrado = (x: number, y: number): boolean =>
    Object.entries(r.accMed || {}).some(([k, v]) => {
      if (!/rociador/i.test(v)) return false;
      const m = k.match(/^accMed(\d+)$/);
      const q = m ? r.pts[+m[1]] : null;
      return !!q && Math.hypot(q[0] - x, q[1] - y) < 1;
    });
  /* TRAMO RECTO MÁS LARGO (ped. usuario 2026-11-13): la siembra ocurre SOLO dentro de la
   * corrida colineal más larga del ramal — tras una curva o ángulo recto no continúa. Cada
   * cambio de dirección (dot < 0.98) cierra una corrida; corridas de un solo segmento también
   * compiten. */
  let mejorIni = 0;
  let mejorLen = -1;
  let runIni = 0;
  let runLen = 0;
  let dirAnt: { x: number; y: number } | null = null;
  for (let i = 0; i < r.pts.length - 1; i++) {
    const segLen = Math.hypot(r.pts[i + 1][0] - r.pts[i][0], r.pts[i + 1][1] - r.pts[i][1]);
    const d = {
      x: (r.pts[i + 1][0] - r.pts[i][0]) / (segLen || 1),
      y: (r.pts[i + 1][1] - r.pts[i][1]) / (segLen || 1),
    };
    const colineal = !!dirAnt && Math.abs(d.x * dirAnt.x + d.y * dirAnt.y) >= 0.98;
    if (!colineal) {
      if (runLen > mejorLen) {
        mejorLen = runLen;
        mejorIni = runIni;
      }
      runIni = i;
      runLen = 0;
    }
    runLen += segLen;
    dirAnt = d;
  }
  if (runLen > mejorLen) {
    mejorLen = runLen;
    mejorIni = runIni;
  }
  // Distancia acumulada al inicio del tramo ganador:
  let rectoInicio = 0;
  let acc = 0;
  for (let i = 0; i < r.pts.length - 1; i++) {
    const segLen = Math.hypot(r.pts[i + 1][0] - r.pts[i][0], r.pts[i + 1][1] - r.pts[i][1]);
    if (i === mejorIni) rectoInicio = acc;
    acc += segLen;
  }
  /* Puntos a insertar (dist, x, y) cada pasoPx DENTRO del tramo recto ganador, sin llegar a
   * su fin. Posiciones ya sembradas se saltan (idempotencia). */
  const inserciones: Array<{ x: number; y: number; idx: number; dist: number }> = [];
  for (let d = rectoInicio + pasoPx; d < rectoInicio + mejorLen - 1e-6; d += pasoPx) {
    const p = puntoADistancia(r.pts, d);
    if (p && !yaSembrado(p.x, p.y)) inserciones.push(p);
  }
  /* Sin puntos que insertar (ramal ≤ S): NO es no-op si el extremo inicial está libre —
   * la CABEZA siempre recibe su rociador (un ramal corto no debe quedarse sin ninguno). */
  const pusoInicio = !r.accesorioInicio;
  if (!inserciones.length && !pusoInicio) return 0;
  /* Insertar ASC por distancia con offset: varias distancias caen en el MISMO segmento (mismo
   * idx), así que cada inserción corré las previas +1 — el contador global lo lleva. */
  let pts = r.pts.slice();
  let accMed = { ...(r.accMed || {}) };
  let offset = 0;
  for (const ins of [...inserciones].sort((a, b) => a.dist - b.dist)) {
    const idx = ins.idx + offset;
    pts = [...pts.slice(0, idx), [ins.x, ins.y], ...pts.slice(idx)];
    accMed = shiftAccMed(accMed, idx, 1);
    accMed[`accMed${idx}`] = 'rociador';
    offset++;
  }
  /* El rociador del EXTREMO inicial solo entra si ese extremo está libre: si ya trae un
   * accesorio (ej: codo en la cabeza) no se pisa — el conteo real lo refleja. */
  engine.updateElementById(ramalId, {
    ...(inserciones.length ? { pts, accMed } : {}),
    ...(pusoInicio ? { accesorioInicio: 'rociador' } : {}),
    totalL: +calculateRamalLength(pts, engine).toFixed(3),
  });
  renumeraRociadores(engine);
  engine.render();
  engine._markDirty();
  return inserciones.length + (pusoInicio ? 1 : 0);
}

/** RENUMERA los rociadores de todo el piso con numeración CONSECUTIVA y su etiqueta ROC-N
 *  (ped. usuario): recorre los ramales rci en orden de creación y estampa `rociador#N` en cada
 *  accesorio rociador (cabeza → cuerpo en orden de vértice). El valor sigue matcheando
 *  /rociador/i (conteo del extractor y rectángulo de fuego intactos); el N del # es el que el
 *  glifo dibuja como «ROC-N». Ej: base RRCI1 con 3 + paralelos con 3 → ROC-1…ROC-6. */
export function renumeraRociadores(engine: IPlanoEngineCore): void {
  let n = 0;
  // rci: 'rociador' base, 'rociadorNF' (NO fluye) y los 4 tipos (montante/seco/oculto/área).
  // El flag NF y el tipo SOBREVIVEN el renumerado — solo el # cambia.
  const estampa = (v: string | undefined): string | undefined => {
    if (!v) return undefined;
    // El flag NF puede ir en CUALQUIER rociador (colgante o montante/seco/oculto/área) —
    // siempre justo antes del '#' ('rociadorMontanteNF#5').
    const m = /^(rociador(?:NF)?|rociador(?:Montante|Seco|Oculto|Area)(?:NF)?)(?:#(\d+))?$/.exec(v);
    return m ? `${m[1]}#${++n}` : undefined;
  };
  for (const r of engine.ramales) {
    if (r.net !== 'rci') continue;
    const inicio = estampa(r.accesorioInicio);
    if (inicio) r.accesorioInicio = inicio;
    const fin = estampa(r.accesorioFin);
    if (fin) r.accesorioFin = fin;
    if (!r.accMed) continue;
    const claves = Object.keys(r.accMed)
      .filter((k) => /^accMed\d+$/.test(k))
      .sort((x, y) => Number(x.slice(6)) - Number(y.slice(6)));
    for (const k of claves) {
      const v = estampa(r.accMed[k]);
      if (v) r.accMed[k] = v;
    }
  }
}

/** ¿El valor del accesorio es un ROCIADOR que fluye? (NF = no fluye, se excluye del conteo).
 *  El marcador NF va justo antes del '#' en cualquier tipo ('rociadorNF#3',
 *  'rociadorMontanteNF#5'). */
export function rociadorFluye(v: string | undefined): boolean {
  return !!v && /rociador/i.test(v) && !/NF(?:#|$)/.test(v);
}

/** Distancia en px entre rociadores VECINOS a lo largo de un ramal (orden vértice): devuelve
 *  el hueco MÁS GRANDE y la pareja de etiquetas que lo causa — null si hay < 2 rociadores. */
function huecoMaxS(
  r: PlanoRamal,
  esRoc: (v: string | undefined) => boolean,
): { hueco: number; de: string; a: string } | null {
  const posiciones: Array<{ d: number; lbl: string }> = [];
  if (esRoc(r.accesorioInicio)) posiciones.push({ d: 0, lbl: 'cabeza' });
  const dists: number[] = [0];
  for (let i = 1; i < r.pts.length; i++)
    dists.push(
      dists[i - 1] + Math.hypot(r.pts[i][0] - r.pts[i - 1][0], r.pts[i][1] - r.pts[i - 1][1]),
    );
  for (const [k, v] of Object.entries(r.accMed || {})) {
    const m = k.match(/^accMed(\d+)$/);
    if (!m || !esRoc(v)) continue;
    posiciones.push({ d: dists[+m[1]] ?? 0, lbl: `ROC-${v.split('#')[1] || '?'}` });
  }
  if (esRoc(r.accesorioFin)) posiciones.push({ d: dists[dists.length - 1] ?? 0, lbl: 'cola' });
  if (posiciones.length < 2) return null;
  posiciones.sort((a, b) => a.d - b.d);
  let peor: { hueco: number; de: string; a: string } | null = null;
  for (let i = 1; i < posiciones.length; i++) {
    const hueco = posiciones[i].d - posiciones[i - 1].d;
    if (!peor || hueco > peor.hueco)
      peor = { hueco, de: posiciones[i - 1].lbl, a: posiciones[i].lbl };
  }
  return peor;
}

/** VERIFICA la separación S del piso entre rociadores vecinos del ramal (ped. usuario: los
 *  MANUALES también la respetan). La S sale del espejo RCI (fila del piso activo; vacío = la
 *  global) o del override. Devuelve null si todo ok o sin S definida; string = mensaje. */
export function verificaSRociadores(
  engine: IPlanoEngineCore,
  ramalId: string,
  sMOverride?: number,
): string | null {
  const r = engine.ramales.find((x) => x.id === ramalId);
  if (!r || !r.pts || r.pts.length < 2) return null;
  // S del espejo del estado vivo (fresca, post-debounce de la pestaña):
  let sM: number | null = null;
  try {
    const raw = (globalThis as unknown as { localStorage?: Storage }).localStorage?.getItem(
      'civilflow_rci_estado_vivo',
    );
    if (raw) {
      const est = JSON.parse(raw) as {
        pisos?: { rows?: Array<{ planId?: string; S?: unknown }> };
        roc?: { S?: unknown };
      };
      const planId = String((engine as unknown as { _loadedPlanId?: unknown })._loadedPlanId ?? '');
      const fila = est.pisos?.rows?.find((f) => String(f.planId) === planId);
      const v = fila && fila.S !== '' && fila.S !== undefined ? fila.S : est.roc?.S;
      const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(',', '.'));
      if (n > 0) sM = n;
    }
  } catch {
    return null; // sin espejo legible: sin S conocida, no se valida
  }
  if (sMOverride && sMOverride > 0) sM = sMOverride;
  if (!sM || sM <= 0) return null;
  const peor = huecoMaxS(r, rociadorFluye);
  if (!peor) return null;
  const huecoM = engine.pxToM(peor.hueco);
  const sPx = cmToPlanePx(engine.scaleM, sM * 100);
  /* S EXACTA (ped. usuario 2026-11-13): la separación rociador-rociador debe coincidir con S;
   * NO valen ni menores ni mayores. Solo se tolera el error numérico mínimo del cálculo
   * geométrico (1e-6 px) — la tolerancia NO es un rango de aceptación. Ej: hueco 2,40 con
   * S 2,50 → alerta "2,40 ≠ 2,50". */
  const TOL_PX = 1e-6;
  if (Math.abs(peor.hueco - sPx) <= TOL_PX) return null;
  return `La separación entre rociadores ${peor.de} y ${peor.a} es de ${huecoM
    .toFixed(2)
    .replace(
      '.',
      ',',
    )} m y debe ser exactamente la S del piso (${String(sM).replace('.', ',')} m). Mueve un rociador o siémbrelos con «Dibujar rociadores» para respetar S.`;
}

/** Dirección ABSOLUTA de pantalla hacia donde salen los paralelos (ped. usuario): con trazo
 *  horizontal el modal ofrece Arriba/Abajo (−y/+y) y con vertical Izquierda/Derecha (−x/+x).
 *  El motor elige el signo de la normal para que el desplazamiento perpendicular (distancia L
 *  real) apunte a esa dirección. Ej: 'arriba' en un trazo →+x sale hacia −y. */
export type LadoParalelo = 'arriba' | 'abajo' | 'izq' | 'der';

/** Ramal rci nuevo (copia paralela o conector) a partir del molde del ramal base. */
function ramalDe(
  engine: IPlanoEngineCore,
  base: PlanoRamal,
  id: string,
  pts: [number, number][],
): PlanoRamal {
  return {
    id,
    net: 'rci',
    tipo: 'ramal',
    padre: null,
    pts,
    totalL: +calculateRamalLength(pts, engine).toFixed(3),
    label: id,
    ini: '',
    fin: '',
    piso: String(engine.nivelActual?.n ?? ''),
    dz: '',
    uc: 0,
    labelX: pts[0][0] + (pts[pts.length - 1][0] - pts[0][0]) / 2,
    labelY: pts[0][1] + (pts[pts.length - 1][1] - pts[0][1]) / 2,
    labelAngle: _firstSegmentAngle(pts),
    material: base.material || engine._ramalDefaults?.material || '',
    diametro: '',
    pendiente: base.pendiente ?? 2,
    bloqueado: false,
    _sinAccMedInterior: true,
  };
}

/** Crea `n` ramales rci paralelos al ramal dado, separados `lM` metros entre sí (el k-ésimo a
 *  k·L), desplazados en perpendicular al PRIMER segmento del trazo, hacia la dirección
 *  ABSOLUTA elegida, más el CONECTOR físico que une sus cabezas con la del base (la red queda
 *  unida de verdad: sin el conector el extractor los daría por conectados por proximidad y su
 *  longitud no entraría al cálculo de pérdidas — subestimación de la bomba). Ids/labels
 *  consecutivos (RRCIn), mismo material/pendiente que el base. VERIFICA MUROS antes de crear
 *  nada: MÍNIMO, ninguna copia a < MIN_MURO_M (0,10 m, NFPA 13) de ningún muro (gana siempre);
 *  MÁXIMO, los muros de la BANDA del grupo (a ≤ 2·Dmuro de las copias) deben quedar a ≤ Dmuro
 *  del ramal rci más cercano (base, copias o existentes). Si viola → NO se crea nada y devuelve
 *  el error con la peor distancia.
 *  Ej: base + 3 copias a L = 3.2 m → ids [RRCI2..4] + conector RRCI5 (3 tramos de L). */
export function crearRamalesParalelos(
  engine: IPlanoEngineCore,
  ramalId: string,
  lM: number,
  n: number,
  lado: LadoParalelo,
  dm: number | null | undefined,
): { ids: string[]; error: string | null } {
  const base = engine.ramales.find((x) => x.id === ramalId);
  if (!base || !base.pts || base.pts.length < 2 || n <= 0) return { ids: [], error: null };
  const lPx = cmToPlanePx(engine.scaleM, lM * 100);
  if (!(lPx > 0)) return { ids: [], error: null };
  const dx = base.pts[1][0] - base.pts[0][0];
  const dy = base.pts[1][1] - base.pts[0][1];
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return { ids: [], error: null };
  /* Dirección ABSOLUTA de pantalla (ped. usuario): el desplazamiento perpendicular (distancia
   * L real) toma el signo de la normal que apunta a la dirección pedida. N=(−dy,dx)/len;
   * componentes: N.x=−dy/len, N.y=dx/len. 'arriba'→N.y<0, 'abajo'→N.y>0, 'izq'→N.x<0,
   * 'der'→N.x>0 — en trazos 90° el resultado ES el eje pedido. */
  const Nx = -dy / len;
  const Ny = dx / len;
  const s =
    lado === 'arriba'
      ? Ny < 0
        ? 1
        : -1
      : lado === 'abajo'
        ? Ny > 0
          ? 1
          : -1
        : lado === 'izq'
          ? Nx < 0
            ? 1
            : -1
          : Nx > 0
            ? 1
            : -1;
  const nx = Nx * lPx * s;
  const ny = Ny * lPx * s;
  const candidatos: Array<{ pts: [number, number][] }> = [];
  for (let k = 1; k <= n; k++) {
    candidatos.push({
      pts: base.pts.map(([x, y]) => [x + nx * k, y + ny * k] as [number, number]),
    });
  }
  /* VERIFICACIÓN MUROS antes de crear nada. Dos violaciones independientes: MÍNIMO (copia a
   * < 0,10 m de un muro — gana SIEMPRE sobre el máximo, sea cual sea el orden en que se
   * detecten) y MÁXIMO (muro de la banda del grupo sin cobertura a ≤ Dmuro). */
  const muros = engine.guideLines.filter((g) => g.esMuro && g.pts && g.pts.length >= 2);
  if (muros.length) {
    let peorMin = Infinity;
    for (const c of candidatos) {
      for (const muro of muros) {
        const dM = engine.pxToM(distPoli(muro.pts, c.pts));
        if (dM < MIN_MURO_M - 1e-9 && dM < peorMin) peorMin = dM;
      }
    }
    if (peorMin < Infinity) {
      return {
        ids: [],
        error: `Los ramales no se pueden crear: alguno quedaría a ${peorMin.toFixed(2).replace('.', ',')} m de un muro y la distancia mínima a muro es de 0,10 m (NFPA 13). Aleje los ramales del muro.`,
      };
    }
    if (dm && dm > 0) {
      /* Muros de la BANDA del grupo: solo los que las copias podrían cubrir (a ≤ 2·Dmuro de
       * alguna copia) se exigen aquí — los lejanos esperan su propio ramal y los juzga la
       * verificación de tabla. El ramal más cercano incluye el base, las copias y los
       * ramales rci existentes. */
      const polis = [
        base.pts,
        ...candidatos.map((c) => c.pts),
        ...engine.ramales
          .filter((r) => r.net === 'rci' && r.tipo === 'ramal' && r.pts.length >= 2)
          .map((r) => r.pts),
      ];
      const bandaPx = (2 * dm) / factorMPorPx(engine.scaleM);
      let peor = 0;
      for (const muro of muros) {
        const dGrupo = Math.min(...candidatos.map((c) => distPoli(muro.pts, c.pts)));
        if (dGrupo > bandaPx) continue;
        const dMejor = Math.min(...polis.map((p) => distPoli(muro.pts, p)));
        const dMejorM = engine.pxToM(dMejor);
        if (dMejorM > dm + 1e-9 && dMejorM > peor) peor = dMejorM;
      }
      if (peor > 0) {
        return {
          ids: [],
          error: `Los ramales no se pueden crear: un muro de su zona quedaría a ${peor.toFixed(2).replace('.', ',')} m del ramal más cercano y la distancia máxima a muro (DMR) es de ${String(dm).replace('.', ',')} m. Dibuje un ramal más cerca de ese muro o aumente la DMR en RCI → Tipologías → Pisos del edificio.`,
        };
      }
    }
  }
  /* COPIA PURA (ped. usuario, ya resuelto antes): SIN conector entre paralelos — la conexión
   * la resuelve el extractor por proximidad perpendicular (tolPar en ExtractNetwork). */
  const ids: string[] = [];
  for (const c of candidatos) {
    const id = nextFreeRamalId(engine.ramales, 'RRCI');
    engine.ramales.push(ramalDe(engine, base, id, c.pts));
    ids.push(id);
  }
  renumeraRociadores(engine); // las copias heredaron los # del base: renumerar TODO el piso
  engine.render();
  engine._markDirty();
  return { ids, error: null };
}

/** Chequeo EN VIVO al terminar/mover un trazo rci (ped. usuario). Dos reglas:
 *  MÍNIMO — el trazo no puede quedar pegado ni cruzar un muro: a < MIN_MURO_M (0,10 m,
 *  NFPA 13) de CUALQUIER muro → alerta (la violación clara, independiente del Dmuro).
 *  MÁXIMO — SOLO el muro MÁS CERCANO al trazo (vertical u horizontal, da igual) debe quedar
 *  a ≤ Dmuro del ramal rci más cercano (el nuevo incluido): si el trazo es ese ramal, él
 *  mismo lo cubre; si otro ramal ya está más cerca, ese lo cubre y el trazo no bloquea. El
 *  Dmuro llega inyectado (engine.dmuroRci); null → el máximo no aplica.
 *  Ej: muro en banda a 2,65 m del trazo con Dmuro 1,70 → mensaje y trazo no creado. */
export function chequeoMurosTrazo(
  engine: IPlanoEngineCore,
  ptsNuevos: number[][],
  dm: number | null | undefined,
): string | null {
  const muros = engine.guideLines.filter((g) => g.esMuro && g.pts && g.pts.length >= 2);
  if (!muros.length) return null;
  /* MÍNIMO contra TODOS los muros (pegarse/cruzar es violación independientemente del Dmuro). */
  const minPx = cmToPlanePx(engine.scaleM, MIN_MURO_M * 100);
  for (const muro of muros) {
    const d = distPoli(muro.pts, ptsNuevos);
    if (d < minPx - 1e-9) {
      const dM = engine.pxToM(d);
      return `El trazo no se puede crear: queda a ${dM.toFixed(2).replace('.', ',')} m de un muro y la distancia mínima a muro es de 0,10 m (NFPA 13). Aleje el ramal del muro.`;
    }
  }
  if (!(dm && dm > 0)) return null;
  /* MÁXIMO (doctrina del usuario, 2026-11-13): PROXIMIDAD del trazado a los muros que tiene
   * cerca. Por cada TRAMO del trazado nuevo se mira su segmento de muro más cercano y ese
   * muro debe quedar a ≤ Dmuro del trazo. Sin cobertura de muestreo ni grupo BFS: en el
   * salón grande, el trazado pegado al muro superior pasa (su cercano está a ≤ Dmuro) y NO
   * bloquean las verticales/inferior lejanos ni las partes bajas descubiertas de un muro
   * cercano — esas las cubrirá el ramal que las trace. El MÍNIMO de 0,10 m sigue contra
   * TODOS los muros. Ej: trazo a 2,65 m del único muro con Dmuro 1,70 → bloquea. */
  let peor = 0;
  const tramos = ptsNuevos.length - 1;
  /* La red rci ya dibujada TAMBIÉN sirve de referencia (ped. usuario 2026-11-13: ramales que
   * conectan con la red existente no deben bloquear aunque estén lejos de los muros). El
   * trazado evaluado SE EXCLUYE: al mover (dragUp) el ramal ya vive en engine.ramales y sin
   * esto se cubriría a sí mismo a distancia 0 — el chequeo del máximo jamás aplicaría. */
  const redPx = engine.ramales
    .filter((r) => r.net === 'rci' && r.pts && r.pts.length >= 2 && r.pts !== ptsNuevos)
    .map((r) => r.pts);
  for (let ti = 0; ti < tramos; ti++) {
    const tramo = [ptsNuevos[ti], ptsNuevos[ti + 1]];
    let dc = Infinity;
    for (const muro of muros) {
      const d = distPoli(muro.pts, tramo);
      if (d < dc) dc = d;
    }
    for (const r of redPx) {
      const d = distPoli(r, tramo);
      if (d < dc) dc = d;
    }
    const dM = engine.pxToM(dc);
    if (dM > dm + 1e-9 && dM > peor) peor = dM;
  }
  if (peor === 0) return null;
  return `El trazo no se puede crear: queda a ${peor.toFixed(2).replace('.', ',')} m del muro más cercano y la distancia máxima a muro (DMR) es de ${String(dm).replace('.', ',')} m. Traza el ramal a ≤ ${String(dm).replace('.', ',')} m de los muros o aumente la DMR en RCI → Tipologías → Pisos del edificio.`;
}
