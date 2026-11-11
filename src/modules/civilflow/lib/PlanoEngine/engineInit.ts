/**
 * Inicialización del motor (extraído de PlanoEngine.ts): el estado de arranque que armaba el
 * constructor — cámara, redes, arrastrones e historial a sus valores por defecto, handlers
 * atados con bind y listeners del canvas colgados. La clase PlanoEngine delega aquí en 1 línea.
 * Ej: initEngineState(engine, cw, pdfWrap, canv) deja el motor listo con zoom 1 y red 'af'.
 */
import type { EngineFull } from './engineFull.ts';
import type { SelectCallback, StatusCallback, UpdateCallback } from './PlanoState.ts';
import { initNetCounts } from './PlanoState.ts';
import { PlanoHistory } from './PlanoHistory.ts';
import { setupCanvasEvents } from './events/canvasSetup.ts';

/** Vista del motor que necesita la inicialización: EngineFull más los callbacks que el
 *  constructor deja en null (los métodos on* los llenan después) y los handlers crudos que
 *  ata con bind antes de colgarlos en el canvas. Ej: _onDownHandler se atará a _onDown. */
interface EngineInitView extends EngineFull {
  _onSelectCb: SelectCallback | null;
  _onStatusCb: StatusCallback | null;
  _onUpdateCb: UpdateCallback | null;
  _onDeleteCb: ((ids: string[]) => void) | null;
  _onActiveNetChangeCb: ((net: string) => void) | null;
  _onAlertCb: ((title: string, msg: string) => void) | null;
  _onAccesorioModalCb:
    | ((data: {
        ramalId: string;
        angleDeg: number;
        junctionIndex: number;
        point: number[];
        net: string;
        isTee?: boolean;
      }) => void)
    | null;
  _lastRightClickTime: number;
  _onDownHandler: (e: MouseEvent | TouchEvent) => void;
  _onMouseMoveHandler: (e: MouseEvent | TouchEvent) => void;
  _onMouseUpHandler: (e: MouseEvent | TouchEvent) => void;
  _onDblClickHandler: (e: MouseEvent) => void;
  _onWheelHandler: (e: WheelEvent) => void;
  _onKeyDownHandler: (e: KeyboardEvent) => void;
}

/** Deja listo (zoom, posición y tamaño) el lienzo donde se va a dibujar: estado de arranque,
 *  historial nuevo y listeners del canvas. Ej: tras llamarla, engine.activeNet === 'af'. */
export function initEngineState(
  engine: EngineInitView,
  cw: HTMLElement,
  pdfWrap: HTMLElement | null,
  canv: HTMLCanvasElement,
): void {
  engine.cw = cw;
  engine.pdfWrap = pdfWrap;
  engine.canv = canv;
  engine.ctx = canv.getContext('2d')!;

  engine.zoom = 1;
  engine.offX = 0;
  engine.offY = 0;
  engine.lineWidthScale = 1;
  engine.dpr = 1;
  engine.tool = 'sel';
  engine.activeNet = 'af';
  engine.tipoTramo = 'ramal';
  engine.snapMode = true;
  engine.gridMode = true;
  engine.scaleM = 0.5;
  engine.definedScaleM = 0;
  engine.pageW = 0;
  engine.pageH = 0;

  engine.ramales = [];
  engine.dims = [];
  engine.textAnnots = [];
  engine.bajantes = [];
  engine.crossFloorGhosts = [];
  engine.guideLines = [];
  engine.areas = [];
  engine.activeRamal = null;
  engine.padreTributario = null;
  engine._ventFirstSegDir = null;
  engine.activeArea = null;
  engine.selId = null;
  engine.selectedGhostId = null;
  engine._isGhostSel = false;
  engine._yeeFlashKey = null;
  engine.areaDrag = null;
  engine.areaPtDrag = null;
  engine._dimPreviewPt = null;
  engine._areaClickCandidate = null;
  engine.dimDrag = null;
  engine.panning = false;
  engine.panX0 = 0;
  engine.panY0 = 0;
  engine.mouseX = 0;
  engine.mouseY = 0;
  engine.ghostDrag = null;
  engine.guideDrag = null;
  engine.lblDrag = null;
  engine.txtDrag = null;
  engine.txtResize = null;
  engine.dimLblDrag = null;
  engine.bajDrag = null;
  engine.canalResizeDrag = null;
  engine.ptDrag = null;
  engine.ramalDrag = null;
  engine.multiSel = [];
  engine.multiDrag = null;
  engine.marqueeRect = null;
  engine._dimStart = null;
  engine._guideStart = null;
  engine._guidePts = null;
  engine._canalStart = null;
  engine._canalEje = null;
  engine.nivelActual = null;
  engine.nptLevels = [];
  engine._hiddenNets = new Set<string>();
  engine._lockedNets = new Set<string>();
  engine._loadedPlanId = null;
  engine._onDirtyCb = null;
  engine._lastMouseCvs = { x: 0, y: 0 };

  initNetCounts(engine);

  engine.MM = {
    lblName: 1.5,
    lblInfo: 1.2,
    lblCode: 1.4,
    flowEmoji: 2.0,
    coord: 1.2,
  };

  engine._ramalDefaults = null;

  engine._history = new PlanoHistory(engine);

  engine._onDown = engine._onDownHandler.bind(engine) as (e: MouseEvent | TouchEvent) => void;
  engine._onMove = engine._onMouseMoveHandler.bind(engine) as (e: MouseEvent | TouchEvent) => void;
  engine._onUp = engine._onMouseUpHandler.bind(engine) as (e: MouseEvent | TouchEvent) => void;
  engine._onDblClick = engine._onDblClickHandler.bind(engine);
  engine._onWheel = engine._onWheelHandler.bind(engine);
  engine._onKeyDown = engine._onKeyDownHandler.bind(engine);

  setupCanvasEvents(engine);

  engine._onSelectCb = null;
  engine._onStatusCb = null;
  engine._onRequestTextCb = null;
  engine._onContextMenuCb = null;
  engine._onDeleteCb = null;
  engine._onActiveNetChangeCb = null;
  engine._onAlertCb = null;
  engine._onAccesorioModalCb = null;
  engine._dirty = false;
  engine._frozen = false;
  engine._lastRightClickTime = 0;
  engine._onUpdateCb = null;
  engine._loadedPlanId = null;
  engine._pinchDist0 = null;
}
