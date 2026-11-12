// Derivación pesada del cálculo pluvial (ll = Lluvias): cuerpos VERBATIM de los dos useMemo
// de RainwaterContext, extraídos como funciones libres al partir el archivo. El provider
// los llama dentro de useMemo con las mismas deps de siempre — cero cambio de lógica.
import { cmToPlanePx } from '../lib/PlanoEngine/planoCoords.ts';
import {
  canalOBBDe,
  puntoEnCanalOBB,
  distPuntoACanalOBB,
} from '../lib/PlanoEngine/channelAssociation';
import { pisoCorto } from '../constants/helpers.ts';
import { TRAZOS_PREFIX } from '../constants/storage-keys.ts';
import { loadFromStorage } from '../services/storageService.ts';
import type { DrawingData, RawElement } from '../utils/drawingSync.ts';
import { areaParcialBajanteLl, materialComun, sumaOtrasAsociados } from '../utils/rainwaterRows.ts';
import { sectorDe } from '../utils/formatUtils.ts';
import type { AreaRaw, BajanteLL, CanalLL } from './rainwaterTypes.ts';
import type { PlanItem } from './PlansContext.tsx';

/** Salida de la asociación canal↔bajante: lo que la tabla de canales y el chequeo leen del dibujo crudo (áreas por piso, glifos de canal y alimentadores por canal). */
export interface AsociacionCanalesLl {
  /** Área total dibujada por piso (m²): nivel → Σ areas del doc. Ej: { '1': 480 }. */
  areaAcumMap: Record<string, number>;
  /** Glifos de canal dibujado (tipo 'canal', red 'll') con su piso y planId — semilla de las filas auto de canal. */
  drawnCanalGlyphs: (RawElement & { piso: string; planId: string | number })[];
  /** Área (m²) que alimenta a cada canal dibujado: id de glifo → Σ áreas de sus bajantes. */
  canalAreaMap: Record<string, number>;
  /** Bajantes asociados a cada canal: id de glifo → chips "BALL1-P1" (ordenados). */
  canalBajantes: Record<string, string[]>;
  /** Alimentadores por canal con planId para cruzar entre pisos: id de glifo → "planId|idBajante". */
  canalAlimIds: Record<string, string[]>;
  /** Insumo por bajante alimentador (código base SIN piso = clave del override + área dibujada): id de glifo → [{ code, areaDib }]. */
  canalAlimInfo: Record<string, Array<{ code: string; areaDib: number }>>;
}

/**
 * Asocia cada canal de lluvias (ll (Lluvias)) dibujado con los bajantes que le descargan,
 * leyendo el dibujo crudo de storage por plano. Ej: un ramal ll con un extremo dentro del
 * OBB (bounding box orientado, el canal torcido también cuenta) del canal y el otro a ≤2 px
 * del glifo del bajante marca a ese bajante como alimentador y le pasa su área al canal.
 * Los glifos de canal no pasan por TramosContext/buildTramos.ts (esa tubería solo modela
 * ramales/bajantes con semántica sanitaria), así que se leen directo de storage aquí.
 */
export function asociarCanalesPorOBB(plans: Pick<PlanItem, 'id' | 'nivel'>[]): AsociacionCanalesLl {
  const canalAreaMap: Record<string, number> = {};
  // Bajantes asociados por canal (ítem 8 usuario): id de canal → chips "BAN1-P1".
  const canalBajantes: Record<string, string[]> = {};
  const canalAlimIds: Record<string, string[]> = {};
  // Insumo por bajante para el canal (REQ canal = Σ bajantes): código (clave del override
  // en bajantesLl) + área dibujada — la fila del canal deriva SU Parcial/Otras/Material de
  // estos con la MISMA fórmula de la tabla de bajantes (areaParcialBajanteLl).
  const canalAlimInfo: Record<string, Array<{ code: string; areaDib: number }>> = {};
  const map: Record<string, number> = {};
  const glyphs: (RawElement & { piso: string; planId: string | number })[] = [];
  for (const plan of plans || []) {
    if (plan.nivel == null) continue;
    const raw = loadFromStorage<(DrawingData & { areas?: AreaRaw[] }) | string | null>(
      TRAZOS_PREFIX + plan.id,
      null,
    );
    if (!raw) continue;
    let data: DrawingData & { areas?: AreaRaw[] } = raw as DrawingData & { areas?: AreaRaw[] };
    if (typeof raw === 'string') {
      try {
        data = JSON.parse(raw);
      } catch {
        continue;
      }
    }
    const totalArea = (data.areas || []).reduce((s, a) => s + (a.areaM2 || 0), 0);
    map[String(plan.nivel)] = totalArea;
    for (const b of data.bajantes || []) {
      if (b.tipo === 'canal' && b.net === 'll')
        glyphs.push({ ...b, piso: String(plan.nivel), planId: plan.id });
    }
    // Área de cada canal = Σ áreas de los bajantes que le descargan (orig. usuario): un
    // ramal ll con un extremo dentro del OBB del canal trae el área de SU bajante
    // (el otro extremo a ≤2 px del glifo). OBB válido en diagonal (canalMarco).
    const canales = (data.bajantes || []).filter(
      (
        b,
      ): b is RawElement & {
        base?: number;
        longitud?: number;
        angulo?: number;
        x?: number;
        y?: number;
      } => b.tipo === 'canal' && b.net === 'll',
    );
    const bajLl = (data.bajantes || []).filter(
      (b): b is RawElement & { area_m2?: number; x?: number; y?: number } =>
        b.net === 'll' && b.tipo === 'bajante',
    );
    // Asociaciones MANUALES (checkboxes panel/menú, ped. usuario): bajante→canal (canalId)
    // y ramal→canal (esCanalId, con bajante resoluble por extremo). Se SUMAN a la
    // derivación geométrica para que la columna "Canales asociados" del chequeo y los
    // chips del canal reflejen también lo asociado a mano.
    const manuales: Record<string, Set<string>> = {};
    const manualDe = (idCanal: string): Set<string> =>
      (manuales[String(idCanal)] ||= new Set<string>());
    for (const b of bajLl) {
      const rawB = b as RawElement & { canalId?: string | null };
      if (rawB.canalId) manualDe(rawB.canalId).add(String(b.id));
    }
    for (const r of data.ramales || []) {
      const rawR = r as RawElement & { esCanalId?: string | null };
      if (!rawR.esCanalId || !r.pts || r.pts.length < 2) continue;
      for (const b of bajLl) {
        if (b.x == null || b.y == null) continue;
        if (r.pts.some((p) => Math.hypot(p[0] - (b.x as number), p[1] - (b.y as number)) < 2)) {
          manualDe(rawR.esCanalId).add(String(b.id));
          break;
        }
      }
    }
    const pxPerCm = cmToPlanePx(Number(data.scaleM ?? 0.5), 1); // px de plano por cm — MISMA conversión que el engine (antes: invertida, rect 25-100x el canal)
    const etiquetaBaj = (idB: string): string => {
      const bb = bajLl.find((x) => String(x.id) === idB);
      const sector = sectorDe(String(bb?.code || bb?.id || idB));
      return `${sector}-${pisoCorto(Number(plan.nivel))}`;
    };
    for (const c of canales) {
      if (c.x == null || c.y == null) continue;
      const obb = canalOBBDe(pxPerCm, c);
      const enCanal = (pt: number[]): boolean => puntoEnCanalOBB(obb, pt[0], pt[1], 4);
      // SET de bajantes alimentadores (un bajante con VARIOS ramales al canal cuenta UNA vez).
      // Semilla = asociaciones manuales; la geometría agrega las dibujadas.
      const alimentadores = new Set<string>(manuales[String(c.id)] || []);
      for (const r of data.ramales || []) {
        if (r.net !== 'll' || !r.pts || r.pts.length < 2) continue;
        // Cualquier DIRECCIÓN: un extremo dentro del canal y el OTRO sobre el glifo del
        // bajante (el ramal puede salir del canal o llegar a él — esCanalId marca salida).
        const pS = r.pts[0];
        const pE = r.pts[r.pts.length - 1];
        const pBaj = enCanal(pS) ? pE : enCanal(pE) ? pS : null;
        if (!pBaj) continue;
        for (const b of bajLl) {
          if (b.x == null || b.y == null) continue;
          if (Math.hypot(pBaj[0] - b.x, pBaj[1] - b.y) < 2) {
            alimentadores.add(String(b.id));
            break;
          }
        }
      }
      // Bajante dibujado directamente sobre el canal (sin ramal): también alimentador.
      // Distancia al OBB (no al centro) — en un canal largo el centro queda lejos.
      for (const b of bajLl) {
        if (b.x == null || b.y == null) continue;
        if (distPuntoACanalOBB(obb, b.x, b.y) < 2) alimentadores.add(String(b.id));
      }
      canalBajantes[String(c.id)] = [...alimentadores].map(etiquetaBaj).sort();
      canalAlimIds[String(c.id)] = [...alimentadores].map((idB) => `${String(plan.id)}|${idB}`);
      // Insumo por bajante asociado (código SIN piso = clave del override + área dibujada).
      canalAlimInfo[String(c.id)] = [...alimentadores]
        .map((idB) => {
          const b = bajLl.find((x) => String(x.id) === idB);
          return {
            code: sectorDe(String(b?.code || b?.id || idB)),
            areaDib: b?.area_m2 || 0,
          };
        })
        .sort((a, b) => a.code.localeCompare(b.code));
      // Área = Σ una sola vez por bajante alimentador.
      let area = 0;
      for (const idB of alimentadores) {
        const b = bajLl.find((x) => String(x.id) === idB);
        area += b?.area_m2 || 0;
      }
      if (area > 0) canalAreaMap[String(c.id)] = area;
    }
  }
  return {
    areaAcumMap: map,
    drawnCanalGlyphs: glyphs,
    canalAreaMap,
    canalBajantes,
    canalAlimIds,
    canalAlimInfo,
  };
}

/**
 * Arma las filas AUTO de canal de lluvias (ll) para la tabla: una por glifo dibujado
 * (id "cg_<glifo>") + las filas puramente manuales al final. Ej: canal "CNL1" con los
 * bajantes BALL1 (120 m²) y BALL2 (80 m²) asociados nace con areaParcial 200 y el material
 * común de ambos; editar área en la tabla de canales escribe en los BAJANTES (fan-out).
 * Con bajantes asociados Parcial/Otras/Material SE DERIVAN de los overrides de aquellos
 * (fuente única); sin asociados cae a los fallbacks propios del canal.
 */
export function derivarCanalesLlAuto(
  drawnCanalGlyphs: (RawElement & { piso: string; planId: string | number })[],
  canalesLl: CanalLL[],
  bajantesLl: BajanteLL[],
  areaAcumMap: Record<string, number>,
  canalAreaMap: Record<string, number>,
  canalAlimInfo: Record<string, Array<{ code: string; areaDib: number }>>,
): CanalLL[] {
  const manualMap = new Map<string, CanalLL>();
  for (const c of canalesLl) manualMap.set(c.sector || c.id, c);
  const usedManual = new Set<string>();
  // Overrides manuales de bajantes (para etiquetar SU área asignada al canal).
  const manualBajMap = new Map<string, (typeof bajantesLl)[number]>();
  for (const m of bajantesLl) manualBajMap.set(m.bajante || m.id, m);
  const out: CanalLL[] = [];

  for (const glyph of drawnCanalGlyphs) {
    // Solo el nombre base ("CNL1" de "CNL1-P1") — el piso va en su propia columna.
    const sector = sectorDe(glyph.code || glyph.id);
    const manual = manualMap.get(sector);
    if (manual) usedManual.add(manual.sector || manual.id);
    // ── Canal = Σ bajantes asociados (REQ: fuente única = overrides de los BAJANTES) ──
    // Con bajantes asociados, Parcial/Otras/Material cubierta del canal SE DERIVAN de los
    // overrides de aquellos con la MISMA fórmula de la tabla de bajantes
    // (areaParcialBajanteLl); al editar, la tabla de canales escribe updBajanteLL en cada
    // asociado (fan-out con reparto en RainChannelsCheck) y ambas tablas leen lo mismo
    // en vivo. Sin asociados: fallbacks propios del canal (comportamiento anterior).
    // La Intensidad queda INTENCIONALMENTE a nivel canal (los bajantes usan la suya en
    // sus propios chequeos).
    const alims = canalAlimInfo[String(glyph.id)] || [];
    const conAsoc = alims.length > 0;
    const areaParcialAsoc = alims.reduce(
      (s, a) => s + areaParcialBajanteLl(a.areaDib, undefined, manualBajMap.get(a.code)),
      0,
    );
    const areaOtrasAsoc = sumaOtrasAsociados(alims.map((a) => manualBajMap.get(a.code)));
    // Material común SOLO si TODOS los asociados comparten el mismo; mezclados/ninguno → ''
    // (placeholder de la celda; sin material no hay C y el cálculo del canal no dispara).
    const matComun = materialComun(alims.map((a) => manualBajMap.get(a.code)?.materialCubierta));
    // Área del canal = Σ áreas asignadas a los bajantes que le descargan (orig. usuario).
    // Override manual del canal primero; total dibujado del piso solo si ningún bajante
    // le descarga.
    const areaDeBajantes = canalAreaMap[String(glyph.id)] || 0;
    const manualBaj = manualBajMap.get(glyph.code || glyph.id);
    const areaAcumFallback =
      manual?.areaAcumulada ||
      areaDeBajantes ||
      manualBaj?.areaAcumulada ||
      areaAcumMap[glyph.piso] ||
      0;
    const areaParcial = conAsoc
      ? areaParcialAsoc
      : manual?.areaParcial || areaDeBajantes || manualBaj?.areaParcial || areaAcumFallback;
    const areaOtras = conAsoc ? areaOtrasAsoc : (manual?.areaOtras ?? 0);
    out.push({
      id: 'cg_' + glyph.id,
      sector,
      areaParcial,
      areaOtras,
      areaAcumulada: areaParcial + areaOtras,
      intensidad: manual?.intensidad ?? 100,
      coeficienteC: manual?.coeficienteC ?? 0,
      manning: manual?.manning ?? 0.009,
      materialCubierta: conAsoc ? matComun : manual?.materialCubierta,
      materialCanal: manual?.materialCanal,
      muroVertical: manual?.muroVertical,
      bordeLibreCm: manual?.bordeLibreCm,
      // Pendiente MANDA EL DIBUJO (ítem 7 usuario): la del glifo (default 2 en creación,
      // 2 en legacy sin el campo — igual que antes); fila manual → su propio valor.
      pendiente: (glyph.pendiente as number) ?? 2,
      // b/h siempre vienen del glifo dibujado, nunca del override manual — porque son
      // exactamente los valores que la herramienta de canal "importa" a la tabla; una
      // entrada manual aquí igual se revertiría en silencio en el próximo render
      // (canalesLlAuto se recalcula en cada pasada).
      b: (glyph.base as number) || 0,
      h: (glyph.altura as number) || 0,
      longitud: (glyph.longitud as number) || 0,
      piso: Number(glyph.piso),
      fromCanal: true,
      drawId: String(glyph.id),
      drawPlanId: glyph.planId,
    });
  }

  for (const m of canalesLl) {
    const key = m.sector || m.id;
    if (usedManual.has(key)) continue;
    out.push(m);
  }

  return out;
}
