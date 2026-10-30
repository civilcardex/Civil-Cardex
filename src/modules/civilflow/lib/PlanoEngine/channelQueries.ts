import type { IPlanoEngineCore, PlanoBajante, PlanoRamal } from './PlanoState.ts';
import { canalOBBEngine, canalToLocal, canalToWorld, puntoEnCanalOBB } from './channelGeometry';

/** Consultas de canales de lluvia (ll, Red de Lluvias): quién está bajo el cursor, a cuál canal apunta un ramal y cómo mover esa asociación. Es la puerta única entre el mouse y la geometría del canal. */

/** ¿El clic cayó dentro del rectángulo del canal? Devuelve 1 (distancia mínima, "sí, lo tocaste")
 *  o Infinity si cayó fuera. */
export function canalRectHitDistance(b: PlanoBajante, x: number, y: number, padPx = 0): number {
  const box = b._canalBox;
  if (!box) return Infinity;
  if (
    x < box.x - padPx ||
    x > box.x + box.w + padPx ||
    y < box.y - padPx ||
    y > box.y + box.h + padPx
  )
    return Infinity;
  return 1;
}

/**
 * Distancia de impacto de un bajante/montante (disco) o canal (rectángulo ×1.1 de aire) bajo
 * el cursor en px de canvas; Infinity si cayó fuera. Ej: cursor a 8px del centro con radio 12
 * → devuelve 8 (gana el más cercano).
 */
export function bajanteHitDistance(b: PlanoBajante, x: number, y: number): number {
  if (b.tipo === 'canal') {
    const box = b._canalBox;
    if (!box) return Infinity;
    const scale = 1.1;
    const cx = box.x + box.w / 2;
    const cy = box.y + box.h / 2;
    const hw = (box.w * scale) / 2;
    const hh = (box.h * scale) / 2;
    if (x < cx - hw || x > cx + hw || y < cy - hh || y > cy + hh) return Infinity;
    return 1;
  }
  if (!b._circ) return Infinity;
  const d = Math.hypot(x - b._circ.x, y - b._circ.y);
  return d < b._circ.r ? d : Infinity;
}

export function bajanteAsociadoACanal(b: { tipo?: string; canalId?: string | null }): boolean {
  return b.tipo === 'bajante' && !!b.canalId;
}

function pointInCanal(
  engine: IPlanoEngineCore,
  canal: PlanoBajante,
  x: number,
  y: number,
): boolean {
  return puntoEnCanalOBB(canalOBBEngine(engine, canal), x, y);
}

/**
 * Canal de lluvia (ll) bajo el punto dado — el preferido primero si el punto cae dentro.
 * @returns el canal que contiene el punto, o null.
 */
export function resolveCanalForPoint(
  engine: IPlanoEngineCore,
  x: number,
  y: number,
  preferId?: string | null,
): PlanoBajante | null {
  if (preferId) {
    const preferred = engine.bajantes.find((c) => c.id === preferId && c.tipo === 'canal');
    if (preferred && pointInCanal(engine, preferred, x, y)) return preferred;
  }
  return (
    engine.bajantes.find(
      (c) => c.tipo === 'canal' && c.net === 'll' && pointInCanal(engine, c, x, y),
    ) || null
  );
}

function clampToCanal(
  engine: IPlanoEngineCore,
  canal: PlanoBajante,
  x: number,
  y: number,
): { x: number; y: number } {
  const obb = canalOBBEngine(engine, canal);
  const { lx, ly } = canalToLocal(obb, x, y);
  return canalToWorld(obb, Math.min(Math.max(lx, 0), obb.w), Math.min(Math.max(ly, 0), obb.h));
}

/**
 * Resuelve el canal bajo el punto y RECORTA el punto al interior de su rectángulo: un aparato
 * arrastrado "fuera" del canal queda pegado a su borde, nunca perdido. Ej: suelto 5px más
 * allá del borde derecho → vuelve a borded derecho con canalId del canal.
 */
export function resolveAndClampToCanal(
  engine: IPlanoEngineCore,
  x: number,
  y: number,
  preferId?: string | null,
): { x: number; y: number; canalId: string | null } {
  const canal = resolveCanalForPoint(engine, x, y, preferId);
  if (!canal) return { x, y, canalId: null };
  const clamped = clampToCanal(engine, canal, x, y);
  return { ...clamped, canalId: canal.id };
}

/** Resultado de detectar canales en los extremos de un ramal nuevo: el canal tocado y si el
 *  ramal nace al revés (tocó el extremo lejano → hay que voltear la dirección del flujo). */
export interface CanalOrigenDet {
  canal: PlanoBajante | null;
  voltear: boolean;
}

/**
 * Detecta si un ramal de lluvia (por sus dos extremos) termina dentro de un canal: cero toques
 * → sin canal; un toque → ese canal (voltear si fue el final); dos → ambiguo, ninguno.
 */
export function detectarCanalEnExtremos(engine: IPlanoEngineCore, pts: number[][]): CanalOrigenDet {
  if (!pts || pts.length < 2) return { canal: null, voltear: false };
  const p0 = pts[0];
  const p1 = pts[pts.length - 1];
  const c0 = resolveCanalForPoint(engine, p0[0], p0[1]);
  const c1 = resolveCanalForPoint(engine, p1[0], p1[1]);
  if (c0 && c1) return { canal: null, voltear: false };
  if (c0) return { canal: c0, voltear: false };
  if (c1) return { canal: c1, voltear: true };
  return { canal: null, voltear: false };
}

/** Ramales que descargan DENTRO del canal (esCanalId apunta al canal). */
export function ramalesDelCanal(engine: IPlanoEngineCore, canalId: string): PlanoRamal[] {
  return engine.ramales.filter((r) => r.esCanalId === canalId);
}

/**
 * Mueve la asociación de un ramal hacia otro bajante (o la desasocia con null): lo saca del
 * recibeDeIds del dueño viejo, lo mete en el nuevo y sella `fin` con su código. Ej: ramal R1
 * de BAN1 → BAN2: R1.fin = 'BAN2' y BAN1 lo pierde de su lista.
 */
export function moverAsociacionCanal(
  engine: IPlanoEngineCore,
  ramalId: string,
  bajanteId: string | null,
): void {
  for (const b of engine.bajantes) {
    if (!b.recibeDeIds?.includes(ramalId)) continue;
    if (bajanteId && b.id === bajanteId) continue;
    b.recibeDeIds = b.recibeDeIds.filter((rid) => rid !== ramalId);
  }
  const ramal = engine.ramales.find((r) => r.id === ramalId);
  if (bajanteId) {
    const b = engine.bajantes.find((x) => x.id === bajanteId);
    if (b) {
      if (!b.recibeDeIds) b.recibeDeIds = [];
      if (!b.recibeDeIds.includes(ramalId)) b.recibeDeIds.push(ramalId);
      if (ramal) ramal.fin = b.code || b.id;
    }
  } else if (ramal) {
    ramal.fin = '';
  }
  engine._markDirty();
}
