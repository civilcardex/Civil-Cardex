import type { IPlanoEngineCore, PlanoBajante } from './PlanoState';

/**
 * Calcula si un clic (x, y) toca este bajante y qué tan cerca está del símbolo.
 * Devuelve Infinity si no tocó nada, o 1 si acertó. El canal de lluvias se clickea sobre
 * su rectángulo visible (no sobre el círculo de los demás tipos) porque ese círculo,
 * calculado con la diagonal, quedaba mucho más grande que el dibujo.
 */
/** ¿El clic cayó dentro del rectángulo del canal? Devuelve 1 si sí, Infinity si no; padPx
 *  agranda el rectángulo unos píxeles para que sea más fácil de acertar. */
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
    // Ojo con el tamaño: un canal puede ser mucho más largo que los ~50px que los callers usan
    // como "distancia máxima para elegir el símbolo más cercano". Si devolviéramos la distancia
    // real al centro, un canal largo quedaría "lejísimo" aunque el clic esté encima. Como
    // ya sabemos que el clic está DENTRO del canal, devolvemos 1 (un número chico fijo) — eso
    // basta para que gane la comparación de cercanía.
    return 1;
  }
  if (!b._circ) return Infinity;
  const d = Math.hypot(x - b._circ.x, y - b._circ.y);
  return d < b._circ.r ? d : Infinity;
}

// Asociación explícita bajante→canal por ID (b.canalId), NO por posición geométrica. Un bajante
// asociado es parte de la geometría del canal: no se selecciona ni arrastra por sí mismo — todo
// clic sobre él (cuerpo, etiqueta o fantasma) se redirige al canal, que al moverse lo lleva con
// sus asociados. Incluye fantasmas entre pisos: los clones heredan canalId del padre.
export function bajanteAsociadoACanal(b: { tipo?: string; canalId?: string | null }): boolean {
  return b.tipo === 'bajante' && !!b.canalId;
}

/** Devuelve la esquina superior-izquierda y la inferior-derecha del canal en coordenadas de
 *  plano. El canal se dibuja desde su esquina (b.x, b.y) y crece hacia abajo-derecha según su
 *  longitud (horizontal) y base (vertical), dadas en cm y convertidas a píxeles de plano aquí
 *  mismo. */
function canalRect(engine: IPlanoEngineCore, canal: PlanoBajante) {
  const w = engine.cmToPlanePx(canal.longitud || 0);
  const h = engine.cmToPlanePx(canal.base || 0);
  return { x0: canal.x, y0: canal.y, x1: canal.x + w, y1: canal.y + h };
}

export function pointInCanal(
  engine: IPlanoEngineCore,
  canal: PlanoBajante,
  x: number,
  y: number,
): boolean {
  const r = canalRect(engine, canal);
  return x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1;
}

/**
 * Busca el canal de lluvias que contiene el punto (x, y). Si el bajante ya estaba asociado
 * a un canal (`preferId`), se prefiere ese aunque se solape con otro: al arrastrar, el
 * bajante no "salta" de canal al pasar sobre un vecino. Sin asociación previa, se busca
 * cualquier canal que contenga el punto.
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

/** Mueve el punto (x, y) hacia adentro del canal si quedó fuera de él — sirve para que el
 *  bajante nunca quede "colgado" medio por fuera del canal al arrastrarlo. */
export function clampToCanal(
  engine: IPlanoEngineCore,
  canal: PlanoBajante,
  x: number,
  y: number,
): { x: number; y: number } {
  const r = canalRect(engine, canal);
  return {
    x: Math.min(Math.max(x, r.x0), r.x1),
    y: Math.min(Math.max(y, r.y0), r.y1),
  };
}

/**
 * Posiciona un bajante de lluvia dentro del canal y devuelve a qué canal quedó asociado.
 * Encuentra el canal del punto, recorta la posición para que quede dentro y devuelve el id
 * del canal (o null si quedó fuera de todo canal, desasociándolo). Se usa al crear y al
 * arrastrar un bajante.
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

/** Una flecha de flujo dibujada sobre el canal, en coordenadas de plano: va desde la cola (x0,y0)
 *  hasta la cabeza (x1,y1), que siempre apunta al bajante. */
export interface CanalFlowArrow {
  /** Punto de inicio de la flecha (cola — queda lejos del bajante). */
  x0: number;
  y0: number;
  /** Punto final de la flecha (cabeza — siempre termina en el bajante). */
  x1: number;
  y1: number;
}

/**
 * Calcula las flechas de flujo de un canal de lluvias: cada bajante asociado recibe flechas
 * que apuntan hacia él desde ambos lados (una sola si está en un extremo, dos si está en
 * medio). Cada flecha nace a mitad de camino entre vecinos para que no se pisen.
 */

/** Un tramo de canal servido por un bajante: el intervalo [tLeft, tRight] del eje largo del
 *  canal que ese bajante recoge. Un bajante en el interior produce dos tramos (uno por lado,
 *  cada uno con su etiqueta); uno en el extremo produce uno solo. Los límites caen a mitad
 *  de camino entre bajantes vecinos (o en el borde del canal para los extremos). */
export interface CanalSegment {
  bajante: PlanoBajante;
  tLeft: number;
  tRight: number;
}

/** Calcula los tramos por bajante del canal (ver CanalSegment) — comparte la misma matemática
 *  de ejes/límites que computeCanalFlowArrows, así el renderer de etiquetas y las flechas nunca
 *  divergen. */
export function computeCanalSegments(
  engine: IPlanoEngineCore,
  canal: PlanoBajante,
): CanalSegment[] {
  const w = engine.cmToPlanePx(canal.longitud || 0);
  const h = engine.cmToPlanePx(canal.base || 0);
  // El flujo corre por el lado LARGO del canal: un canal de drenaje se dibuja alargado, y el lado
  // corto es solo el ancho de la sección — no tiene sentido dibujar flechas en esa dirección.
  const horizontal = w >= h;
  const axisLen = horizontal ? w : h;
  if (axisLen <= 0) return [];

  const assoc = engine.bajantes.filter(
    (b) =>
      b.tipo !== 'canal' &&
      b.net === 'll' &&
      b.canalId === canal.id &&
      pointInCanal(engine, canal, b.x, b.y) &&
      (canal as unknown as { bajanteExternoId?: string | null }).bajanteExternoId !== b.id,
  );
  if (assoc.length === 0) return [];

  const toAxisPos = (b: PlanoBajante) =>
    horizontal ? (b.x - canal.x) / axisLen : (b.y - canal.y) / axisLen;

  const sorted = assoc
    .map((b) => ({ b, t: Math.min(1, Math.max(0, toAxisPos(b))) }))
    .sort((a, c) => a.t - c.t);

  const results: CanalSegment[] = [];
  const EPS = 0.02;
  for (let i = 0; i < sorted.length; i++) {
    const entry = sorted[i];
    const tLeft = i === 0 ? 0 : (sorted[i - 1].t + entry.t) / 2;
    const tRight = i === sorted.length - 1 ? 1 : (entry.t + sorted[i + 1].t) / 2;
    // Tramo hacia el lado izquierdo/inicio de la división: [tLeft, entry.t]
    if (entry.t - tLeft > EPS) {
      results.push({ bajante: entry.b, tLeft, tRight: entry.t });
    }
    // Tramo hacia el lado derecho/fin de la división: [entry.t, tRight]
    if (tRight - entry.t > EPS) {
      results.push({ bajante: entry.b, tLeft: entry.t, tRight });
    }
  }
  return results;
}

export function computeCanalFlowArrows(
  engine: IPlanoEngineCore,
  canal: PlanoBajante,
): CanalFlowArrow[] {
  const w = engine.cmToPlanePx(canal.longitud || 0);
  const h = engine.cmToPlanePx(canal.base || 0);
  const horizontal = w >= h;
  const axisLen = horizontal ? w : h;
  if (axisLen <= 0) return [];
  const midCross = horizontal ? canal.y + h / 2 : canal.x + w / 2;

  const segments = computeCanalSegments(engine, canal);
  if (segments.length === 0) return [];

  const toPlanePoint = (t: number): { x: number; y: number } =>
    horizontal
      ? { x: canal.x + t * axisLen, y: midCross }
      : { x: midCross, y: canal.y + t * axisLen };

  const arrows: CanalFlowArrow[] = [];
  const EPS = 0.02;
  for (const seg of segments) {
    const entryT = horizontal
      ? (seg.bajante.x - canal.x) / axisLen
      : (seg.bajante.y - canal.y) / axisLen;
    // La cabeza de la flecha apunta al CENTRO del círculo del bajante (su posición real), no al
    // punto proyectado sobre el eje del canal — así el renderer puede recortar la flecha hasta el
    // borde del círculo y siempre se ve bien alineada.
    const head = { x: seg.bajante.x, y: seg.bajante.y };
    if (entryT - seg.tLeft > EPS) {
      const tail = toPlanePoint(seg.tLeft);
      // La cola se alinea en la misma línea que la cabeza (misma coordenada transversal) para que
      // la flecha quede siempre recta a lo largo del canal — nada de diagonales raras sin importar
      // dónde quede el bajante dentro del ancho.
      if (horizontal) {
        arrows.push({ x0: tail.x, y0: head.y, x1: head.x, y1: head.y });
      } else {
        arrows.push({ x0: head.x, y0: tail.y, x1: head.x, y1: head.y });
      }
    }
    if (seg.tRight - entryT > EPS) {
      const tail = toPlanePoint(seg.tRight);
      if (horizontal) {
        arrows.push({ x0: tail.x, y0: head.y, x1: head.x, y1: head.y });
      } else {
        arrows.push({ x0: head.x, y0: tail.y, x1: head.x, y1: head.y });
      }
    }
  }
  return arrows;
}
