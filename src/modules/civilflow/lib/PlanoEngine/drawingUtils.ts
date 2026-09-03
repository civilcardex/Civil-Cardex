import { NETS, allocTributaryNumber, rootTributarioLabel } from './PlanoState';
import type { PlanoRamal, PlanoArea, IPlanoEngineCore } from './PlanoState';
import { _statusMsg } from './ramalMeasure';
import { diamPulgFromLabel } from '../../utils/diamPulgFromLabel';

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
