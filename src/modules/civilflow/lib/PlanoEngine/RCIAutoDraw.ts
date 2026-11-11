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
  const totalPx = r.pts.reduce(
    (acc, p, i) => (i === 0 ? 0 : acc + Math.hypot(p[0] - r.pts[i - 1][0], p[1] - r.pts[i - 1][1])),
    0,
  );
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
  /* Puntos a insertar (dist, x, y) cada pasoPx desde el inicio, sin llegar al último vértice
   * (el rociador final queda donde caiga; no se fuerza sobre el extremo). Posiciones ya
   * sembradas se saltan (idempotencia). */
  const inserciones: Array<{ x: number; y: number; idx: number; dist: number }> = [];
  for (let d = pasoPx; d < totalPx - 1e-6; d += pasoPx) {
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
  engine.render();
  engine._markDirty();
  return inserciones.length + (pusoInicio ? 1 : 0);
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
  /* CONECTOR (ped. usuario): tramo perpendicular que une la cabeza del base con la de cada
   * copia — vértices [cabeza base, cabeza copia 1, … cabeza copia n]. Con él el extractor
   * une las copias POR CONTACTO REAL (TOL_PUNTO) y la longitud del conector entra al cálculo. */
  const idConector = nextFreeRamalId(engine.ramales, 'RRCI');
  const ptsConector: [number, number][] = [
    base.pts[0] as [number, number],
    ...candidatos.map((c) => c.pts[0]),
  ];
  engine.ramales.push(ramalDe(engine, base, idConector, ptsConector));
  const ids: string[] = [];
  for (const c of candidatos) {
    const id = nextFreeRamalId(engine.ramales, 'RRCI');
    engine.ramales.push(ramalDe(engine, base, id, c.pts));
    ids.push(id);
  }
  engine.render();
  engine._markDirty();
  return { ids: [idConector, ...ids], error: null };
}

/** Chequeo EN VIVO al terminar/mover un trazo rci (ped. usuario). Dos reglas:
 *  MÍNIMO — el trazo no puede quedar pegado ni cruzar un muro: a < MIN_MURO_M (0,10 m,
 *  NFPA 13) de CUALQUIER muro → alerta (la violación clara, independiente del Dmuro).
 *  MÁXIMO — los muros de la BANDA del trazo (a ≤ 2·Dmuro de él) deben quedar a ≤ Dmuro del
 *  ramal rci más cercano (el nuevo incluido); los muros FUERA de la banda no bloquean (su
 *  cobertura la juzga la verificación de tabla). Sin esto, en un piso con muros en lados
 *  opuestos ningún trazo podría ser el primero. El Dmuro llega inyectado (engine.dmuroRci);
 *  null → el máximo no aplica.
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
  /* MÁXIMO: banda del trazo (muros a ≤ 2·Dmuro de él), juzgados contra el ramal rci MÁS
   * CERCANO — el nuevo incluido (ya está en engine.ramales al mover; en finRamal se pasa
   * aparte). */
  const polis = engine.ramales
    .filter((r) => r.net === 'rci' && r.tipo === 'ramal' && r.pts.length >= 2)
    .map((r) => r.pts);
  const bandaPx = (2 * dm) / factorMPorPx(engine.scaleM);
  let peor = 0;
  for (const muro of muros) {
    const dTrazo = distPoli(muro.pts, ptsNuevos);
    if (dTrazo > bandaPx) continue;
    const mejorM = engine.pxToM(Math.min(dTrazo, ...polis.map((p) => distPoli(muro.pts, p))));
    if (mejorM > dm + 1e-9 && mejorM > peor) peor = mejorM;
  }
  if (peor === 0) return null;
  return `El trazo no se puede crear: un muro de su zona quedaría a ${peor.toFixed(2).replace('.', ',')} m del ramal más cercano y la distancia máxima a muro (DMR) es de ${String(dm).replace('.', ',')} m. Dibuje el ramal más cerca del muro o aumente la DMR en RCI → Tipologías → Pisos del edificio.`;
}
