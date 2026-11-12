/**
 * Setters menores del motor (extraído verbatim de PlanoEngine.ts): red activa, tipo de tramo,
 * snap, rejilla, escala con re-base de la hoja, ghost seleccionado, reporte de rendimiento y el
 * saneo legacy del setter de bajantes. La clase PlanoEngine delega aquí en 1 línea.
 * Ej: setActiveNet(engine, 'san') hace que el próximo ramal se llame RS3.
 */
import type { IPlanoEngineCore, TramoType, PlanoBajante } from './PlanoState.ts';
import type { EngineFull } from './engineFull.ts';
import type { CrossFloorGhost } from '../../utils/associateBajanteAcrossFloors';
import { setScaleM as _setScaleM } from './PlanoEngineDrawing.ts';

/** Vista del motor para los setters que tocan miembros fuera de IPlanoEngineCore: el callback
 *  de cambio de red (lo llena onActiveNetChange) y setPageSize (dueña del tamaño de hoja). */
type EngineSetterView = IPlanoEngineCore & {
  _onActiveNetChangeCb: ((net: string) => void) | null;
  setPageSize(w: number, h: number): void;
};

/** Cambia la red con la que se dibuja: lo que traces sale con su color y su prefijo de etiqueta
 *  (af (Agua Fría) → RAF, ac (Agua Caliente) → RAC, san (Sanitaria) → RS, vent (Ventilación) →
 *  REV, ll (Lluvias) → RALL, gas (Gas) → RG). Ej: pasar a 'san' hace que el próximo ramal se
 *  llame RS3. */
export function setActiveNet(engine: EngineSetterView, id: string): void {
  if (engine.activeNet !== id) {
    engine.activeNet = id;
    if (engine._onActiveNetChangeCb) {
      engine._onActiveNetChangeCb(id);
    }
  }
}

export function setTipoTramo(engine: IPlanoEngineCore, t: TramoType): void {
  engine.tipoTramo = t;
}

/** Snap = el imán que obliga a los trazos a salir a 45°/90°. Apagarlo permite ángulos libres
 *  (si hay un trazo a medias se cancela). */
export function setSnap(engine: IPlanoEngineCore, v: boolean): void {
  if (engine.snapMode !== v && engine.activeRamal) engine.cancelRamal();
  engine.snapMode = v;
}

export function setGridMode(engine: IPlanoEngineCore, v: boolean): void {
  engine.gridMode = v;
  engine.render();
}

/** Fija la escala del plano (scaleM, la escala metros por pixel): 1 = 1:100, 0.5 = 1:50;
 *  acepta texto o número. Es la que convierte longitudes de pantalla a metros reales. */
export function setScaleM(engine: EngineSetterView, v: string | number): void {
  const prev = engine.scaleM;
  _setScaleM(engine, v);
  // La hoja mide en px de la escala ACTUAL: al cambiar la escala (re-base del doc a la
  // escala global, calibración) la medida de la lámina cambia con ella. Sin esto, el
  // lienzo queda con la medida vieja y el trazo se recorta en el borde de la hoja
  // ("recuadro", orig. usuario) hasta que el re-raster del fondo lo alcance.
  if (engine.pageW && engine.pageH && prev > 0 && Math.abs(engine.scaleM - prev) > 1e-9) {
    const f = engine.scaleM / prev;
    engine.setPageSize(engine.pageW * f, engine.pageH * f);
  }
}

export function getSelectedGhost(engine: IPlanoEngineCore): CrossFloorGhost | null {
  if (!engine.selectedGhostId) return null;
  return engine.crossFloorGhosts.find((g) => g.id === engine.selectedGhostId) || null;
}

/** Reporte legible del último render para la consola (`__cfPerf()`). */
export function reportePerf(engine: EngineFull): Record<string, unknown> {
  const c = engine._perf.capas;
  const ms = (n: number) => Math.round((n || 0) * 10) / 10;
  return {
    frame: engine._perf.frames,
    totalMs: ms(engine._perf.totalMs),
    capasMs: Object.fromEntries(Object.entries(c).map(([k, v]) => [k, ms(v)])),
    lienzo: {
      anchoCss: engine._canvasW,
      altoCss: engine._canvasH,
      dpr: engine.dpr,
      mp: +((engine._canvasW * engine._canvasH * engine.dpr * engine.dpr) / 1e6).toFixed(2),
    },
    elementos: {
      ramales: engine.ramales.length,
      puntos: engine.ramales.reduce((s, r) => s + (r.pts?.length || 0), 0),
      bajantes: engine.bajantes.length,
      areas: engine.areas.length,
      textos: engine.textAnnots.length,
      dims: (engine.dims || []).length,
    },
    camara: {
      zoom: +engine.zoom.toFixed(3),
      offX: Math.round(engine.offX),
      offY: Math.round(engine.offY),
    },
    hojas: { pageW: Math.round(engine.pageW), pageH: Math.round(engine.pageH) },
  };
}

/** Saneo legacy (orig. usuario): el bug de auto-conexión trataba el canal como bajante y
 *  le guardaba recibeDeIds/alimentaIds — el canal no es bajante y esas membresías lo
 *  "llenaban" hasta disparar "Bajante completo". Limpiar al cargar, idempotente. */
export function sanearBajantesLegacy(v: PlanoBajante[]): void {
  for (const b of v) {
    if (
      b.tipo === 'canal' &&
      ((b.recibeDeIds?.length || 0) > 0 || (b.alimentaIds?.length || 0) > 0)
    ) {
      b.recibeDeIds = [];
      b.alimentaIds = [];
    }
  }
}
