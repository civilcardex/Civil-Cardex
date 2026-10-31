// Preparación de los codos 90° de bajantes/montantes en isometría: por cada elemento con
// ramal conectado calcula el VÉRTICE (intersección de la línea del ramal con la vertical del
// centro), el lado donde el tubo sigue y el recorte EXACTO del ramal a su tangencia. Se corre
// ANTES del loop de ramales para que el recorte use la distancia exacta (no una aproximación).
// Lección de la ronda anterior: el vértice NO es el extremo del ramal (queda a varios px del
// tubo y el arco se ve desconectado) — es la intersección de las dos líneas reales.
import { splitPtr } from '../../../utils/keys.ts';

/** Radio base del codo en px (se multiplica por el zoom). UNA sola constante: el recorte del
 *  ramal, el recorte de la vertical y el arco dibujado usan el mismo radio (si divergen, el
 *  empalme queda con un escalón). */
export const CODO_RADIO = 9;

/** Radio base del círculo de la flecha de dirección en px (se multiplica por el zoom). */
export const CODO_CIRC = 5;

export interface CodoPrep {
  /** Intersección ramal × vertical del bajante (px de pantalla). */
  vertex: { sx: number; sy: number };
  /** Dirección unitaria en pantalla del vértice hacia el interior del ramal. */
  dir: { x: number; y: number };
  /** Recorte del ramal EN px de lámina para que su extremo caiga en la tangencia. */
  dTrimPlane: number;
  ramalId: string;
  /** Extremo del ramal que toca el bajante: 0 = pts[0], 1 = último. */
  ladoExtremo: 0 | 1;
  /** Tramo horizontal del codo: el ramal mismo o el CONECTOR entre pisos (su recorte va en px
   *  de pantalla y lo aplica quien dibuja el conector). */
  leg?: 'ramal' | 'conector';
}

/** Claves de bajantes que dibujan glifo de codo: `${x*10}|${y*10}|${planNivel}`. Excluye
 *  fantasmas y tipos sin codo (canal/cajas/calentador/contador) y respeta el filtro de pisos. */
export function construyeJuncCodo(
  bajantes: Array<{
    id: string;
    tipo: string;
    planId: string;
    planNivel: number;
    x: number;
    y: number;
    _isCrossFloorGhost?: boolean;
  }>,
  pisosVisibles: Set<number> | null,
  confirmedPlanos: Array<{ id: string | number; nivel: number | null }>,
): Set<string> {
  const sinCodo = new Set(['canal', 'caja_san', 'caja_ll', 'calentador', 'contador']);
  const s = new Set<string>();
  for (const b of bajantes) {
    if (b._isCrossFloorGhost || sinCodo.has(b.tipo)) continue;
    if (
      pisosVisibles &&
      !pisosVisibles.has(b.planNivel) &&
      !(
        // Con asociación a un piso visible la tubería cruza: cuenta como visible (misma
        // regla del loop de bajantes — ver useIsometryRender).
        (b as { descargaEnId?: string }).descargaEnId &&
        pisosVisibles.has(
          nivelDePlanId(
            confirmedPlanos,
            (b as { descargaEnId?: string }).descargaEnId!.split('|')[0],
          ) ?? NaN,
        )
      )
    )
      continue;
    s.add(`${Math.round(b.x * 10)}|${Math.round(b.y * 10)}|${b.planNivel}`);
  }
  return s;
}

/** Nivel del plano por id; undefined si no existe. */
export function nivelDePlanId(
  plans: Array<{ id: string | number; nivel: number | null }>,
  planId: string,
): number | undefined {
  for (const p of plans) {
    if (String(p.id) === planId) return p.nivel != null ? Number(p.nivel) : undefined;
  }
  return undefined;
}

/** Sonda de escala: px de pantalla por px de lámina en el punto p (sonda de 24 px en +X). */
function sondaEscala(
  proyecta: (iso: { x: number; y: number }, zPix: number) => { sx: number; sy: number },
  isoDe: (px: number, py: number, nivel: number) => { x: number; y: number },
  p: number[],
  planNivel: number,
  zPix: number,
): number {
  const pr0 = proyecta(isoDe(p[0], p[1], planNivel), zPix);
  const pr24 = proyecta(isoDe(p[0] + 24, p[1], planNivel), zPix);
  return Math.hypot(pr24.sx - pr0.sx, pr24.sy - pr0.sy) / 24 || 1;
}

/** Punto del ramal recortado: retrocede por el segmento final dTrimPlane px de lámina
 *  (negativo = extender más allá del extremo; tope ½ segmento para no invertir). */
export function recortaExtremoCodo(p: number[], inner: number[], dTrimPlane: number): number[] {
  const dl = Math.hypot(inner[0] - p[0], inner[1] - p[1]) || 1;
  const t = Math.min(dTrimPlane, dl * 0.5);
  return [p[0] + ((inner[0] - p[0]) / dl) * t, p[1] + ((inner[1] - p[1]) / dl) * t];
}

/** Prepara TODOS los codos de una red ANTES del loop de ramales. Por bajante/montante busca
 *  TODOS sus ramales conectados (ini/fin = código o geometría tol 6), proyecta los dos puntos
 *  de cada uno, calcula el vértice (intersección con la vertical del centro) y el recorte
 *  exacto del ramal. Un bajante puede recibir varios ramales en el mismo piso: cada uno lleva
 *  su propio arco (antes solo el primero tenía codo). Si `descargaEnId` apunta a un RAMAL de
 *  otro piso, el codo vive en el extremo inferior de la vertical (el tubo baja y sigue
 *  horizontal): el tramo horizontal es el conector cuando el ramal no está alineado. */
export function preparaCodos(args: {
  bajantes: Array<{
    id: string;
    code?: string;
    tipo: string;
    planId: string;
    planNivel: number;
    x: number;
    y: number;
    descargaEnId?: string | null;
    _isCrossFloorGhost?: boolean;
  }>;
  ramales: Array<{
    id: string;
    planId?: string;
    planNivel: number;
    pts: number[][];
    ini?: string;
    fin?: string;
  }>;
  proyecta: (iso: { x: number; y: number }, zPix: number) => { sx: number; sy: number };
  isoDe: (px: number, py: number, nivel: number) => { x: number; y: number };
  nptMap: Record<number, number>;
  prof: number;
  getZPix: (zMm: number, nivel?: number) => number;
  zoom: number;
}): { porBajante: Map<string, CodoPrep[]>; porRamal: Map<string, number> } {
  const { bajantes, ramales, proyecta, isoDe, nptMap, prof, getZPix, zoom } = args;
  const porBajante = new Map<string, CodoPrep[]>();
  const porRamal = new Map<string, number>();
  const sinCodo = new Set(['canal', 'caja_san', 'caja_ll', 'calentador', 'contador']);
  const R = CODO_RADIO * zoom;
  for (const b of bajantes) {
    if (b._isCrossFloorGhost || sinCodo.has(b.tipo)) continue;
    const codeB = b.code || b.id;
    const preps: CodoPrep[] = [];
    const zPix = getZPix((nptMap[b.planNivel] || 0) - prof * 1000, b.planNivel);
    const centro = proyecta(isoDe(b.x, b.y, b.planNivel), zPix);
    for (const r of ramales) {
      if (r.planNivel !== b.planNivel || r.pts.length < 2) continue;
      const L = r.pts.length - 1;
      const idx =
        r.fin === codeB || Math.hypot(r.pts[L][0] - b.x, r.pts[L][1] - b.y) < 6
          ? L
          : r.ini === codeB || Math.hypot(r.pts[0][0] - b.x, r.pts[0][1] - b.y) < 6
            ? 0
            : -1;
      if (idx === -1) continue;
      const ramalA = r.pts[idx];
      const ramalB = idx === 0 ? r.pts[1] : r.pts[L - 1];
      const Aend = proyecta(isoDe(ramalA[0], ramalA[1], b.planNivel), zPix);
      const Bin = proyecta(isoDe(ramalB[0], ramalB[1], b.planNivel), zPix);
      let ux = Aend.sx - Bin.sx;
      let uy = Aend.sy - Bin.sy;
      const ul = Math.hypot(ux, uy) || 1;
      ux /= ul;
      uy /= ul;
      // Vértice = intersección de la recta del ramal (Aend + t·u) con la vertical del centro
      // (x = centro.sx — por ahí pasa el tubo). Clamp: si el ramal casi vertical o el cruce
      // queda lejos, cae al extremo del ramal (sin arco desconectado).
      let vertex = { sx: Aend.sx, sy: Aend.sy };
      if (Math.abs(ux) > 0.25) {
        const t = (centro.sx - Aend.sx) / ux;
        if (Math.abs(t) < 60 * zoom) vertex = { sx: Aend.sx + ux * t, sy: Aend.sy + uy * t };
      }
      const dir = { x: -ux, y: -uy }; // vértice → interior del ramal
      const t0 = Math.hypot(vertex.sx - Aend.sx, vertex.sy - Aend.sy);
      const s = sondaEscala(proyecta, isoDe, ramalA, b.planNivel, zPix);
      const ladoExtremo = idx === 0 ? 0 : 1;
      const dTrimPlane = (R - t0) / s;
      preps.push({ vertex, dir, dTrimPlane, ramalId: r.id, ladoExtremo, leg: 'ramal' });
      // Clave con planId: los ids de ramal se repiten entre pisos y la isometría dibuja varios
      // a la vez — sin el plano, el recorte de un piso acortaría el ramal homónimo de otro.
      porRamal.set(`${b.planId}:${r.id}:${ladoExtremo}`, dTrimPlane);
    }
    // Descarga entre pisos a un RAMAL: el codo es el paso vertical→horizontal en el extremo
    // inferior de la columna (antes quedaba en esquina recta). Si el ramal destino no está
    // alineado con la vertical, el tramo horizontal es el CONECTOR y el arco se pega a él.
    if (b.descargaEnId) {
      const [tPlanId, tRamalId] = splitPtr(b.descargaEnId, '');
      for (const r of ramales) {
        if (r.planNivel === b.planNivel || r.pts.length < 2) continue;
        if (r.id !== tRamalId || String(r.planId ?? '') !== tPlanId) continue;
        const L = r.pts.length - 1;
        const bIso = isoDe(b.x, b.y, b.planNivel);
        const first = isoDe(r.pts[0][0], r.pts[0][1], r.planNivel);
        const last = isoDe(r.pts[L][0], r.pts[L][1], r.planNivel);
        const dFirst = Math.hypot(first.x - bIso.x, first.y - bIso.y);
        const dLast = Math.hypot(last.x - bIso.x, last.y - bIso.y);
        const idx = dFirst <= dLast ? 0 : L;
        const endPt = r.pts[idx];
        const innerPt = idx === 0 ? r.pts[1] : r.pts[L - 1];
        const zT = getZPix((nptMap[r.planNivel] || 0) - prof * 1000, r.planNivel);
        const vertex = proyecta(bIso, zT);
        const endP = proyecta(isoDe(endPt[0], endPt[1], r.planNivel), zT);
        const innerP = proyecta(isoDe(innerPt[0], innerPt[1], r.planNivel), zT);
        const dEnd = Math.hypot(endP.sx - vertex.sx, endP.sy - vertex.sy);
        // Alineado (el ramal nace en la vertical): el tramo horizontal es el ramal y se recorta
        // como en el mismo piso. Desalineado: conector recto; si es más corto que el radio el
        // codo no aporta (esquina de pocos px) y se omite.
        if (dEnd > 2 && dEnd <= R + 1) continue;
        const leg: 'ramal' | 'conector' = dEnd > 2 ? 'conector' : 'ramal';
        // `dir` = del vértice hacia el interior del TRAMO HORIZONTAL: en el ramal alineado, del
        // extremo recortado hacia su punto siguiente; en el conector, del vértice al ramal.
        let hx = innerP.sx - endP.sx;
        let hy = innerP.sy - endP.sy;
        if (leg === 'conector') {
          hx = endP.sx - vertex.sx;
          hy = endP.sy - vertex.sy;
        }
        const hl = Math.hypot(hx, hy) || 1;
        const ladoExtremo = idx === 0 ? 0 : 1;
        const s = sondaEscala(proyecta, isoDe, endPt, r.planNivel, zT);
        const dTrimPlane = leg === 'ramal' ? (R - dEnd) / s : 0;
        if (leg === 'ramal') porRamal.set(`${tPlanId}:${r.id}:${ladoExtremo}`, dTrimPlane);
        preps.push({
          vertex,
          dir: { x: hx / hl, y: hy / hl },
          dTrimPlane,
          ramalId: r.id,
          ladoExtremo,
          leg,
        });
      }
      // Descarga entre pisos a una BAJANTE (orig. usuario 2026-10-31: la columna viene
      // bajando y conecta a una horizontal que NO es ramal — es el LD_ (ramal desvio
      // entrepisos) de la bajante destino, nacido en su anillo). El codo vive en ese piso:
      // la vertical baja hasta el anillo y el LD_ sale de ahí. Busco el ramal del piso
      // destino cuyo extremo caiga sobre el anillo (tol 6 px de pantalla).
      const parts = splitPtr(b.descargaEnId ?? '', b.planId);
      const dest = bajantes.find(
        (bb) => !bb._isCrossFloorGhost && bb.id === parts[1] && String(bb.planId) === parts[0],
      );
      if (dest && dest.planNivel !== b.planNivel) {
        const zT = getZPix((nptMap[dest.planNivel] || 0) - prof * 1000, dest.planNivel);
        const anilloP = proyecta(isoDe(b.x, b.y, b.planNivel), zT);
        for (const r of ramales) {
          if (r.planNivel !== dest.planNivel || r.pts.length < 2) continue;
          const L = r.pts.length - 1;
          for (const ladoExtremo of [0, 1] as const) {
            const key = `${r.planId ?? dest.planId}:${r.id}:${ladoExtremo}`;
            if (porRamal.has(key)) continue;
            const ePt = ladoExtremo === 0 ? r.pts[0] : r.pts[L];
            const innerPt = ladoExtremo === 0 ? r.pts[1] : r.pts[L - 1];
            const eP = proyecta(isoDe(ePt[0], ePt[1], r.planNivel), zT);
            // El extremo del ramal nace sobre el anillo (tol 6 px de pantalla).
            if (Math.hypot(eP.sx - anilloP.sx, eP.sy - anilloP.sy) > 6) continue;
            const innerP = proyecta(isoDe(innerPt[0], innerPt[1], r.planNivel), zT);
            const hx = innerP.sx - eP.sx;
            const hy = innerP.sy - eP.sy;
            const hl = Math.hypot(hx, hy) || 1;
            const s = sondaEscala(proyecta, isoDe, ePt, r.planNivel, zT);
            preps.push({
              vertex: anilloP,
              dir: { x: hx / hl, y: hy / hl },
              dTrimPlane: R / s,
              ramalId: r.id,
              ladoExtremo,
              leg: 'ramal',
            });
            porRamal.set(key, R / s);
          }
        }
      }
    }
    if (preps.length) porBajante.set(`${b.planId}:${b.id}`, preps);
  }
  return { porBajante, porRamal };
}

/** Z (mm) de los dos extremos del tubo vertical de una bajante/montante: la unión en su piso y
 *  el otro extremo — el piso destino de la asociación, o un stub de 1 m del lado de la
 *  dirección (montante sube / bajante baja) cuando no hay destino. */
export function extremosVerticales(
  tipo: string,
  direccion: string | undefined,
  currentZ: number,
  targetZ: number,
): { baseZ: number; cimaZ: number } {
  const lo = Math.min(currentZ, targetZ);
  const hi = Math.max(currentZ, targetZ);
  const sube = direccion ? direccion === 'sube' : tipo === 'montante';
  if (lo === hi) return sube ? { baseZ: lo, cimaZ: lo - 1000 } : { baseZ: lo + 1000, cimaZ: lo };
  return { baseZ: lo, cimaZ: hi };
}

/** Lado del codo: el de la vertical que CONTINÚA (el extremo más lejano a la unión). Con
 *  `origenId` (el elemento recibe del piso superior) manda 'arriba': la vertical visible sobre
 *  la unión es ese conector entre pisos. 'arriba' = sy menor en pantalla. */
export function ladoDelCodo(
  pBase: { sx: number; sy: number },
  pCima: { sx: number; sy: number },
  union: { sx: number; sy: number },
  vieneDeArriba: boolean,
): 'arriba' | 'abajo' {
  if (vieneDeArriba) return 'arriba';
  const dBase = Math.hypot(pBase.sx - union.sx, pBase.sy - union.sy);
  const dCima = Math.hypot(pCima.sx - union.sx, pCima.sy - union.sy);
  const lejano = dCima > dBase ? pCima : pBase;
  return lejano.sy <= union.sy ? 'arriba' : 'abajo';
}

/** Recorta la vertical en la tangencia del codo: mueve R px hacia el lado del arco el extremo
 *  que cae en la unión, borrando el tramo muerto unión→tangencia (el "pico" recto que antes
 *  asomaba por dentro de la curva). La vertical es vertical en pantalla: solo cambia sy. */
export function recortaVerticalAlCodo(
  base: { sx: number; sy: number },
  cima: { sx: number; sy: number },
  union: { sx: number; sy: number },
  R: number,
  lado: 'arriba' | 'abajo',
): { base: { sx: number; sy: number }; cima: { sx: number; sy: number } } {
  const dBase = Math.hypot(base.sx - union.sx, base.sy - union.sy);
  const dCima = Math.hypot(cima.sx - union.sx, cima.sy - union.sy);
  const sy = union.sy + (lado === 'arriba' ? -R : R);
  return dBase <= dCima ? { base: { sx: base.sx, sy }, cima } : { base, cima: { sx: cima.sx, sy } };
}

/** ¿Otra vertical de la MISMA red llega a la unión desde el lado OPUESTO al arco? Si sí, el
 *  tubo es PASANTE (tee): la vertical no muere en el codo y el tramo unión→tangencia es la
 *  línea principal (recortarlo dejaría un hueco con el piso vecino). */
export function verticalPasaAlOtroLado(
  lado: 'arriba' | 'abajo',
  union: { sx: number; sy: number },
  spans: Array<{ sx: number; syMin: number; syMax: number }>,
): boolean {
  const opuestoArriba = lado === 'abajo';
  for (const s of spans) {
    if (Math.abs(s.sx - union.sx) > 0.75) continue;
    if (opuestoArriba) {
      if (s.syMin < union.sy - 0.5 && Math.abs(s.syMax - union.sy) <= 1.5) return true;
    } else if (s.syMax > union.sy + 0.5 && Math.abs(s.syMin - union.sy) <= 1.5) return true;
  }
  return false;
}

/** ¿Existe una vertical DIBUJADA que llegue a la unión desde arriba? Gate del `origenId`: solo
 *  entonces el arco puede ir hacia arriba (si no hay tubo arriba, el arco quedaría flotando y
 *  la vertical visible seguiría hacia abajo — el "codo al revés" de la captura del usuario). */
export function hayVerticalArriba(
  union: { sx: number; sy: number },
  spans: Array<{ sx: number; syMin: number; syMax: number }>,
): boolean {
  for (const s of spans) {
    if (Math.abs(s.sx - union.sx) > 0.75) continue;
    if (s.syMin < union.sy - 0.5 && s.syMax >= union.sy - 1.5) return true;
  }
  return false;
}

/** Agrupa los codos de un elemento por punto de unión: un bajante con ramales en su piso y
 *  descarga a un ramal del piso de abajo tiene DOS esquinas (una por extremo de la columna),
 *  cada una con su lado y su recorte. Tolerancia en px de pantalla. */
export function agrupaCodos(preps: CodoPrep[], tol = 2): CodoPrep[][] {
  const grupos: CodoPrep[][] = [];
  for (const p of preps) {
    let hallado = false;
    for (const g of grupos) {
      const u = g[0].vertex;
      if (Math.hypot(u.sx - p.vertex.sx, u.sy - p.vertex.sy) <= tol) {
        g.push(p);
        hallado = true;
        break;
      }
    }
    if (!hallado) grupos.push([p]);
  }
  return grupos;
}

/** Punto de unión promedio de un grupo de codos (los vértices difieren un pelín entre ramales). */
export function unionDeGrupo(g: CodoPrep[]): { sx: number; sy: number } {
  let sx = 0;
  let sy = 0;
  for (const p of g) {
    sx += p.vertex.sx;
    sy += p.vertex.sy;
  }
  return { sx: sx / g.length, sy: sy / g.length };
}

/** ¿La unión cae en un extremo de la vertical? El recorte de la columna solo tiene sentido ahí:
 *  en un punto intermedio movería un extremo entero y acortaría la tubería de más. */
export function unionEnExtremo(
  union: { sx: number; sy: number },
  base: { sx: number; sy: number },
  cima: { sx: number; sy: number },
  tol = 2,
): boolean {
  return (
    Math.hypot(union.sx - base.sx, union.sy - base.sy) <= tol ||
    Math.hypot(union.sx - cima.sx, union.sy - cima.sy) <= tol
  );
}
