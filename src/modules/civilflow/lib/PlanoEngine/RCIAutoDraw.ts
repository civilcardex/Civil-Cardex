/** Dibujo automático de la red rci (Red Contra Incendio) con los S/L del proyecto: sembrar
 *  rociadores colgantes sobre un ramal cada S (m) desde el INICIO del trazo (pts[0]) y crear
 *  ramales paralelos al primero separados L (m) — con CONECTOR físico hasta las cabezas, para
 *  que la red quede realmente unida y su longitud entre al cálculo de pérdidas.
 *  Ej: sembrarRociadores(eng, 'RRCI1', 3.2) deja un rociador en la cabeza y uno cada 3,2 m. */
import type { IPlanoEngineCore, PlanoRamal } from './PlanoState.ts';
import { AVISO_S_DMR } from '../rci/tables.ts';
import { cmToPlanePx, factorMPorPx } from './planoCoords.ts';
import { calculateRamalLength } from './ramalMeasure.ts';
import { nextFreeRamalId } from './planoNumbering.ts';
import { _firstSegmentAngle } from './drawingAngles.ts';
import { distSegSeg, distToSegment, MIN_MURO_M } from '../shared/geometry.ts';
import { RCI_S_CIRCLES_KEY } from '../../constants/storage-keys.ts';

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
  /* CÍRCULOS DE RADIO S SOBRE LOS CENTROS (ped. usuario): la siembra ya NO se encierra en la
   * corrida recta más larga. Se recorre TODA la polilínea y cada nuevo rociador queda a S del
   * anterior, aunque el punto caiga en el SIGUIENTE SEGMENTO (el círculo de radio S centrado
   * en el último rociador corta la polilínea ahí). Las curvas/ángulos ya no cortan la serie. */
  let totalPx = 0;
  for (let i = 0; i < r.pts.length - 1; i++) {
    totalPx += Math.hypot(r.pts[i + 1][0] - r.pts[i][0], r.pts[i + 1][1] - r.pts[i][1]);
  }
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
  let omitidos = 0;
  for (const ins of inserciones.toSorted((a, b) => a.dist - b.dist)) {
    /* El círculo S puede aterrizar JUSTO en un vértice existente (esquina entre segmentos):
       no se duplica el vértice, solo se marca ese vértice con el rociador. */
    const idxExistente = ins.idx + offset;
    const existente = pts[idxExistente];
    const anterior = pts[idxExistente - 1];
    /* Tolerancia de 0,01 px de plano: la distancia acumulada por sumas sucesivas de S puede
       caer unos float por encima de la esquina y el punto ya no coincide exactamente. */
    const enVertice = (p: number[] | undefined): boolean =>
      !!p && Math.hypot(p[0] - ins.x, p[1] - ins.y) < 1e-2;
    const vertice = enVertice(existente)
      ? idxExistente
      : enVertice(anterior)
        ? idxExistente - 1
        : -1;
    if (vertice >= 0) {
      /* H-11 (remediación 2026-11-27): vértice con accesorio ya registrado (codo, tee u otro
       * rociador) NO se pisa — esa posición se omite y se informa al final. */
      const clave = `accMed${vertice}`;
      if (!accMed[clave]) {
        accMed[clave] = 'rociador';
      } else {
        omitidos++;
        continue;
      }
      continue;
    }
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
  if (omitidos > 0)
    engine._emitStatus(
      `${omitidos} posición(es) con accesorio existente: no se sembró rociador ahí.`,
    );
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

/** Fija el estado «Fluye» de UN rociador sin tocar su tipo ni su consecutivo ROC-N. El flag NF
 *  va justo antes del '#'. Ej: 'rociadorMontante#7' + false → 'rociadorMontanteNF#7'; el número
 *  7 no cambia, aunque el rociador deje de contarse para el cálculo. */
export function fijarFluyeRociador(v: string, fluye: boolean): string {
  const [base, num] = v.split('#');
  const tipo = base.replace(/NF$/, '');
  if (!/rociador/i.test(tipo)) return v;
  return `${tipo}${fluye ? '' : 'NF'}${num ? `#${num}` : ''}`;
}

/** ¿Están visibles los círculos guía de radio S en este motor? */
export function circulosSVisibles(engine: IPlanoEngineCore): boolean {
  return engine.sCirclesVisible !== false;
}

/** Enciende/apaga los círculos S desde el menú contextual o el panel del ramal. Se recuerda en
 *  sessionStorage para que el visor arranque igual. Devuelve el nuevo estado. */
export function alternarCirculosS(engine: IPlanoEngineCore): boolean {
  const visible = !circulosSVisibles(engine);
  engine.sCirclesVisible = visible;
  if (typeof sessionStorage !== 'undefined')
    sessionStorage.setItem(RCI_S_CIRCLES_KEY, String(visible));
  engine.render();
  return visible;
}

/** Etiqueta ROC-N de un rociador de extremo (inicio/fin), sacada de su consecutivo `#`.
 *  Ej: 'rociadorMontante#7' → 'ROC-7'. null si el accesorio no es un rociador numerado. */
export function numeroRociador(v: string | undefined): string | null {
  const m = /^(?:rociador(?:NF)?|rociador(?:Montante|Seco|Oculto|Area)(?:NF)?)#(\d+)$/.exec(
    String(v || ''),
  );
  return m ? `ROC-${m[1]}` : null;
}

/** Al CREAR un rociador con muro marcado pero sin S: avisa y NO deja colocar el accesorio.
 *  El dato está en RCI → Tipologías → Pisos del edificio (columna S); las verificaciones enlazan
 *  ahí con `go: ['tipologias','pisos']`. Devuelve true si bloqueó la acción. */
export function avisoSinSConMuro(engine: IPlanoEngineCore): boolean {
  const conMuro = (engine.guideLines || []).some((g) => g.esMuro === true);
  if (!conMuro || (engine.sRci != null && engine.sRci > 0)) return false;
  engine.triggerAlert('Define S para verificar la distancia entre muro y rociador', AVISO_S_DMR);
  return true;
}

/** ¿Este RAMAL tiene al menos un rociador sembrado? (base 'rociador'/'rociadorMontante' en
 *  extremos y accMed, con o sin NF ni # — la misma detección del renderer de círculos S).
 *  Ej: el botón «Ocultar círculos S» solo aparece con el ramal seleccionado con rociadores. */
export function ramalConRociadores(r: PlanoRamal | undefined | null): boolean {
  if (!r || r.net !== 'rci') return false;
  const esRoc = (v: unknown): boolean => {
    const base = String(v || '')
      .split('#')[0]
      .replace(/NF$/, '');
    return base === 'rociador' || base === 'rociadorMontante';
  };
  return (
    esRoc(r.accesorioInicio) ||
    esRoc(r.accesorioFin) ||
    Object.values(r.accMed || {}).some((v) => esRoc(String(v)))
  );
}

/** Valor guardado al CREAR un rociador: entra como «No fluye» hasta que el usuario lo active.
 *  Ej: elegir «Rociador montante» guarda 'rociadorMontanteNF' (y luego el consecutivo '#N'). */
export function valorRociadorNuevo(accId: string): string {
  return /rociador/i.test(accId) && !/NF(?:#|$)/.test(accId) ? `${accId}NF` : accId;
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
  /* VERIFICACIÓN MUROS antes de crear nada. Dos violaciones independientes: MÍNIMO (copia a
   * < 0,10 m de un muro — gana SIEMPRE sobre el máximo, sea cual sea el orden en que se
   * detecten) y MÁXIMO (muro de la banda del grupo sin cobertura a ≤ Dmuro). El chequeo de
   * DMR vive SOLO en el dibujo (ped. usuario 2026-11-27). */
  const muros = engine.guideLines.filter((g) => g.esMuro && g.pts && g.pts.length >= 2);
  if (muros.length) {
    if (dm == null) return { ids: [], error: AVISO_S_DMR };
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
       * alguna copia) se exigen aquí — los lejanos esperan su propio ramal. El ramal más
       * cercano incluye el base, las copias y los ramales rci existentes. */
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
          error: `Los ramales no se pueden crear: un muro de su zona quedaría a ${peor.toFixed(2).replace('.', ',')} m del ramal más cercano y la distancia máxima a muro (DMR) es de ${String(dm).replace('.', ',')} m. Dibuje un ramal más cerca de ese muro.`,
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
 *  MÁXIMO — DIRECCIONAL (ped. usuario 2026-11-27): trazo HORIZONTAL vs muro VERTICAL se mide
 *  con los EXTREMOS del trazo (el ramal debe LLEGAR a ≤ Dmuro del muro vertical más cercano a
 *  cada lado); trazo VERTICAL vs muro HORIZONTAL, ídem con sus extremos; trazo PARALELO al
 *  muro se mide con la distancia perpendicular del cuerpo. Multisegmento: la regla aplica POR
 *  SEGMENTO según su propia dirección. La excusa («otro ramal ya cubre ese muro») se mide
 *  igual, con la misma regla direccional. El chequeo de DMR vive SOLO en el dibujo.
 *  Ej: muro en banda a 2,65 m del trazo con Dmuro 1,70 → mensaje y trazo no creado. */
export function chequeoMurosTrazo(
  engine: IPlanoEngineCore,
  ptsNuevos: number[][],
  dm: number | null | undefined,
): string | null {
  const muros = engine.guideLines.filter((g) => g.esMuro && g.pts && g.pts.length >= 2);
  if (!muros.length) return null;
  if (dm == null) return AVISO_S_DMR;
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
  /* MÁXIMO POR SEGMENTO Y POR EJE (ped. usuario, ramal multisegmento): CADA tramo se comprueba
   * contra los muros PARALELOS a él — horizontal contra horizontales, vertical contra
   * verticales. Así un tramo horizontal puede cumplir y el vertical quedar lejos del muro
   * vertical: eso bloquea, aunque el vertical esté pegado al ramal horizontal. Un muro se
   * excusa solo si OTRO ramal está a ≤ Dmuro DE ESE MURO. Muros a más de 3·Dmuro esperan su
   * propio ramal (salón grande). El MÍNIMO de 0,10 m sigue contra TODOS los muros. */
  const dmPx = cmToPlanePx(engine.scaleM, dm * 100);
  let peor = 0;
  const aristas = muros.flatMap(({ pts }) => pts.slice(1).map((b, i) => [pts[i], b]));
  /* El trazado evaluado SE EXCLUYE de la red existente: al mover (dragUp) el ramal ya vive en
   * engine.ramales y sin esto se cubriría a sí mismo a distancia 0. */
  const redPx = engine.ramales
    .filter((r) => r.net === 'rci' && r.pts && r.pts.length >= 2 && r.pts !== ptsNuevos)
    .map((r) => r.pts);
  const tramos = ptsNuevos.slice(1).map((b, i) => [ptsNuevos[i], b]);
  const otros = redPx.flatMap((pts) => pts.slice(1).map((b, i) => [pts[i], b]));
  /* Distancia arista↔tramo SEGÚN LA DIRECCIÓN relativa (ped. usuario 2026-11-27):
   *  - paralelos: distancia perpendicular entre segmentos (cuerpo del ramal);
   *  - perpendiculares: desde los EXTREMOS del tramo hasta el muro (el ramal debe LLEGAR);
   *  - diagonal: distancia real entre segmentos. Ej: trazo horizontal a 2 m de un muro
   *    vertical se juzga con dónde TERMINA el trazo, no con su cuerpo. */
  /* Coseno director entre dos segmentos (0 = perpendiculares, 1 = paralelos). */
  const cosCon = (s1: number[][], s2: number[][]): number => {
    const l1 = Math.hypot(s1[1][0] - s1[0][0], s1[1][1] - s1[0][1]) || 1;
    const l2 = Math.hypot(s2[1][0] - s2[0][0], s2[1][1] - s2[0][1]) || 1;
    return Math.abs(
      ((s1[1][0] - s1[0][0]) * (s2[1][0] - s2[0][0]) +
        (s1[1][1] - s1[0][1]) * (s2[1][1] - s2[0][1])) /
        (l1 * l2),
    );
  };
  const dArista = (edge: number[][], t: number[][]): number => {
    const cos = cosCon(edge, t);
    if (cos >= 0.85) return distSegSeg(edge[0], edge[1], t[0], t[1]); // paralelos: perpendicular del cuerpo
    if (cos <= 0.15)
      // perpendiculares: EXTREMOS del tramo contra el muro
      return Math.min(distToSegment(t[0], edge[0], edge[1]), distToSegment(t[1], edge[0], edge[1]));
    return distSegSeg(edge[0], edge[1], t[0], t[1]); // diagonal: distancia real
  };
  /* Perpendiculares: SOLO los muros INMEDIATAMENTE más cercanos (ped. usuario 2026-11-27).
   * Por cada tramo y cada lado (delante/detrás a lo largo de SU dirección) se juzga la arista
   * perpendicular más cercana; las lejanas del mismo lado esperan su propio ramal. Las aristas
   * que quedan ENMEDIO del recorrido del tramo se juzgan siempre. */
  const juzgar = new Set<number>();
  const perpIdx: number[] = [];
  for (let i = 0; i < aristas.length; i++)
    if (tramos.some((t) => cosCon(aristas[i], t) <= 0.15)) perpIdx.push(i);
  for (const t of tramos) {
    const u = [t[1][0] - t[0][0], t[1][1] - t[0][1]];
    const lu2 = u[0] * u[0] + u[1] * u[1] || 1;
    const proy = (p: number[]): number => ((p[0] - t[0][0]) * u[0] + (p[1] - t[0][1]) * u[1]) / lu2;
    const tMin = Math.min(proy(t[0]), proy(t[1]));
    const tMax = Math.max(proy(t[0]), proy(t[1]));
    const mejor: Record<'fin' | 'inicio', { i: number; d: number }> = {
      fin: { i: -1, d: Infinity },
      inicio: { i: -1, d: Infinity },
    };
    for (const i of perpIdx) {
      const [a, b] = aristas[i];
      const pa = proy(a);
      const pb = proy(b);
      const lado =
        Math.max(pa, pb) <= tMin + 1e-9 ? 'inicio' : Math.min(pa, pb) >= tMax - 1e-9 ? 'fin' : null; // enmedio del recorrido: se juzga
      if (lado === null) {
        juzgar.add(i);
        continue;
      }
      const d = dArista(aristas[i], t);
      if (d < mejor[lado].d) mejor[lado] = { i, d };
    }
    for (const lado of ['fin', 'inicio'] as const)
      if (mejor[lado].i >= 0) juzgar.add(mejor[lado].i);
  }
  for (let i = 0; i < aristas.length; i++) {
    const edge = aristas[i];
    const esPerp = perpIdx.includes(i);
    if (esPerp && !juzgar.has(i)) continue; // muro lejano del mismo lado: espera su ramal
    let d = Infinity;
    for (const tramo of tramos) d = Math.min(d, dArista(edge, tramo));
    if (d <= dmPx + 1e-9) continue;
    if (!esPerp && d > 3 * dmPx + 1e-9) continue;
    /* Excusa SOLO en pares paralelos: otro ramal rci corre junto al muro y lo cubre. En los
     * PERPENDICULARES la cobertura se exige AL TRAZO NUEVO con sus extremos — la esquina o el
     * extremo de la red existente NO tapa un muro vertical entero (ped. usuario 2026-11-27). */
    if (!esPerp && otros.some((tramo) => dArista(edge, tramo) <= dmPx + 1e-9)) continue;
    peor = Math.max(peor, d);
  }
  if (peor === 0) return null;
  const peorM = engine.pxToM(peor);
  return `El trazo no se puede crear: queda a ${peorM.toFixed(2).replace('.', ',')} m del muro más cercano y la distancia máxima a muro (DMR) es de ${String(dm).replace('.', ',')} m. Traza el ramal a ≤ ${String(dm).replace('.', ',')} m de los muros.`;
}
