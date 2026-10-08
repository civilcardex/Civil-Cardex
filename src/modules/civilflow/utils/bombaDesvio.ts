import { loadFromStorage, saveToStorage, saveTrazosToDB } from '../services/storageService';
import {
  TRAZOS_PLAN_PREFIX,
  TRAZOS_PREFIX,
  APARATOS_BY_TRAMO_KEY,
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
import { setBajanteDesplazamientoInStorage } from './bajanteAssociation';
import { pisoCorto } from '../constants';
import { pisoLbl } from '../constants';
import type { PlanoBajante } from '../lib/PlanoEngine/PlanoState';
import type PlanoEngine from '../lib/PlanoEngine/PlanoEngine';
import type { PlanItem } from '../context/PlansContext';
import { mapUdBombaDesdeTrazos, propagarHerenciaBomba } from './bombaHerencia';
import type { BombaRow } from './bombaQueries';

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
