import type { IPlanoEngineCore, PlanoBajante } from './PlanoState';

/**
 * ¿Se puede hacer clic en este bajante? — Calcula qué tan lejos está el punto (x, y) del símbolo.
 * Devuelve Infinity si el clic no tocó nada, o 1 si acertó.
 *
 * El canal de lluvias se comporta distinto a los demás bajantes: su zona de clic es su propio
 * rectángulo (el que se ve en pantalla), no el círculo que usan los otros tipos. El círculo se
 * dimensiona con la DIAGONAL del rectángulo, así que para un canal alargado quedaba enorme
 * (hasta ~40% más grande que el dibujo) y se podía "clicar" el canal desde muy lejos de sus
 * bordes. Por eso el canal usa su rectángulo, y los demás tipos conservan su círculo.
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
    // real al centro, un canal largo quedaría "lejísimos" aunque el clic esté justo encima. Como
    // ya sabemos que el clic está DENTRO del canal, devolvemos 1 (un número chico fijo) — eso
    // basta para que gane la comparación de cercanía.
    return 1;
  }
  if (!b._circ) return Infinity;
  const d = Math.hypot(x - b._circ.x, y - b._circ.y);
  return d < b._circ.r ? d : Infinity;
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

function pointInCanal(
  engine: IPlanoEngineCore,
  canal: PlanoBajante,
  x: number,
  y: number,
): boolean {
  const r = canalRect(engine, canal);
  return x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1;
}

/**
 * ¿A qué canal pertenece este bajante de lluvia? — Busca el canal que contiene el punto (x, y).
 *
 * Si el bajante ya estaba asociado a un canal (`preferId`), se prefiere ESE canal aunque se
 * solape con otro: así, al arrastrar el bajante no "salta" de canal solo porque pasa por encima
 * de un vecino. Solo cuando no hay asociación previa (o el canal asociado ya no lo contiene) se
 * busca cualquier canal de lluvia que contenga el punto.
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
 * Posiciona un bajante de lluvia DENTRO del canal y responde a qué canal quedó asociado.
 *
 * Hace dos cosas en una sola llamada: encuentra el canal del punto (ver resolveCanalForPoint),
 * y recorta la posición del bajante para que quede dentro (ver clampToCanal). Devuelve además el
 * id del canal asociado — o null si el punto quedó fuera de todo canal, caso en el que el
 * bajante se desasocia. Se usa al crear un bajante nuevo y durante su arrastre.
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
 * Calcula las flechas de flujo de un canal de lluvias.
 *
 * Regla de negocio: cada bajante asociado al canal recibe flechas que apuntan HACIA él desde
 * ambos lados — si el bajante está en un extremo del canal, una sola flecha; si está en medio,
 * dos (una por cada lado). Cada flecha nace en el punto medio entre bajantes vecinos (o en el
 * borde del canal para los extremos), de modo que las flechas no se pisan entre sí.
 */

/** Un tramo de canal servido por un bajante: el intervalo [tLeft, tRight] sobre el eje largo
 *  (0..1) que ese bajante recoge. Un bajante en el INTERIOR del canal produce DOS tramos (uno
 *  por cada lado de la división), cada uno con su propia etiqueta — un bajante en un extremo
 *  produce uno solo. Los límites caen en el punto medio entre bajantes vecinos (o en el borde
 *  del canal para los extremos). */
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
    (b) => b.tipo !== 'canal' && b.net === 'll' && b.canalId === canal.id,
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
