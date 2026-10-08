// Creación/commit de canales (glifo, ancho, eje). canalEjeTs es privado del bloque.
import type { IPlanoEngineCore } from '../PlanoState';
import { _statusMsg } from '../ramalMeasure';
import { pisoCortoLoose } from '../../../constants';
import {
  geometriaCanalDesdePuntos,
  geometriaCanalAncho,
  normalizarCanal,
  pxPerCmDe,
  esquinasCanalOBB,
  canalMarco,
  puntoAnchoMinimo,
  CANAL_ANCHO_MIN_CM,
} from '../canalAssociation';

// El bajante solo pertenece a san/vent/ll, el montante solo a gas/ac/af — misma regla que
// aplican la barra de herramientas (isToolDisabledForNet en PdfViewerToolbar.tsx) y los atajos
// de teclado (PlanoEngine.ts _onKeyDownHandler); se re-chequea aquí como defensa en
// profundidad por si algún otro caller llega a estas funciones sin pasar por ninguna de esas
// compuertas.
// Canal recolectora (canalón de techo) — un símbolo independiente, mismo patrón de array/sin-
// asociación-a-ramal que contador/calentador, exclusivo de la red 'll' (aguas lluvias). A
// diferencia de toda otra herramienta de glifo puntual, es un RECTÁNGULO dibujado por clics:
// el primer clic fija el inicio del EJE (_canalStart, mismo patrón clic-mueve-clic de goma que
// _dimStart/_guideStart), una vista previa en vivo sigue al cursor (renderCanalGhost), el
// segundo clic fija el EXTREMO del eje — para TODA orientación (orig. usuario: horizontal y
// vertical funcionan igual que la diagonal; el eje queda ajustado al cardinal si el trazo roza
// ≤15°) — y el tercer clic define el ANCHO perpendicular al eje (geometriaCanalAncho; un punto
// que proyecta más allá del extremo lo alarga). Así el canal queda a escala del plano desde el
// momento en que se dibuja y el ancho nunca sale "de casualidad" del arrastre. Una vez creado,
// todavía puede redimensionarse desde sus esquinas (_tryCanalResizeHit en handleMouseDown.ts) o
// editarse con precisión por el menú contextual (CanalMenu). A diferencia del bajante (que
// agrega su sufijo de piso solo al renderizar, porque un bajante puede abarcar pisos), el piso
// queda incrustado en el code/id aquí al crearlo — un canal vive en un solo piso.

/** Timestamp del clic que fijó _canalEje (module-scope: los campos _canal* viven en
 *  PlanoState/PlanoEngine, fuera del alcance de este cambio) — detecta el doble-clic. */
let canalEjeTs = 0;
/** Maneja un clic con la herramienta de canal activa: el 1er clic fija el inicio del eje, el
 *  2º fija su extremo (siempre modo eje, también horizontal/vertical — orig. usuario) y el
 *  3er clic define el ancho (commitCanalAncho). Exclusivo de la red de aguas lluvias (ll).
 *  @param engine Instancia del motor. @param px Coordenada X de plano. @param py Coordenada Y
 *  de plano. */
export function handleCanalDown(engine: IPlanoEngineCore, px: number, py: number): void {
  if (!engine.activeNetworks || !engine.activeNetworks.has('recolectora')) {
    engine._emitStatus('Canal no disponible — activa la red canal recolectora');
    return;
  }
  if (engine.snapMode) {
    const sp = engine.snapToExisting(px, py);
    if (sp) {
      px = sp.x;
      py = sp.y;
    }
  }
  // Fase de ancho: el eje ya quedó fijo con el 2º clic — este clic define el ancho.
  if (engine._canalEje) {
    // Doble-clic de término (orig. usuario): el 2º clic del dblclick cae en fase-ancho con
    // dist≈0 — si llega <350 ms tras fijar el eje se ignora (no infla a 20 cm ni crea).
    if (Date.now() - canalEjeTs < 350) return;
    commitCanalAncho(engine, px, py);
    return;
  }
  if (!engine._canalStart) {
    engine._canalStart = { x: px, y: py };
    engine._emitStatus('Canal — clic fija el eje, luego el ancho');
    engine.render();
    return;
  }
  const s = engine._canalStart;
  engine._canalStart = null;
  // Geometría compartida con el ghost (eje + ancho para toda orientación): el eje queda
  // ajustado al cardinal si el trazo roza ≤15° y normalizado a base-corta al crear (ítem 5).
  const g = geometriaCanalDesdePuntos(s, { x: px, y: py }, (d) => engine.pxToM(d));
  if (!g) {
    engine._emitStatus(_statusMsg(engine));
    engine.render();
    return;
  }
  // El ancho NO sale del arrastre: fija el eje y espera el siguiente clic (WYSIWYG en ghost).
  engine._canalEje = { x1: s.x, y1: s.y, x2: g.p2.x, y2: g.p2.y };
  canalEjeTs = Date.now();
  engine._emitStatus(
    'Canal — clic define el ancho (más allá del extremo del eje lo alarga; Enter commitea)',
  );
  engine.render();
}

/** Commitea la fase de ancho del canal en diagonal (3er clic o Enter): ancho = distancia
 *  perpendicular del punto al eje. Un punto que proyecta más allá del extremo del eje lo
 *  alarga (geometriaCanalAncho). @param engine Instancia del motor. @param px/py Punto de
 *  plano que define el ancho. */
export function commitCanalAncho(engine: IPlanoEngineCore, px: number, py: number): void {
  const eje = engine._canalEje;
  engine._canalEje = null;
  if (!eje) {
    engine.render();
    return;
  }
  // Guardarraíl del "1 cm" (orig. usuario): un clic a <6 px del eje (doble-clic de término,
  // jitter) es accidental — puntoAnchoMinimo respeta su lado pero lo aleja perpendicular al
  // mismo pie de proyección hasta el ancho mínimo (MISMA matemática que el ghost — WYSIWYG).
  const crudo = { x: px, y: py };
  const ajust = puntoAnchoMinimo(eje, crudo, engine.cmToPlanePx(1));
  if (ajust !== crudo) {
    px = ajust.x;
    py = ajust.y;
    engine._emitStatus(
      `Canal — ancho mínimo ${CANAL_ANCHO_MIN_CM} cm (clic más lejos del eje para otro ancho)`,
    );
  }
  const g = geometriaCanalAncho(
    eje,
    { x: px, y: py },
    (d) => engine.pxToM(d),
    engine.cmToPlanePx(1),
  );
  if (!g) {
    engine._emitStatus(_statusMsg(engine));
    engine.render();
    return;
  }
  crearCanalGlifo(engine, {
    x: g.x,
    y: g.y,
    longitud: g.longitudCm,
    base: g.baseCm,
    angulo: g.angulo,
    flujo: g.flujo,
  });
}

/** Crea el glifo de canal con geometría ya normalizada (base-corta): allocator único,
 *  etiqueta bajo el AABB, selección y snapshot. @param engine Instancia del motor.
 *  @param geo Marco en cm/grados + sentido de flujo. */
function crearCanalGlifo(
  engine: IPlanoEngineCore,
  geo: {
    x: number;
    y: number;
    longitud: number;
    base: number;
    angulo: number;
    flujo: 'derecha' | 'izquierda' | 'abajo' | 'arriba';
  },
): void {
  const marco = { x: geo.x, y: geo.y, longitud: geo.longitud, base: geo.base, angulo: geo.angulo };
  normalizarCanal(pxPerCmDe(engine), marco);
  const base = marco.base || 0;
  const longitud = marco.longitud || 0;
  const altura = 20;
  const x = marco.x;
  const y = marco.y;
  const canalFlowDir = geo.flujo;
  // Consecutivo único: max+1 sobre CNL/CALL existentes (length+1 reutilizaba el número del
  // canal borrado y duplicaba id=code — ítem 6 usuario).
  let maxN = 0;
  for (const bb of engine.bajantes) {
    if (bb.tipo !== 'canal') continue;
    const m = /(?:CNL|CALL)(\d+)/.exec(bb.code || bb.id || '');
    if (m) maxN = Math.max(maxN, parseInt(m[1], 10));
  }
  // El prefijo CALL quedó reservado para las cajas de aguas lluvias (caja_ll); los canales
  // recolectores usan CNL{n}-P{n} (migración de códigos viejos en PlanoPersistence).
  const code = `CNL${maxN + 1}-${pisoCortoLoose(engine.nivelActual?.n ?? 0)}`;
  // Etiqueta bajo el AABB del OBB (válido también en diagonal).
  const _mLbl = canalMarco(engine.cmToPlanePx(1), { x, y, longitud, base, angulo: marco.angulo });
  const _csLbl = esquinasCanalOBB(_mLbl);
  const _cxLbl = _csLbl.reduce((a, c) => a + c.x, 0) / 4;
  const _maxYLbl = Math.max(..._csLbl.map((c) => c.y));
  engine.bajantes.push({
    id: code,
    net: 'll',
    tipo: 'canal',
    code,
    x,
    y,
    pisoBase: engine.nivelActual?.label ?? '',
    pisoCima: engine.nivelActual?.label ?? '',
    nptBase: engine.nivelActual?.npt ?? 0,
    nptCima: engine.nivelActual?.npt ?? 0,
    hVert: 0,
    dNominal: '',
    recibeDeIds: [],
    alimentaIds: [],
    descargaEnId: null,
    ucAcum: 0,
    ucExtra: 0,
    area_m2: 0,
    desplazamientos: {},
    lblOffX: 0,
    lblOffY: 0,
    labelAngle: 0,
    labelX: _cxLbl,
    labelY: _maxYLbl + 20,
    bajR: 7 / 24,
    base,
    altura,
    longitud,
    angulo: marco.angulo,
    // Pendiente default del canal (misma que la tabla de chequeo): manda el dibujo
    // (ítem 7 usuario) — editable desde menú contextual y panel derecho.
    pendiente: 2,
    _canalFlowDir: canalFlowDir,
  });
  engine.selId = code;
  engine._isGhostSel = false;
  engine._emitSelect(engine.bajantes[engine.bajantes.length - 1]);
  engine._emitStatus(_statusMsg(engine));
  engine.render();
  engine._markDirty();
}
