// Asociación bomba→bajante (orig. usuario): campo dedicado `bombaEnId` en el BAJANTE — los
// campos clásicos descargaEnId/origenId dispararían la herencia hacia ABAJO, invertida para
// una bomba. La herencia hacia ARRIBA la ejecuta el efecto de FixturesPanel (clave de la
// bomba → libro ucAplicado del bajante → ramales del piso superior). Compartido entre el menú
// contextual y el panel derecho.
import { loadFromStorage, saveToStorage, saveTrazosToDB } from '../services/storageService';
import {
  TRAZOS_PLAN_PREFIX,
  TRAZOS_PREFIX,
  APARATOS_BY_TRAMO_KEY,
  HYDRO_DATA_STORAGE_KEY,
} from '../constants/storage-keys';
import { writeBajantePropToDrawing } from './writeDiameterToDrawing';
import {
  writeCrossFloorGhost,
  removeCrossFloorGhostsBySource,
  createCrossFloorLdesvioRamal,
  removeCrossFloorLdesvioRamal,
  buildLdesvioRamal,
  ldesvioIdFor,
  nextRamalLabel,
  type CrossFloorGhost,
} from './associateBajanteAcrossFloors';
import { markAssocLayout } from './assocLayoutMigration';
import { aFrameDe } from './crossFloorStorage';
import { collectSourceAgg, setBajanteDesplazamientoInStorage } from './bajanteAssociation';
import type { InheritPoolBajante, InheritPoolRamal } from './bajanteAssociation';
import { pisoCorto } from '../constants';
import { pisoLbl } from '../constants';
import { APARATOS_DEF } from '../constants';
import type PlanoEngine from '../lib/PlanoEngine/PlanoEngine';
import type { PlanoBajante, IPlanoEngineCore } from '../lib/PlanoEngine/PlanoState';
import type { PlanItem } from '../context/PlansContext';

export interface BombaRow {
  planId: string;
  id: string;
  code: string;
  caja: string;
  nivel: string;
  /** plan.nivel numérico del piso de la bomba — clave del anillo (desplazamientos) y pisoCorto. */
  nivelN: number;
  x: number;
  y: number;
  net: string;
}

/** Bombas (tipo 'bomba') del piso INMEDIATAMENTE inferior al actual — única fuente de opciones
 *  para asociar (orig. usuario). "Inmediato" = el mayor `nivel` que sea menor al actual. */
export function bombsImmediateLowerFloor(plans: PlanItem[], currentPlanId: string): BombaRow[] {
  const current = plans.find((pl) => String(pl.id) === currentPlanId);
  if (!current || typeof current.nivel !== 'number') return [];
  const lower = plans.filter(
    (pl) =>
      pl.status === 'confirmed' &&
      String(pl.id) !== currentPlanId &&
      typeof pl.nivel === 'number' &&
      (pl.nivel as number) < (current.nivel as number),
  );
  if (!lower.length) return [];
  const inmNivel = Math.max(...lower.map((pl) => pl.nivel as number));
  const out: BombaRow[] = [];
  for (const pl of lower.filter((pl) => pl.nivel === inmNivel)) {
    const t = loadFromStorage<{
      bajantes?: Array<{
        id: string;
        code?: string;
        net?: string;
        tipo?: string;
        x?: number;
        y?: number;
        cajaOrigenId?: string | null;
      }>;
    } | null>(TRAZOS_PREFIX + String(pl.id), null);
    for (const b of t?.bajantes || []) {
      if (b.tipo !== 'bomba') continue;
      out.push({
        planId: String(pl.id),
        id: b.id,
        code: b.code || b.id,
        caja: b.cajaOrigenId || '—',
        nivel: pl.nivel != null ? pisoLbl(Number(pl.nivel)) : String(pl.id),
        nivelN: typeof pl.nivel === 'number' ? pl.nivel : 0,
        x: b.x ?? 0,
        y: b.y ?? 0,
        net: b.net || 'san',
      });
    }
  }
  return out;
}

export interface BajanteSuperiorRow {
  planId: string;
  id: string;
  code: string;
  x: number;
  y: number;
  net: string;
  dNominal: string;
  nivel: string;
  nivelN: number;
  bombaEnId: string | null;
}

/** Bajantes (tipo 'bajante') del piso INMEDIATAMENTE SUPERIOR al actual — opciones para
 *  asociar DESDE la bomba (orig. usuario). Inverso de `bombsImmediateLowerFloor`: el menor
 *  `nivel` que sea mayor al actual. */
export function bajantesImmediateUpperFloor(
  plans: PlanItem[],
  currentPlanId: string,
): BajanteSuperiorRow[] {
  const current = plans.find((pl) => String(pl.id) === currentPlanId);
  if (!current || typeof current.nivel !== 'number') return [];
  const upper = plans.filter(
    (pl) =>
      pl.status === 'confirmed' &&
      String(pl.id) !== currentPlanId &&
      typeof pl.nivel === 'number' &&
      (pl.nivel as number) > (current.nivel as number),
  );
  if (!upper.length) return [];
  const inmNivel = Math.min(...upper.map((pl) => pl.nivel as number));
  const out: BajanteSuperiorRow[] = [];
  for (const pl of upper.filter((pl) => pl.nivel === inmNivel)) {
    const t = loadFromStorage<{
      bajantes?: Array<{
        id: string;
        code?: string;
        net?: string;
        tipo?: string;
        x?: number;
        y?: number;
        dNominal?: string;
        bombaEnId?: string | null;
      }>;
    } | null>(TRAZOS_PREFIX + String(pl.id), null);
    for (const b of t?.bajantes || []) {
      if (b.tipo !== 'bajante') continue;
      out.push({
        planId: String(pl.id),
        id: b.id,
        code: b.code || b.id,
        x: b.x ?? 0,
        y: b.y ?? 0,
        net: b.net || 'san',
        dNominal: b.dNominal || '',
        nivel: pl.nivel != null ? pisoLbl(Number(pl.nivel)) : String(pl.id),
        nivelN: typeof pl.nivel === 'number' ? pl.nivel : 0,
        bombaEnId: b.bombaEnId ?? null,
      });
    }
  }
  return out;
}

/** Asocia la bomba al bajante: `bombaEnId` en el bajante + direccion 'sube' automática.
 *  La herencia de UDs la ejecuta el efecto en vivo de FixturesPanel. `bajPlanId`: piso del
 *  bajante (necesario al asociar DESDE el piso de la bomba, donde currentPlanId es el piso de
 *  la bomba y el bajante vive arriba). */
export function asociarBomba(
  eng: PlanoEngine,
  baj: {
    id: string;
    net?: string;
    dNominal?: string;
    bombaEnId?: string | null;
    x?: number;
    y?: number;
  },
  currentPlanId: string,
  row: BombaRow,
  plans: PlanItem[],
  bajPlanId: string = currentPlanId,
): void {
  // Asociación previa distinta: restar su libro antes de escribir la nueva.
  if (baj.bombaEnId && baj.bombaEnId !== `${row.planId}|${row.id}`) {
    quitarBomba(eng, baj as PlanoBajante, currentPlanId, plans);
  }
  const link = `${row.planId}|${row.id}`;
  writeBajantePropToDrawing(`${baj.id}-${bajPlanId}`, baj.net || 'san', 'bombaEnId', link, plans);
  writeBajantePropToDrawing(`${baj.id}-${bajPlanId}`, baj.net || 'san', 'direccion', 'sube', plans);
  eng.updateElementById(baj.id, { bombaEnId: link, direccion: 'sube' as const });
  sincronizarDesvioBomba(eng, baj, bajPlanId, row);
  // Propagación SÍNCRONA al marcar (orig. usuario: las UDs deben aparecer en el bajante
  // superior y su panel sin esperar al próximo pase del efecto en vivo).
  try {
    const disk = loadFromStorage<Record<string, Record<string, number>>>(APARATOS_BY_TRAMO_KEY, {});
    if (propagarHerenciaBomba(eng, currentPlanId, baj.net || 'san', disk))
      saveToStorage(APARATOS_BY_TRAMO_KEY, disk);
  } catch {
    /* best-effort */
  }
  window.dispatchEvent(new CustomEvent('aparatos-clear'));
  window.dispatchEvent(new Event('storage'));
  // Redibujo INMEDIATO del canvas: el fantasma/LD/anillo viven en storage+engine y sin esto
  // solo aparecían cuando otra acción re-renderizaba (orig. usuario: "no pasa nada… y se
  // demoran").
  eng.render?.();
}

// --- Desvío bomba→bajante superior (orig. usuario: "lo mismo de los bajantes entre pisos") ---
// Alineados: solo el marcador fantasma en el piso superior (en 2D queda oculto bajo los
// elementos reales, igual que en la asociación bajante↔bajante). Desalineados: anillo en la
// BOMBA + ramal Ldesvio `LD_<bajId>` que SALE DE LA BOMBA en su piso — un ramal normal que
// cuenta como cualquier otro — y su clave de aparatos ESPEJA las UDs de la bomba (la mantiene
// fresca propagarHerenciaBomba). Sin elementos extra: debajo de la bajante superior solo está
// la bomba ya existente.

/** Coordenadas del bajante asociado: las del engine vivo si su piso está cargado; el caller
 *  (lista de checkboxes desde la bomba) pasa las del trazos si no. */
function coordsBajDe(
  eng: PlanoEngine,
  baj: { id: string; x?: number; y?: number },
  bajPlanId: string,
): { x: number; y: number } | null {
  if (typeof baj.x === 'number' && typeof baj.y === 'number') return { x: baj.x, y: baj.y };
  if (String(eng._loadedPlanId ?? '') === bajPlanId) {
    const live = eng.bajantes.find((b) => b.id === baj.id);
    if (live && live.x != null && live.y != null) return { x: live.x, y: live.y };
  }
  return null;
}

/** Crea/limpia (idempotente) los artefactos visuales del enlace bomba↔bajante. */
export function sincronizarDesvioBomba(
  eng: PlanoEngine,
  baj: { id: string; net?: string; dNominal?: string; x?: number; y?: number },
  bajPlanId: string,
  row: BombaRow,
): void {
  const net = baj.net || 'san';
  const ldId = ldesvioIdFor(baj.id);
  limpiarArtefactosDesvioBomba(eng, baj, bajPlanId, { planId: row.planId, id: row.id });
  const bajXY = coordsBajDe(eng, baj, bajPlanId);
  if (!bajXY) return;
  // La bomba traducida al frame del piso de la bajante (para el fantasma) y la bajante
  // traducida al frame de la bomba (alineación, anillo y Ldesvio viven en SU piso): px crudos
  // de láminas distintas no significan el mismo punto físico cuando las hojas están corridas.
  const bombaEnBaj = aFrameDe({ x: row.x, y: row.y }, row.planId, bajPlanId);
  const bajEnBomba = aFrameDe(bajXY, bajPlanId, row.planId);

  // Fantasma SIEMPRE (alineado incluido): el piso superior lleva el marcador que referencia a
  // la bomba — overlapReal del render lo oculta cuando coincide con elementos reales.
  const ghost: CrossFloorGhost = {
    id: `XFG_${row.id}_${row.planId}`,
    net,
    code: row.code || row.id,
    x: bombaEnBaj.x,
    y: bombaEnBaj.y,
    dNominal: baj.dNominal || '',
    direccion: 'sube',
    piso: pisoCorto(row.nivelN),
    sourcePlanId: row.planId,
    sourceBajanteId: row.id,
    targetBajanteId: baj.id,
    layout: 2,
  };
  writeCrossFloorGhost(bajPlanId, ghost);
  markAssocLayout(bajPlanId);
  if (String(eng._loadedPlanId ?? '') === bajPlanId && Array.isArray(eng.crossFloorGhosts)) {
    eng.crossFloorGhosts = [
      ...eng.crossFloorGhosts.filter(
        (g) => !(g.sourcePlanId === row.planId && g.sourceBajanteId === row.id),
      ),
      ghost,
    ];
  }

  // Alineación (misma regla 0.5 que bajantes entre pisos, origen-relativa): alineados no se
  // crea LD ni anillo.
  const aligned = Math.abs(bajEnBomba.x - row.x) < 0.5 && Math.abs(bajEnBomba.y - row.y) < 0.5;
  if (aligned) return;

  // Anillo en la BOMBA (su piso lleva el anillo y el Ldesvio, layout v2 de bajante↔bajante).
  const lvlBomba = pisoLbl(row.nivelN);
  setBajanteDesplazamientoInStorage(
    row.planId,
    row.id,
    lvlBomba,
    {
      dx: bajEnBomba.x - row.x,
      dy: bajEnBomba.y - row.y,
      Ldesvio: ldId,
    },
    'sube',
  );
  markAssocLayout(row.planId);
  if (String(eng._loadedPlanId ?? '') === row.planId) {
    const liveBomba = eng.bajantes.find((b) => b.id === row.id);
    if (liveBomba) {
      const desp = { ...(liveBomba.desplazamientos || {}) } as Record<
        string,
        { dx: number; dy: number; Ldesvio?: string }
      >;
      const gd: Record<string, { direccion?: string; labelX?: number; labelY?: number }> = {
        ...(liveBomba.ghostData || {}),
      };
      desp[lvlBomba] = {
        dx: bajEnBomba.x - row.x,
        dy: bajEnBomba.y - row.y,
        Ldesvio: ldId,
      };
      gd[lvlBomba] = { ...(gd[lvlBomba] ?? {}), direccion: 'sube' };
      eng.updateElementById(row.id, { desplazamientos: desp, ghostData: gd });
    }
  }

  // Ldesvio que SALE DE LA BOMBA hacia la posición de la bajante superior (traducida a esta
  // hoja; piso de la bomba).
  createCrossFloorLdesvioRamal(
    row.planId,
    baj.id,
    net,
    row.x,
    row.y,
    bajEnBomba.x,
    bajEnBomba.y,
    baj.dNominal || '',
    row.nivelN,
  );
  try {
    const rawLd = loadFromStorage<{
      ramales?: Array<{ id: string; label?: string; _sinEtiqueta?: boolean }>;
    } | null>(TRAZOS_PREFIX + row.planId, null);
    const ldRaw = rawLd?.ramales?.find((r) => r.id === ldId);
    // Direccion SIEMPRE bomba→bajante: pts en ese orden y sin inversión.
    if (rawLd && ldRaw) {
      ldRaw._sinEtiqueta = false;
      saveToStorage(TRAZOS_PREFIX + row.planId, rawLd);
    }
  } catch {
    /* best-effort */
  }
  if (String(eng._loadedPlanId ?? '') === row.planId) {
    const existing = eng.ramales.find((r) => r.id === ldId);
    // Ldesvio de bomba CON etiqueta de ramal y todas sus características (orig. usuario) —
    // excluido de tablas por el filtro LD_ y con flujo SIEMPRE bomba→bajante (pts en ese orden).
    const label = existing?.label || nextRamalLabel(net, eng.ramales);
    const ramal = buildLdesvioRamal(
      ldId,
      label,
      net,
      row.x,
      row.y,
      bajEnBomba.x,
      bajEnBomba.y,
      baj.dNominal || '',
      row.nivelN,
      eng.scaleM || 0.5,
      existing ? existing.bloqueado : true,
    );
    eng.ramales = [...eng.ramales.filter((r) => r.id !== ldId), ramal as never];
  }

  // Mismas UDs: la clave del Ldesvio ESPEJA el agregado de la bomba (propagarHerenciaBomba la
  // mantiene en vivo; aquí la escritura directa cubre el caso "piso de la bomba no cargado").
  try {
    const aggBomba = mapUdBombaDesdeTrazos(row.planId, row.id, net, null);
    if (Object.keys(aggBomba).length) {
      const apos = loadFromStorage<Record<string, Record<string, number>>>(
        APARATOS_BY_TRAMO_KEY,
        {},
      );
      apos[`${net}_${ldId}_${row.planId}`] = { ...aggBomba };
      saveToStorage(APARATOS_BY_TRAMO_KEY, apos);
    }
  } catch {
    /* best-effort */
  }
}

/** Quita anillo de la bomba, ramal LD_ (piso de la bomba), fantasma del piso superior y la
 *  clave de aparatos del Ldesvio. Idempotente. El LD se identifica con el id del BAJANTE
 *  (LD_<bajId> — mismo espacio de ids que bajante↔bajante: un bajante solo se enlaza a uno). */
export function limpiarArtefactosDesvioBomba(
  eng: PlanoEngine,
  baj: { id: string; net?: string },
  bajPlanId: string,
  row: Pick<BombaRow, 'planId' | 'id'>,
): void {
  const net = baj.net || 'san';
  const ldId = ldesvioIdFor(baj.id);
  const bombaFloorLoaded = String(eng._loadedPlanId ?? '') === row.planId;
  const quitarDeDesp = (
    desp: Record<string, { dx: number; dy: number; Ldesvio?: string }>,
    gd: Record<string, { direccion?: string; labelX?: number; labelY?: number }>,
  ): boolean => {
    let tocado = false;
    for (const lvl of Object.keys(desp)) {
      if (desp[lvl]?.Ldesvio === ldId) {
        delete desp[lvl];
        if (gd[lvl] && !gd[lvl].labelX && !gd[lvl].labelY) delete gd[lvl];
        tocado = true;
      }
    }
    return tocado;
  };
  // Anillo: claves de desplazamientos de la bomba etiquetadas con ESTE Ldesvio (storage).
  const raw = loadFromStorage<{
    bajantes?: Array<{
      id: string;
      desplazamientos?: Record<string, { dx: number; dy: number; Ldesvio?: string }>;
      ghostData?: Record<string, { direccion?: string; labelX?: number; labelY?: number }>;
    }>;
  } | null>(TRAZOS_PREFIX + row.planId, null);
  const bombaRaw = raw?.bajantes?.find((b) => b.id === row.id);
  if (bombaRaw) {
    const desp = { ...(bombaRaw.desplazamientos || {}) };
    const gd = { ...(bombaRaw.ghostData || {}) };
    if (quitarDeDesp(desp, gd)) {
      bombaRaw.desplazamientos = desp;
      bombaRaw.ghostData = gd;
      saveToStorage(TRAZOS_PREFIX + row.planId, raw);
      saveTrazosToDB(row.planId, raw);
    }
  }
  if (bombaFloorLoaded) {
    const liveBomba = eng.bajantes.find((b) => b.id === row.id);
    if (liveBomba) {
      const desp = { ...(liveBomba.desplazamientos || {}) } as Record<
        string,
        { dx: number; dy: number; Ldesvio?: string }
      >;
      const gd = { ...(liveBomba.ghostData || {}) } as Record<
        string,
        { direccion?: string; labelX?: number; labelY?: number }
      >;
      if (quitarDeDesp(desp, gd))
        eng.updateElementById(row.id, { desplazamientos: desp, ghostData: gd });
    }
  }
  // Ramal LD_ en el piso de la bomba (storage + vivo si cargado).
  removeCrossFloorLdesvioRamal(row.planId, baj.id);
  if (bombaFloorLoaded) {
    eng.ramales = eng.ramales.filter((r) => r.id !== ldId);
  }
  // Fantasma en el piso superior (storage: recorre otros pisos buscando sourcePlanId=piso de
  // la bomba + vivo si el piso superior está cargado).
  removeCrossFloorGhostsBySource(row.planId, row.id);
  if (String(eng._loadedPlanId ?? '') === bajPlanId && Array.isArray(eng.crossFloorGhosts)) {
    eng.crossFloorGhosts = eng.crossFloorGhosts.filter(
      (g) => !(g.sourcePlanId === row.planId && g.sourceBajanteId === row.id),
    );
  }
  // Clave de aparatos del Ldesvio.
  try {
    const apos = loadFromStorage<Record<string, Record<string, number>>>(APARATOS_BY_TRAMO_KEY, {});
    const ldKey = `${net}_${ldId}_${row.planId}`;
    if (apos[ldKey]) {
      delete apos[ldKey];
      saveToStorage(APARATOS_BY_TRAMO_KEY, apos);
    }
  } catch {
    /* best-effort */
  }
}

/** PUNTO (orig. usuario): al BORRAR la bomba se desasocia de cualquier bajante que la
 *  referencie (bombaEnId), en cualquier piso — storage-side (el bajante suele vivir en otro
 *  piso): resta el libro de UDs, limpia claves espejo y los artefactos del desvío. */
export function desasociarBombaEnTrazos(bombaId: string, bombaPlanId: string): void {
  if (!bombaId) return;
  const sufijo = '|' + bombaId;
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith(TRAZOS_PLAN_PREFIX)) continue;
    const pid = k.slice(TRAZOS_PLAN_PREFIX.length);
    const raw = loadFromStorage<{
      bajantes?: Array<{
        id: string;
        net?: string;
        bombaEnId?: string | null;
        ucAplicado?: Record<string, Record<string, number>>;
      }>;
    } | null>(TRAZOS_PREFIX + pid, null);
    const baj = raw?.bajantes?.find((b) => b.bombaEnId?.endsWith(sufijo));
    if (!raw || !baj) continue;
    const bajPlanId = pid;
    // Limpiar artefactos del desvío con un stub sin piso cargado → solo storage.
    const stub = { _loadedPlanId: null } as unknown as PlanoEngine;
    limpiarArtefactosDesvioBomba(stub, { id: baj.id, net: baj.net }, bajPlanId, {
      planId: bombaPlanId,
      id: bombaId,
    });
    // Restar el libro aplicado a las claves del piso del bajante.
    const disk = loadFromStorage<Record<string, Record<string, number>>>(APARATOS_BY_TRAMO_KEY, {});
    const libro = baj.ucAplicado || {};
    for (const [tk, applied] of Object.entries(libro)) {
      const cur = disk[tk];
      if (!cur) continue;
      for (const [kk, vv] of Object.entries(applied)) {
        const nv = Math.max(0, (cur[kk] || 0) - (vv as number));
        if (nv > 0) cur[kk] = nv;
        else delete cur[kk];
      }
    }
    delete disk[`${baj.net || 'san'}_${baj.id}_${bajPlanId}`];
    saveToStorage(APARATOS_BY_TRAMO_KEY, disk);
    // Soltar el puntero en el trazo del bajante.
    baj.bombaEnId = null;
    saveToStorage(TRAZOS_PREFIX + pid, raw);
    saveTrazosToDB(pid, raw);
  }
  try {
    window.dispatchEvent(new CustomEvent('aparatos-clear'));
    window.dispatchEvent(new Event('storage'));
  } catch {
    /* sin window (tests) */
  }
}

/** Quita la asociación de bomba: limpia el campo, los artefactos del desvío (anillo, Ldesvio,
 *  fantasma, clave LD) y RESTA el libro aplicado de las claves. `bajPlanId`: piso del bajante
 *  si se conoce (desasociar desde el piso de la bomba); por defecto el piso cargado. */
export function quitarBomba(
  eng: PlanoEngine,
  baj: PlanoBajante,
  currentPlanId: string,
  plans: PlanItem[],
  bajPlanId: string = currentPlanId,
): void {
  if (!baj.bombaEnId) return;
  const [prevPlan, prevId] = baj.bombaEnId.split('|');
  if (prevPlan && prevId) {
    limpiarArtefactosDesvioBomba(eng, baj, bajPlanId, { planId: prevPlan, id: prevId });
  }
  writeBajantePropToDrawing(`${baj.id}-${bajPlanId}`, baj.net || 'san', 'bombaEnId', null, plans);
  const disk = loadFromStorage<Record<string, Record<string, number>>>(APARATOS_BY_TRAMO_KEY, {});
  // Libro desde el motor VIVO (el snapshot `baj` del menú/panel puede ir stale y no haber
  // visto la última herencia: restar ese libro viejo dejaba UDs colgadas que se sumaban en
  // cada re-asociación).
  const live = eng.bajantes.find((b) => b.id === baj.id);
  const libro = live?.ucAplicado ?? baj.ucAplicado ?? {};
  for (const [tk, applied] of Object.entries(libro)) {
    const cur = disk[tk];
    if (!cur) continue;
    for (const [k, v] of Object.entries(applied)) {
      const nv = Math.max(0, (cur[k] || 0) - (v as number));
      if (nv > 0) cur[k] = nv;
      else delete cur[k];
    }
  }
  // La clave PROPIA del bajante es un espejo de la bomba (la escribe propagarHerenciaBomba):
  // sin borrarla, tras desasociar el bajante seguía mostrando el heredado viejo en vez de 0
  // (orig. usuario).
  delete disk[`${baj.net || 'san'}_${baj.id}_${currentPlanId}`];
  saveToStorage(APARATOS_BY_TRAMO_KEY, disk);
  eng.updateElementById(baj.id, { bombaEnId: null, ucAplicado: undefined, ucAcum: 0 });
  window.dispatchEvent(new CustomEvent('aparatos-clear'));
  window.dispatchEvent(new Event('storage'));
  eng.render?.();
}

/** Mapa por aparato de las UDs de una bomba (= las UDs de su CAJA asociada): cierre transitivo
 *  completo vía `collectSourceAgg` — la MISMA verdad que el agregado del visor y la herencia
 *  entre pisos (clave propia + recibeDeIds + tributarios + fuentes mergesFrom + cadenas
 *  geométricas; espejos/LDs/otras redes fuera), sin necesitar el motor. Así la bomba "toma
 *  bien" las UDs aunque sus ramales lleguen en cadena o el piso no esté cargado.
 *  Blindaje anti-bucle (la suma infinita reportada): los ESPEJOS jamás son fuente — si un
 *  ramal de salida quedó listado en `recibeDeIds`, su clave ya contiene el agregado y volver
 *  a sumarla la haría crecer en cada pasada. La clave espejo de la bomba solo vale como
 *  última instancia, DESPUÉS del cierre (sumarla antes re-fusionaba su propio valor anterior:
 *  4→8→12…). */
export function mapUdBombaDesdeTrazos(
  pumpPlanId: string,
  pumpId: string,
  net: string,
  live?: {
    bajantes: InheritPoolBajante[];
    ramales: InheritPoolRamal[];
  } | null,
): Record<string, number> {
  const trazos = loadFromStorage<{
    ramales?: Array<{
      id: string;
      tipo?: string;
      padre?: string | null;
      net?: string;
      pts?: number[][];
      _tribReversed?: boolean;
    }>;
    bajantes?: Array<{
      id: string;
      tipo?: string;
      net?: string;
      code?: string;
      x?: number;
      y?: number;
      cajaOrigenId?: string | null;
      recibeDeIds?: string[];
      alimentaIds?: string[];
    }>;
  } | null>(TRAZOS_PREFIX + pumpPlanId, null);
  const counts = loadFromStorage<Record<string, Record<string, number>>>(APARATOS_BY_TRAMO_KEY, {});
  const bomba = trazos?.bajantes?.find((b) => b.id === pumpId && b.tipo === 'bomba');
  if (!bomba) return {};
  const caja = trazos?.bajantes?.find((x) => x.id === bomba.cajaOrigenId);
  if (caja) {
    const hidro = loadFromStorage<Record<string, { accesorios?: Record<string, number> }>>(
      HYDRO_DATA_STORAGE_KEY,
      {},
    );
    // Pool vivo cuando hay (piso cargado): los trazos en disco pueden ir por detrás
    // (autosave 1.5 s, arrastres sin guardar) y dejar fuera ramales que el visor sí ve —
    // el espejo del panel y esta lectura divergían (10 vs 4).
    const liveCaja = live?.bajantes.find((b) => b.id === caja.id) ?? null;
    const { agg } = collectSourceAgg({
      net,
      planId: pumpPlanId,
      bajId: caja.id,
      liveBaj: liveCaja,
      liveRamales: liveCaja && live?.ramales.length ? live.ramales : null,
      storedBaj: caja,
      storedRamales: trazos?.ramales ?? null,
      counts,
      hidro,
    });
    if (Object.keys(agg).length) return agg;
  }
  // Fallback DESPUÉS del cierre: la clave espejo de la bomba (mantenida en vivo por el
  // visor) solo vale si los trazos no aportaron nada.
  const mirror = counts[`${net}_${pumpId}_${pumpPlanId}`];
  const out: Record<string, number> = {};
  if (mirror) for (const [k, v] of Object.entries(mirror)) out[k] = (out[k] || 0) + (v as number);
  return out;
}

/** Herencia bomba→bajante del piso superior: la clave de la bomba (= UDs de su caja,
 *  espejadas) se replica con delta exacto (libro `ucAplicado`: nuevo = actual − aplicado +
 *  agregado) en los ramales del bajante (recibe+alimenta) + `ucAcum` — la MISMA mecánica de
 *  delta que la herencia hacia abajo, pero hacia ARRIBA. Campo dedicado `bombaEnId`:
 *  descargaEnId/origenId dispararían la herencia invertida.
 *  Extraído del efecto de FixturesPanel para usarlo también al asociar (ver `asociarBomba`):
 *  una sola implementación. Muta `disk`; el caller guarda y dispara eventos. Todas las
 *  escrituras (motor, trazos, libro) son condicionales a cambio real — si no, el `setCounts`
 *  posterior re-dispararía el efecto en bucle. @returns true si cambió `disk`. */
export function propagarHerenciaBomba(
  eng: IPlanoEngineCore,
  planId: string | number | null | undefined,
  netId: string,
  disk: Record<string, Record<string, number>>,
): boolean {
  const pid = planId != null ? String(planId) : '';
  const pkey = (rid: string) => (pid ? `${netId}_${rid}_${pid}` : `${netId}_${rid}`);
  let diskDirty = false;
  for (const baj of eng.bajantes) {
    if (baj.net !== netId || baj.tipo !== 'bajante') continue;
    if (!baj.bombaEnId?.includes('|')) continue;
    const [pPlan, pId] = baj.bombaEnId.split('|');
    // SIEMPRE desde los trazos del piso de la bomba: la clave espejo en `disk` puede estar
    // vacía/vieja si ese piso no está cargado (orig. usuario: herencia salía 0 UD). Con el
    // piso cargado se suma el pool vivo (los trazos en disco van por detrás del motor).
    const engMismoPiso = String(eng._loadedPlanId ?? '') === pPlan ? eng : null;
    const aggBomba = mapUdBombaDesdeTrazos(
      pPlan,
      pId,
      netId,
      engMismoPiso
        ? {
            bajantes: engMismoPiso.bajantes as unknown as InheritPoolBajante[],
            ramales: engMismoPiso.ramales as unknown as InheritPoolRamal[],
          }
        : null,
    );
    const tgtRamalIds = [...(baj.recibeDeIds || []), ...(baj.alimentaIds || [])];
    const ucNuevo: Record<string, Record<string, number>> = {};
    for (const rid of tgtRamalIds) {
      const tk = pkey(rid);
      const cur = disk[tk] || {};
      const prevAp = baj.ucAplicado?.[tk] || {};
      const result: Record<string, number> = {};
      for (const k of new Set([...Object.keys(cur), ...Object.keys(aggBomba)])) {
        const nv = Math.max(0, (cur[k] || 0) - (prevAp[k] || 0)) + ((aggBomba[k] as number) || 0);
        if (nv > 0) result[k] = nv;
      }
      if (JSON.stringify(disk[tk] || {}) !== JSON.stringify(result)) {
        if (Object.keys(result).length) disk[tk] = result;
        else delete disk[tk];
        diskDirty = true;
      }
      ucNuevo[tk] = { ...aggBomba };
    }
    const totalB = Object.values(aggBomba).reduce((a, v) => a + (v as number), 0);
    // CLAVE PROPIA del bajante = agregado de la bomba (orig. usuario: "el ramal que SALE del
    // bajante no toma las UDs") — el espejo de salidas copia agregadoBajante(BAN2), que parte
    // de la clave propia; sin esto copiaba la clave VACÍA y RS7 quedaba en 0 UD.
    const bkSelf = pkey(baj.id);
    if (JSON.stringify(disk[bkSelf] || {}) !== JSON.stringify(aggBomba)) {
      disk[bkSelf] = { ...aggBomba };
      diskDirty = true;
    }
    // Espejo del LDESVIO de la bomba (LD_<bajId> en el piso de la bomba, creado al asociar
    // desalineados): REEMPLAZO puro con el agregado — contar como cualquier ramal con las
    // MISMAS UDs de la bomba (orig. usuario). Vacío → borrar la clave.
    const lk = `${netId}_${ldesvioIdFor(baj.id)}_${pPlan}`;
    const aggNoVacio = Object.keys(aggBomba).length > 0;
    if (aggNoVacio) {
      if (JSON.stringify(disk[lk] || {}) !== JSON.stringify(aggBomba)) {
        disk[lk] = { ...aggBomba };
        diskDirty = true;
      }
    } else if (disk[lk]) {
      delete disk[lk];
      diskDirty = true;
    }
    if (
      JSON.stringify(baj.ucAplicado || {}) !== JSON.stringify(ucNuevo) ||
      (baj.ucAcum ?? 0) !== totalB
    ) {
      eng.updateElementById(baj.id, {
        ucAplicado: ucNuevo,
        ucAcum: totalB,
      } as unknown as Record<string, unknown>);
    }
    // Persistir el libro YA (el autosave tarda 1.5s y el panel leía el storage viejo → 0 UD).
    const trazosBaj = loadFromStorage<{
      bajantes?: Array<{ id: string; ucAplicado?: Record<string, Record<string, number>> }>;
    } | null>(TRAZOS_PREFIX + pid, null);
    const tBj = trazosBaj?.bajantes?.find((x) => x.id === baj.id);
    if (tBj && JSON.stringify(tBj.ucAplicado || {}) !== JSON.stringify(ucNuevo)) {
      tBj.ucAplicado = ucNuevo;
      saveToStorage(TRAZOS_PREFIX + pid, trazosBaj);
      saveTrazosToDB(String(pid), trazosBaj);
    }
  }
  return diskDirty;
}

export interface EquipoBomba {
  code: string;
  nivel: string;
  uds: number;
  net: string;
  planId: string;
  id: string;
}

// Peso UD por aparato (misma tabla que el panel de aparatos): las UDs son conteo × valor
// (1 lavamanos + 1 inodoro = 2+4 = 6 UD, no 2). Ids fuera de tabla pesan 0, igual que en el
// panel (solo filas conocidas multiplican).
const UD_POR_APARATO: Record<string, number> = Object.fromEntries(
  (APARATOS_DEF as Array<{ id: string; ud?: unknown }>).map((d) => [
    d.id,
    typeof d.ud === 'number' ? d.ud : 0,
  ]),
);

/** Suma UD de un mapa por aparato (conteo × valor UD, con override de valores custom). */
export function udsDeMapa(
  mapa: Record<string, number>,
  udOverride?: Record<string, number>,
): number {
  return Object.entries(mapa).reduce(
    (a, [k, v]) => a + (v as number) * (udOverride?.[k] ?? UD_POR_APARATO[k] ?? 0),
    0,
  );
}

/** Tabla de equipos de bomba: TODAS las bombas (tipo 'bomba') de todos los pisos con caché
 *  local, con sus UDs (mapUdBombaDesdeTrazos × valor UD). Usada por BombaARDesign (page 5 +
 *  udTot). `udOverride`: valores UD custom del usuario (misma tabla del panel). */
export function equiposBombaDesdeTrazos(udOverride?: Record<string, number>): EquipoBomba[] {
  const out: EquipoBomba[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      // Claves CRUDAS de localStorage ('civilflow_trazos_<id>') — usar el prefijo completo.
      if (!k || !k.startsWith(TRAZOS_PLAN_PREFIX)) continue;
      const planId = k.slice(TRAZOS_PLAN_PREFIX.length);
      // loadFromStorage antepone 'civilflow_' — pasar el prefijo lógico, no la clave cruda.
      const trazos = loadFromStorage<{
        bajantes?: Array<{
          id: string;
          code?: string;
          tipo?: string;
          net?: string;
          pisoBase?: string;
          cajaOrigenId?: string | null;
        }>;
      } | null>(TRAZOS_PREFIX + planId, null);
      for (const b of trazos?.bajantes || []) {
        if (b.tipo !== 'bomba') continue;
        const mapa = mapUdBombaDesdeTrazos(planId, b.id, b.net || 'san');
        out.push({
          code: b.code || b.id,
          nivel: b.pisoBase || '—',
          net: b.net || 'san',
          planId,
          id: b.id,
          uds: udsDeMapa(mapa, udOverride),
        });
      }
    }
  } catch {
    /* best-effort */
  }
  return out;
}

import { libroHeredado } from '../components/fixturesStorage';

export interface AsocLiveBaj {
  id?: string;
  origenId?: string | null;
  bombaEnId?: string | null;
  pisoBase?: string;
  ucAplicado?: Record<string, Record<string, number>>;
}

/** FUENTE ÚNICA de verdad para el panel del bajante ASOCIADO (orig. usuario: original/fantasma/
 *  Ldesvio/salida deben mostrar SIEMPRE las UD del grupo — 12, no 16). Orden: (1) enlace a
 *  bomba → mapUdBombaDesdeTrazos; (2) libro `ucAplicado`; (3) árbol REAL del bajante origen vía
 *  collectSourceAgg sobre el trazos del piso origen. null = el elemento no es asociado (el
 *  caller cae a su ruta normal). */
export function aggBajanteAsociado(opts: {
  targetId: string;
  netId: string;
  planId: string;
  liveBaj: AsocLiveBaj | null | undefined;
  plans: Array<{ id: string | number; nivel: number | string | null }>;
  counts: Record<string, Record<string, number>>;
  hidro: Record<string, { accesorios?: Record<string, number> }>;
  engine?: {
    _loadedPlanId?: string | number | null;
    bajantes: unknown[];
    ramales: unknown[];
  } | null;
}): Record<string, number> | null {
  const { targetId, netId, planId, liveBaj, plans, counts, hidro } = opts;
  const eng = opts.engine ?? null;
  if (!liveBaj) return null;
  const poolVivoDe = (planIdStr: string) => {
    const enVivo = !!eng && String(eng._loadedPlanId ?? '') === planIdStr;
    return enVivo
      ? {
          bajantes: eng!.bajantes as InheritPoolBajante[],
          ramales: eng!.ramales as InheritPoolRamal[],
        }
      : null;
  };

  // 1) Enlace a BOMBA: UDs leídas directo de los trazos del piso de la bomba (su caja + tramos).
  if (liveBaj.bombaEnId?.includes('|')) {
    const [pPlan, pId] = liveBaj.bombaEnId.split('|');
    try {
      const heredado = mapUdBombaDesdeTrazos(pPlan, pId, netId, poolVivoDe(pPlan));
      if (Object.keys(heredado).length) return heredado;
    } catch {
      /* lectura best-effort */
    }
  }

  // 2) Libro de herencia (engine vivo primero — el autosave tarda 1.5 s —, storage de respaldo;
  //    el piso del libro es el del PROPIO bajante, remapeado por pisoBase si el elemento es un
  //    fantasma proyectado de otro piso).
  let libro: Record<string, Record<string, number>> | undefined;
  if (liveBaj.ucAplicado && Object.keys(liveBaj.ucAplicado).length) {
    libro = liveBaj.ucAplicado;
  } else {
    try {
      const planDelLibro = (() => {
        const pb = liveBaj.pisoBase;
        if (!pb) return planId;
        const home = plans.find((p) => p.nivel != null && pisoLbl(Number(p.nivel)) === pb);
        return home && String(home.id) !== String(planId) ? String(home.id) : planId;
      })();
      libro = loadFromStorage<{
        bajantes?: Array<{ id?: string; ucAplicado?: Record<string, Record<string, number>> }>;
      } | null>(TRAZOS_PREFIX + planDelLibro, null)?.bajantes?.find(
        (x) => x.id === targetId,
      )?.ucAplicado;
    } catch {
      /* lectura best-effort */
    }
  }
  const porLibro = libroHeredado({ ucAplicado: libro });
  if (Object.keys(porLibro).length) return porLibro;

  // 3) Libro ausente/vacío: espejar el árbol REAL del bajante origen (misma verdad que la
  //    propagación) — la lectura local sumaba heredado + UD propias del piso (16 vs 12).
  if (liveBaj.origenId?.includes('|')) {
    try {
      const [oPlan, oBaj] = liveBaj.origenId.split('|');
      const rawOrigen = loadFromStorage<{
        ramales?: unknown[];
        bajantes?: unknown[];
      } | null>(TRAZOS_PREFIX + oPlan, null);
      const srcBaj = (rawOrigen?.bajantes as InheritPoolBajante[] | undefined)?.find(
        (x) => x.id === oBaj,
      );
      if (srcBaj) {
        const { agg } = collectSourceAgg({
          net: netId,
          planId: String(oPlan),
          bajId: oBaj,
          liveBaj: poolVivoDe(oPlan)?.bajantes.find((b) => b.id === oBaj) ?? null,
          liveRamales: poolVivoDe(oPlan)?.ramales ?? null,
          storedBaj: srcBaj,
          storedRamales: (rawOrigen?.ramales ?? []) as InheritPoolRamal[],
          counts,
          hidro,
        });
        if (Object.keys(agg).length) return agg;
      }
    } catch {
      /* lectura best-effort */
    }
  }
  return null;
}
