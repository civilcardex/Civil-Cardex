import { NETS, allocTributaryNumber, rootTributarioLabel } from './PlanoState';
import type { PlanoRamal, PlanoArea, IPlanoEngineCore } from './PlanoState';
import { _statusMsg } from './ramalMeasure';
import { diamPulgFromLabel } from '../../utils/diamPulgFromLabel';
import { distToPolyline } from '../shared/geometry';

/** Siguiente etiqueta automática para la red activa (R{n}, o T{n}{padre} si se está dibujando un tributario). */
export function _nextLabel(engine: IPlanoEngineCore): string {
  const net = NETS.find((n) => n.id === engine.activeNet);
  const pfx = net ? net.lbl : 'R';
  if (engine.tipoTramo === 'tributario') {
    const padreLabel = rootTributarioLabel(engine.ramales, engine.padreTributario);
    return `T${allocTributaryNumber(engine, padreLabel)}${padreLabel}`;
  }
  const cnt =
    engine._netCounts[engine.activeNet]?.[
      engine.tipoTramo as keyof (typeof engine._netCounts)[string]
    ] || 0;
  return `${pfx}${cnt}`;
}

// Invierte la dirección de un ramal en el sitio: revierte el orden de sus puntos e intercambia
// todo campo simétrico por extremo para que cada uno siga refiriéndose al extremo físico
// correcto después. Las flechas de dirección de flujo (renderRamales.ts, derivadas en vivo de
// pts[0] vs pts[último]) se voltean solas como resultado — no hace falta un campo de dirección
// aparte.
/** Invierte un ramal en el sitio: revierte el orden de los puntos e intercambia los datos por extremo (accesorios, diámetros, ini/fin). Las flechas de flujo se voltean solas. */
export function reverseRamalEndpoints(ramal: PlanoRamal): void {
  const tmpAcc = ramal.accesorioInicio;
  ramal.accesorioInicio = ramal.accesorioFin;
  ramal.accesorioFin = tmpAcc;
  const tmpDiam = ramal.diametroInicio;
  ramal.diametroInicio = ramal.diametroFin;
  ramal.diametroFin = tmpDiam;
  const tmpApp = ramal.aparatoInicio;
  ramal.aparatoInicio = ramal.aparatoFin;
  ramal.aparatoFin = tmpApp;
  const tmpIniFin = ramal.ini;
  ramal.ini = ramal.fin;
  ramal.fin = tmpIniFin;
  ramal.pts.reverse();
}

/** Punto medio de la polilínea por longitud recorrida (no el vértice central). */
export function _midpoint(pts: number[][]): [number, number] {
  let totalLen = 0;
  const segLens: number[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const l = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
    segLens.push(l);
    totalLen += l;
  }
  const half = totalLen / 2;
  let acc = 0;
  for (let i = 0; i < segLens.length; i++) {
    if (acc + segLens[i] >= half) {
      const t = segLens[i] > 0 ? (half - acc) / segLens[i] : 0;
      return [
        pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t,
        pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t,
      ];
    }
    acc += segLens[i];
  }
  return [pts[pts.length - 1][0], pts[pts.length - 1][1]];
}

/** Área del polígono en m² reales, según la escala del plano. */
export function _calcPolyArea(engine: IPlanoEngineCore, pts: number[][]): number {
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    area += pts[i][0] * pts[j][1];
    area -= pts[j][0] * pts[i][1];
  }
  area = Math.abs(area) / 2;
  const m2 = area * Math.pow((2.54 * engine.scaleM) / 96, 2);
  return +m2.toFixed(2);
}

// El diámetro se guarda como el valor completo del dropdown, p.ej. `1-1/2" — 42.7 mm` (ver el
// selector "Diámetro de ramal" en DrawingElementContextMenu.tsx, que a su vez tiene que
// hacer `.split(' — ')[0]` antes de mostrarlo). Pasar esa cadena completa a diamPulgFromLabel
// dispara su propio manejo de em-dash, que lee la cifra en *mm* después del guion como si
// fueran pulgadas (42.7 en vez de 1.5) — comparar dos números así de inflados y esencialmente
// aleatorios hacía que la elección del "diámetro padre mayor" se viera arbitraria/mal.
/** Parte en pulgadas de una etiqueta de diámetro completa: `1-1/2" — 42.7 mm` → `1-1/2"`. Comparar la etiqueta completa confundía los mm con pulgadas. */
export function inchPartOfDiametro(d: string): string {
  const q = d.indexOf('"');
  return q > 0 ? d.slice(0, q) : d;
}

/** El mayor de dos diámetros, comparados por sus pulgadas reales. */
export function maxDiametroLabel(a: string, b: string): string {
  const va = diamPulgFromLabel(inchPartOfDiametro(a || ''));
  const vb = diamPulgFromLabel(inchPartOfDiametro(b || ''));
  if (!va) return b || a;
  if (!vb) return a || b;
  return vb > va ? b : a;
}

/** dNominal resultante al asociar ramales a un bajante/montante: el mayor entre el actual y
 *  los asociados (solo sube, nunca baja). @returns nuevo dNominal, o null si no cambia. */
export function bumpBajanteToMaxRamal(
  ramales: Array<{ id: string; diametro?: string }>,
  recibeDeIds: string[] | undefined,
  curDNominal: string,
): string | null {
  let maxRam = '';
  for (const rid of recibeDeIds || []) {
    const rr = ramales.find((x) => x.id === rid);
    if (rr?.diametro) maxRam = maxDiametroLabel(maxRam, rr.diametro);
  }
  if (maxRam && diamPulgFromLabel(maxRam) > diamPulgFromLabel(curDNominal || '')) return maxRam;
  return null;
}

/** dNominal resultante al CAMBIAR el diámetro de un ramal: el bajante sigue al máximo de sus
 *  asociados en ambas direcciones — si seguía al máximo anterior (o estaba vacío), adopta el
 *  nuevo; un oversize explícito mayor se conserva salvo que el nuevo máximo lo supere.
 *  @returns nuevo dNominal, o null si no cambia. */
export function followBajanteToMaxRamal(
  ramales: Array<{ id: string; diametro?: string }>,
  recibeDeIds: string[] | undefined,
  curDNominal: string,
  changedId: string,
  oldLabel: string,
  newLabel: string,
): string | null {
  let maxOthers = '';
  for (const rid of recibeDeIds || []) {
    if (rid === changedId) continue;
    const rr = ramales.find((x) => x.id === rid);
    if (rr?.diametro) maxOthers = maxDiametroLabel(maxOthers, rr.diametro);
  }
  const newMax = maxDiametroLabel(maxOthers, newLabel);
  const oldMax = maxDiametroLabel(maxOthers, oldLabel);
  const curIn = diamPulgFromLabel(curDNominal || '');
  const newIn = diamPulgFromLabel(newMax);
  const oldIn = diamPulgFromLabel(oldMax);
  if (!newIn) return null;
  if (curIn === oldIn) return newIn === curIn ? null : newMax;
  if (newIn > curIn) return newMax;
  return null;
}

/** Cancela el dibujo del ramal activo sin persistir. @param engine Instancia del motor. */
export function cancelRamal(engine: IPlanoEngineCore): void {
  engine._yeeFlashKey = null;
  engine.activeRamal = null;
  engine._emitStatus(_statusMsg(engine));
  engine.render();
  engine._markDirty();
}

/** Cancela el dibujo del área activa sin persistir. @param engine Instancia del motor. */
export function cancelArea(engine: IPlanoEngineCore): void {
  engine.activeArea = null;
  engine._emitStatus(_statusMsg(engine));
  engine.render();
}

/** Termina el polígono del área activa, calculando su área en m² y agregándola al plano.
 *  @param engine Instancia del motor. */
export function finishArea(engine: IPlanoEngineCore): void {
  if (!engine.activeArea || engine.activeArea.pts.length < 3) {
    engine.activeArea = null;
    return;
  }
  const pts = engine.activeArea.pts;
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  const areaCnt = engine.areas.length + 1;
  const area: PlanoArea = {
    id: 'AR' + Date.now(),
    pts: pts.map((p) => [...p]),
    color: engine.activeArea.color || 'rgba(0,220,229,0.2)33',
    net: engine.activeNet,
    label: 'AREA' + areaCnt,
    labelX: cx,
    labelY: cy,
    labelAngle: 0,
    areaM2: _calcPolyArea(engine, pts),
  };
  engine.areas.push(area);
  engine.activeArea = null;
  engine.selId = area.id;
  engine._emitSelect(area);
  engine._emitStatus(_statusMsg(engine));
  engine.render();
  engine._markDirty();
}

/** Fija la escala de dibujo (metros por píxel) y recalcula las longitudes de todos los ramales.
 *  @param engine Instancia del motor. @param v Valor de escala como string o número. */
export function setScaleM(engine: IPlanoEngineCore, v: string | number): void {
  engine.scaleM = parseFloat(String(v)) || 0.5;
  engine.ramales.forEach((r) => {
    r.totalL = 0;
    for (let i = 0; i < r.pts.length - 1; i++) {
      const [x1, y1] = r.pts[i],
        [x2, y2] = r.pts[i + 1];
      r.totalL += engine.pxToM(Math.hypot(x2 - x1, y2 - y1));
    }
    r.totalL = +r.totalL.toFixed(3);
  });
  engine.render();
}

/** Fija la escala de referencia definida por el usuario (p.ej. desde una dimensión conocida del
 *  PDF) sin recalcular longitudes. @param engine Instancia del motor. @param v Valor de escala
 *  como string o número. */
export function setDefinedScaleM(engine: IPlanoEngineCore, v: string | number): void {
  engine.definedScaleM = parseFloat(String(v)) || 0;
  engine.render();
}

// Ítems 5+6: el ramal receptor toma el MAYOR diámetro de los ramales que llegan a él, y cada
// cambio de diámetro re-dispara el cálculo aguas abajo (suba o baje). Única fuente de la
// regla — la llaman updateElementById (menú, panel, aparatos), finishRamal (creación ya lo
// hace en su herencia) y el path tabla→dibujo. Mutación directa sin snapshots por nodo: el
// caller emite UN snapshot para toda la operación. @param ramales Red actual (motor o
// storage). @param _changedId Reservado (origen del cambio; el recálculo es global).
/** Extremo de descarga de un ramal según su dirección de flujo: san/ll/vent drenan hacia
 *  la unión; el resto fluye pts[0]→pts[último]. Misma convención que el recálculo de
 *  receptores de abajo; la usa también la herencia direccional de finishRamal. */
export function ramalDischargeEnd(r: {
  net?: string;
  pts?: number[][];
  _tribReversed?: boolean;
}): number[] | null {
  if (!r.pts || r.pts.length < 2) return null;
  if ((r.net === 'san' || r.net === 'll' || r.net === 'vent') && r._tribReversed) return r.pts[0];
  return r.pts[r.pts.length - 1];
}

/** ¿R continúa aguas abajo del punto Q (en su dirección de flujo)? Sin esto, un tributario
 *  que descarga justo en el extremo FINAL de un tramo lo marcaría como receptor, o una
 *  descarga que sigue de largo por su propia línea se leería como alimentación a una rama
 *  que en realidad entrega. */
export function ramalContinuesPast(
  r: {
    net?: string;
    pts?: number[][];
    _tribReversed?: boolean;
  },
  q: number[],
  tol = 2.0,
): boolean {
  if (!r.pts || r.pts.length < 2) return false;
  const reversed = (r.net === 'san' || r.net === 'll' || r.net === 'vent') && r._tribReversed;
  const seq = reversed ? [...r.pts].reverse() : r.pts;
  let total = 0;
  const segLens: number[] = [];
  for (let i = 0; i < seq.length - 1; i++) {
    const l = Math.hypot(seq[i + 1][0] - seq[i][0], seq[i + 1][1] - seq[i][1]);
    segLens.push(l);
    total += l;
  }
  if (total < 1e-9) return false;
  let sMax = -Infinity;
  let acc = 0;
  for (let i = 0; i < seq.length - 1; i++) {
    const [ax, ay] = seq[i];
    const [bx, by] = seq[i + 1];
    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    if (lenSq > 1e-12) {
      const t = Math.max(0, Math.min(1, ((q[0] - ax) * dx + (q[1] - ay) * dy) / lenSq));
      const px = ax + t * dx;
      const py = ay + t * dy;
      if (Math.hypot(q[0] - px, q[1] - py) < tol) sMax = Math.max(sMax, acc + t * segLens[i]);
    }
    acc += segLens[i];
  }
  return sMax >= 0 && total - sMax > tol;
}
/** Recalcula receptores como el mayor de sus alimentadores actuales, hasta punto fijo. */
export function recomputeDownstreamDiameters(
  ramales: Array<{
    id: string;
    net: string;
    pts?: number[][];
    diametro?: string;
    mergesFrom?: string[];
    _tribReversed?: boolean;
  }>,
  _changedId: string,
): void {
  const TOL = 2.0;
  const byId = new Map(ramales.map((r) => [r.id, r]));
  // Pares hermanos de un mismo split: no son alimentador/receptor entre sí.
  const mergeSiblingPairs = new Set<string>();
  for (const r of ramales) {
    if (r.mergesFrom) mergeSiblingPairs.add([...r.mergesFrom].sort().join('|'));
  }
  const dischargeEnd = (r: (typeof ramales)[number]): number[] | null => ramalDischargeEnd(r);
  // ¿R continúa aguas abajo del punto Q (en su dirección de flujo)? Sin esto, un tributario
  // que descarga justo en el extremo FINAL de un tramo lo marcaría como receptor y el tramo
  // aguas arriba subiría de diámetro con un caudal que en realidad sigue por otro lado.
  const continuesPast = (r: (typeof ramales)[number], q: number[]): boolean =>
    ramalContinuesPast(r, q, TOL);
  // Alimentadores geométricos de R: ramales cuya descarga toca el cuerpo de R en un punto
  // desde el cual R TODAVÍA continúa aguas abajo (redes de recolección san/ll/vent — en
  // presión manda mergesFrom + guards de nodo).
  const geometricFeedersOf = (r: (typeof ramales)[number]): Array<(typeof ramales)[number]> => {
    if (r.net !== 'san' && r.net !== 'll' && r.net !== 'vent') return [];
    if (!r.pts || r.pts.length < 2) return [];
    const out: Array<(typeof ramales)[number]> = [];
    for (const f of ramales) {
      if (f.id === r.id || f.net !== r.net) continue;
      if (!f.diametro) continue;
      if (mergeSiblingPairs.has([f.id, r.id].sort().join('|'))) continue;
      const end = dischargeEnd(f);
      if (!end) continue;
      if (distToPolyline(end, r.pts) < TOL && continuesPast(r, end)) out.push(f);
    }
    return out;
  };
  for (let pass = 0; pass < 20; pass++) {
    let touched = false;
    for (const r of ramales) {
      if (!r.pts || r.pts.length < 2) continue;
      let want = '';
      if (r.mergesFrom) {
        for (const pid of r.mergesFrom) {
          const p = byId.get(pid);
          if (p?.diametro) want = maxDiametroLabel(want, p.diametro);
        }
      } else {
        for (const f of geometricFeedersOf(r)) want = maxDiametroLabel(want, f.diametro || '');
      }
      if (want && want !== (r.diametro || '')) {
        r.diametro = want;
        touched = true;
      }
    }
    if (!touched) break;
  }
}
