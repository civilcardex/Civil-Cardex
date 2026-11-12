/**
 * Cola de re-rasters del visor (F2): un pedido que llega mientras hay un render en vuelo NO se
 * descarta — queda pendiente (la última gana) y corre al cerrar el actual.
 * Ej: zoom y cambio de escala seguidos → el segundo raster sale al terminar el primero, sin perderse.
 */
import { filaRender, type RenderReq } from '../../../utils/planScale.ts';

/** Lanza un render YA (lo llama el drenaje al cerrar el turno); false = no había runner y el pedido sigue encolado. */
export type LanzarRender = (req: RenderReq, mountCheck: number) => boolean;

/** Turno único de raster: una sola lámina se rasteriza a la vez; lo que llega en vuelo espera. */
export interface ColaRender {
  /** Registra el pedido y decide: true = rasteriza ya; false = quedó encolado (última gana). */
  decidir(req: RenderReq): boolean;
  /** Marca el turno ocupado (render en vuelo). */
  abrir(): void;
  /** Libera el turno SIN drenar (salidas tempranas: cancelación, bgOnly); el pendiente espera al próximo cierre. */
  liberar(): void;
  /** Libera el turno y drena el pedido pendiente con `lanzar` (corre al cerrar el actual). */
  cerrar(mountCheck: number, lanzar: LanzarRender): void;
  /** ¿Turno ocupado o pedido pendiente? El velo de carga lo espera antes de bajarse. */
  ocupada(): boolean;
}

/** Crea la cola de turnos (estado privado: lo que llega en vuelo espera, la última gana). */
export function crearColaRender(): ColaRender {
  let enVuelo = false;
  let pendiente: RenderReq | null = null;
  return {
    decidir(req) {
      const fila = filaRender(enVuelo, pendiente, req);
      pendiente = fila.pendiente;
      return fila.arranca;
    },
    abrir() {
      enVuelo = true;
    },
    liberar() {
      enVuelo = false;
    },
    cerrar(mountCheck, lanzar) {
      enVuelo = false;
      const pend = pendiente;
      // Solo se desencola si de verdad se lanzó; si no, queda para el próximo cierre.
      if (pend && lanzar(pend, mountCheck)) pendiente = null;
    },
    ocupada() {
      return enVuelo || pendiente != null;
    },
  };
}
