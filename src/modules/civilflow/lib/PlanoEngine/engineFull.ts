import type { IPlanoEngineCore, PlanoElement, Point } from './PlanoState.ts';
import type { PlanoHistory } from './PlanoHistory.ts';

/**
 * Vista completa del motor real (PlanoEngine) para los módulos extraídos de la fachada
 * (events/, render/, commands/): IPlanoEngineCore más el lienzo, el wrapper del PDF y el
 * estado interno de interacción (pinch, rueda, transform, historial). Ej: handleWheel
 * acumula deltaY en _wheelAccum y programa su flush con _wheelRaf — ambos viven aquí.
 */
export interface EngineFull extends IPlanoEngineCore {
  ctx: CanvasRenderingContext2D;
  /** Wrapper del PDF de fondo: el transform del zoom se le aplica en cada render. */
  pdfWrap: HTMLElement | null;
  _onContextMenuCb:
    | ((
        bajante: PlanoElement,
        x: number,
        y: number,
        isGhostClick?: boolean,
        ramalEndpoint?: { idx: number; x: number; y: number } | null,
        midRamalHit?: { segmentIdx: number; x: number; y: number } | null,
      ) => void)
    | null;
  /** Pos del evento en coords de canvas (clientX − rect.left, con soporte touch). */
  _getPos(e: MouseEvent | TouchEvent): Point;
  /** Rect del canvas con caché de 32ms: rueda/pinch/mousemove lo piden 60-120/s. */
  _cachedRect(): DOMRect;
  /** Reajusta el lienzo de DIBUJO al área visible del visor. */
  ensureCanvasSize(): void;
  /** Tiempos del último render (los lee `__cfPerf` en DEV). */
  _perf: { frames: number; totalMs: number; capas: Record<string, number> };
  /** Historial de deshacer/rehacer: loadWork lo resetea al aterrizar un piso nuevo. */
  _history: PlanoHistory;
  /** Distancia inicial del pinch (2 dedos); null = sin pinch activo. */
  _pinchDist0: number | null;
  /** Zoom del engine al iniciar el pinch: base para escalar por razón de distancias. */
  _pinchZoom0: number;
  /** Rueda acumulada por cuadro (deltaY normalizado a px). */
  _wheelAccum: number;
  /** Id del rAF pendiente del flush de rueda; 0 = sin flush programado. */
  _wheelRaf: number;
  /** Ancla del último evento de rueda (coords canvas); el flush usa la más reciente. */
  _wheelMX: number;
  _wheelMY: number;
  /** Último transform aplicado al wrapper: reescribirlo cada cuadro dispara re-raster. */
  _lastTransform: string;
}
