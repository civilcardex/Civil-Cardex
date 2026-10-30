import type { EngineFull } from '../engineFull.ts';
import { zoomAnclado } from '../planoCamera.ts';

/**
 * Rueda del mouse = zoom anclado al cursor: normaliza deltaY y aplica UN zoom por cuadro (rAF)
 * para que una ráfaga de 60-120 eventos/s no se vea como tirón. Movido tal cual de
 * PlanoEngine._onWheelHandler — el método de la clase solo delega.
 */
export function handleWheel(engine: EngineFull, e: WheelEvent): void {
  e.preventDefault();
  // Normaliza deltaMode: 0 = px, 1 = líneas (~16px), 2 = páginas (~800px).
  const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 800 : 1;
  const norm = e.deltaY * unit;
  if (!Number.isFinite(norm) || norm === 0) return;
  const rect = engine._cachedRect();
  engine._wheelMX = e.clientX - rect.left;
  engine._wheelMY = e.clientY - rect.top;
  // Acumula y aplica UNA vez por cuadro: 60-120 ev/s → 1 zoom (sin tirón).
  engine._wheelAccum += norm;
  if (engine._wheelRaf) return;
  engine._wheelRaf = requestAnimationFrame(() => {
    engine._wheelRaf = 0;
    // Tope ±120 por cuadro (~13% de salto máx): un fling que llenaba el ±400 viejo
    // aplicaba 38% de golpe y se veía como tirón aunque la CPU fuera libre.
    const accum = Math.max(-120, Math.min(120, engine._wheelAccum));
    engine._wheelAccum = 0;
    if (accum === 0) return;
    zoomAnclado(engine, engine.zoom * Math.exp(-accum * 0.0012), engine._wheelMX, engine._wheelMY);
  });
}
