import type { IPlanoEngineCore, PlanoBajante, PlanoRamal } from './PlanoEstado.ts';
import { canalOBBEngine, canalToLocal, canalToWorld, puntoEnCanalOBB } from './canalGeometry';

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

export interface CanalOrigenDet {
  canal: PlanoBajante | null;
  voltear: boolean;
}

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

export function ramalesDelCanal(engine: IPlanoEngineCore, canalId: string): PlanoRamal[] {
  return engine.ramales.filter((r) => r.esCanalId === canalId);
}

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
