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
import { collectSourceAgg } from './bajanteAssociation';
import type { InheritPoolBajante, InheritPoolRamal } from './bajanteAssociation';
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
        x: b.x ?? 0,
        y: b.y ?? 0,
        net: b.net || 'san',
      });
    }
  }
  return out;
}

/** Asocia la bomba al bajante: `bombaEnId` en el bajante + direccion 'sube' automática.
 *  La herencia de UDs la ejecuta el efecto en vivo de FixturesPanel. */
export function asociarBomba(
  eng: PlanoEngine,
  baj: { id: string; net?: string; dNominal?: string; bombaEnId?: string | null },
  currentPlanId: string,
  row: BombaRow,
  plans: PlanItem[],
): void {
  // Asociación previa distinta: restar su libro antes de escribir la nueva.
  if (baj.bombaEnId && baj.bombaEnId !== `${row.planId}|${row.id}`) {
    quitarBomba(eng, baj as PlanoBajante, currentPlanId, plans);
  }
  const link = `${row.planId}|${row.id}`;
  writeBajantePropToDrawing(
    `${baj.id}-${currentPlanId}`,
    baj.net || 'san',
    'bombaEnId',
    link,
    plans,
  );
  writeBajantePropToDrawing(
    `${baj.id}-${currentPlanId}`,
    baj.net || 'san',
    'direccion',
    'sube',
    plans,
  );
  eng.updateElementById(baj.id, { bombaEnId: link, direccion: 'sube' as const });
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
}

/** Quita la asociación de bomba: limpia el campo y RESTA el libro aplicado de las claves. */
export function quitarBomba(
  eng: PlanoEngine,
  baj: PlanoBajante,
  currentPlanId: string,
  plans: PlanItem[],
): void {
  if (!baj.bombaEnId) return;
  writeBajantePropToDrawing(
    `${baj.id}-${currentPlanId}`,
    baj.net || 'san',
    'bombaEnId',
    null,
    plans,
  );
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
