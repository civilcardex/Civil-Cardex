import { useEffect } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type PlanoEngine from '../../lib/PlanoEngine/PlanoEngine';
import type { CountsMap, HidroDataMap } from '../fixturesStorage';
import {
  loadAll,
  saveAll,
  loadHidroData,
  saveHidroData,
  libroHeredado,
  aggParaEspejoSalida,
  syncMirrorKey,
} from '../fixturesStorage';
import { loadFromStorage, saveToStorage, saveTrazosToDB } from '../../services/storageService';
import { TRAZOS_PREFIX } from '../../constants/storage-keys';
import { emitAparatosClear } from '../../utils/fixtureEvents';
import { propagarAparatosPresion } from '../../utils/aparatosPresion';
import { devError } from '../../../../utils/devError';
import { mapUdBombaDesdeTrazos, propagarHerenciaBomba } from '../../utils/bombaAssociation';
import { ldesvioIdFor } from '../../utils/associateBajanteAcrossFloors';
import {
  collectSourceAgg,
  type InheritPoolBajante,
  type InheritPoolRamal,
} from '../../utils/bajanteAssociation';

/** Args del cluster de espejos (objeto — el panel pasa sus closures tal cual). */
export interface EspejosArgs {
  engineRef: MutableRefObject<PlanoEngine | null>;
  loadingPlanRef?: MutableRefObject<boolean> | null;
  netId: string;
  planId?: string | number;
  /** Planos del proyecto (nivel = npt para el guard de dirección cross-floor). */
  plans: Array<{ id: string | number; nivel?: number | null; status?: string }>;
  planLoadedTick: number;
  targetId: string | null;
  counts: CountsMap;
  setCounts: Dispatch<SetStateAction<CountsMap>>;
  hidroData: HidroDataMap;
  setHidroData: Dispatch<SetStateAction<HidroDataMap>>;
  agregadoBajante: (bajId: string) => Record<string, number>;
  exitsDeBajante: (bajId: string) => Set<string>;
}

/** (1) Sanado de sifones fantasma: reconcilia el conteo 'sif' con los glifos vivos del piso. */
export function correrSanadoSifones(a: EspejosArgs): void {
  const { engineRef, loadingPlanRef, setCounts } = a;
  const eng = engineRef.current;
  if (!eng || loadingPlanRef?.current) return;
  const pid = String(eng._loadedPlanId ?? '');
  if (!pid) return;
  const all = loadAll();
  let dirty = false;
  for (const r of eng.ramales) {
    if (r.net !== 'san' && r.net !== 'll') continue;
    const key = `${r.net}_${r.id}_${pid}`;
    let glifos = 0;
    if (r.accesorioInicio === 'sifon') glifos++;
    if (r.accesorioFin === 'sifon') glifos++;
    if (r.accMed)
      for (const v of Object.values(r.accMed as unknown as Record<string, string>))
        if (v === 'sifon') glifos++;
    const contado = all[key]?.['sif'] || 0;
    if (contado === glifos) continue;
    const cur = { ...(all[key] || {}) };
    if (glifos > 0) cur.sif = glifos;
    else delete cur.sif;
    if (Object.keys(cur).length) all[key] = cur;
    else delete all[key];
    dirty = true;
  }
  if (dirty) {
    saveAll(all);
    setCounts(all);
    try {
      emitAparatosClear();
    } catch {
      /* ignore */
    }
  }
}

/** (2) Propagación af/ac al seleccionar: debounce 250 ms + flush síncrono al cambiar de
 *  selección/desmontar (auditoría #5 — la geometría del tramo anterior quedaba sin propagar).
 *  Devuelve el cleanup (el effect original lo registraba en React). */
export function correrPropagacion(a: EspejosArgs): () => void {
  const { netId } = a;
  if (!(netId === 'af' || netId === 'ac')) return () => {};
  const t = window.setTimeout(() => {
    try {
      propagarAparatosPresion(netId);
    } catch (e) {
      devError('[CF-PROP] error en propagación:', e);
    }
  }, 250);
  // Al cambiar de selección NO se cancela en silencio (auditoría #5): se vacía lo pendiente
  // de forma síncrona — a estas alturas el menú ya abrió y la corrida es solo math de
  // storage, el mismo costo que el autosave que ya corre en este ciclo.
  return () => {
    window.clearTimeout(t);
    try {
      propagarAparatosPresion(netId);
    } catch (e) {
      devError('[CF-PROP] error en propagación (flush):', e);
    }
  };
}

/** (3) Espejos de salidas + herencia cross-floor + bomba — el grande (movido verbatim). */
export function correrEspejos(a: EspejosArgs): void {
  const {
    engineRef,
    loadingPlanRef,
    netId,
    planId,
    plans,
    setCounts,
    setHidroData,
    agregadoBajante,
    exitsDeBajante,
  } = a;
  const eng = engineRef.current;
  if (!eng) return;
  // Carrera de cambio de piso (orig. usuario): `_loadedPlanId` ya apunta al piso entrante
  // pero `eng.bajantes` aún es el piso anterior — escribir aquí estampaba claves/libros con
  // el sufijo de piso equivocado.
  if (loadingPlanRef?.current) return;
  const disk = loadAll();
  const hdisk = loadHidroData();
  const pkey = (rid: string) => (planId ? `${netId}_${rid}_${planId}` : `${netId}_${rid}`);
  let dirty = false;
  let hdirty = false;
  // Libros de herencia cross-floor por bajante (misma lectura que el display del panel:
  // TRAZOS del piso cargado) — el espejo de salidas copia lo que el bajante MUESTRA.
  let trazBooks = new Map<string, Record<string, Record<string, number>>>();
  try {
    const t = loadFromStorage<{
      bajantes?: Array<{ id: string; ucAplicado?: Record<string, Record<string, number>> }>;
    } | null>(TRAZOS_PREFIX + planId, null);
    for (const b of t?.bajantes || []) if (b.ucAplicado) trazBooks.set(b.id, b.ucAplicado);
  } catch {
    trazBooks = new Map();
  }
  for (const baj of eng.bajantes) {
    if (baj.net !== netId) continue;
    // MONTANTES (orig. usuario): NO espejan sus ramales — son la inversa de un bajante (los
    // alimentan, no los reciben); sus ramales mantienen UDs propias asignables.
    if (baj.tipo === 'montante') continue;
    // BOMBA (orig. usuario): punto de transferencia — su clave SIEMPRE espeja el agregado
    // de su caja de origen (recalculado por conectividad; nunca genera UDs propias). SIN
    // `continue`: la bomba también puede sostener un enlace cross-floor (descargaEnId →
    // bajante superior), que se procesa más abajo en esta misma iteración.
    if (baj.tipo === 'bomba' && baj.cajaOrigenId) {
      // Misma fuente que BombaARDesign: trazos del piso de la caja (con fallback al agregado
      // vivo) — la clave de la bomba SIEMPRE termina valiendo lo mismo en ambos lados.
      // La bomba vive en el piso cargado: se suma el pool vivo (los trazos en disco van
      // por detrás del motor y el espejo divergía del mapa de la página).
      const desdeTrazos = mapUdBombaDesdeTrazos(String(planId), baj.id, netId, {
        bajantes: eng.bajantes as unknown as InheritPoolBajante[],
        ramales: eng.ramales as unknown as InheritPoolRamal[],
      });
      const aggBomba = Object.keys(desdeTrazos).length
        ? desdeTrazos
        : agregadoBajante(baj.cajaOrigenId);
      // Sin agregado (caja vacía o red aún en construcción): NO sobrescribir la clave con
      // {} — el espejo vacío borraba UDs legítimas (orig. usuario).
      if (!Object.keys(aggBomba).length) continue;
      if (syncMirrorKey(disk, pkey(baj.id), aggBomba, false)) dirty = true;
    } else {
      // Bajante asociado a BOMBA (orig. usuario): sus salidas espejan las UDs DE LA BOMBA
      // (misma lectura que el panel del bajante) — NO el agregado del árbol, que puede no
      // contener las ramales heredadas y dejaba la salida en 0 aunque el bajante mostrara
      // el total (caso RS7/BAN2). Con pool vivo si la bomba es de este piso.
      let agg = agregadoBajante(baj.id);
      if (baj.bombaEnId?.includes('|')) {
        const [pp, pi] = baj.bombaEnId.split('|');
        const engMismoPiso =
          String(eng._loadedPlanId ?? '') === pp
            ? {
                bajantes: eng.bajantes as unknown as InheritPoolBajante[],
                ramales: eng.ramales as unknown as InheritPoolRamal[],
              }
            : null;
        agg = mapUdBombaDesdeTrazos(pp, pi, netId, engMismoPiso);
      } else if (baj.origenId?.includes('|')) {
        // Asociación cross-floor: el panel del bajante muestra el LIBRO heredado, no el
        // árbol — el espejo copia lo mismo o la salida queda en 0 con el bajante lleno
        // (orig. usuario: bajante con 2 UDs, ramal de salida sin nada).
        const espejo = aggParaEspejoSalida(
          agg,
          libroHeredado({ ucAplicado: trazBooks.get(baj.id) }),
        );
        if (!espejo) continue;
        agg = espejo;
      }
      if (!Object.keys(agg).length) continue;
      for (const rid of exitsDeBajante(baj.id)) {
        const rk = pkey(rid);
        // REEMPLAZO (antes fusión): el ramal de salida es un ESPEJO de solo lectura del
        // elemento (inc/dec bloqueados) — conservar valores viejos en su clave mantenía
        // viva cualquier inflación pasada y la re-mostraba para siempre. El reemplazo la
        // sana al agregado exacto en el próximo pase (orig. usuario: caja AN duplicaba UDs).
        if (syncMirrorKey(disk, rk, agg, false)) dirty = true;
      }
    }
  }
  // Propagación EN VIVO hacia el piso de abajo: la clave del Ldesvio y los ramales destino
  // reciben el agregado COMPLETO del bajante superior — la misma verdad única que usa el
  // apply (collectSourceAgg: cierre transitivo, sin topes), no el parcial de antes.
  // Solo escribe el extremo SUPERIOR del enlace (guard por npt): el inferior nunca
  // re-empuja hacia arriba (eso envenenaba la herencia al cambiar de asociado). Con npt
  // desconocido se conserva el comportamiento previo (titular = descargaEnId).
  // Cubre san y ll aunque el panel esté en la otra red (el cambio pudo venir del menú).
  // BOMBA → BAJANTE del piso superior (orig. usuario): la clave de la bomba (= agregado de
  // su caja, espejado arriba) hereda a los ramales del bajante (recibe+alimenta) vía libro
  // `ucAplicado` — MISMA mecánica de delta que la herencia hacia abajo, pero hacia ARRIBA.
  // Campo dedicado `bombaEnId`: descargaEnId/origenId dispararían la herencia invertida.
  // Una sola implementación (ver `propagarHerenciaBomba`): también la usa `asociarBomba`
  // para propagar sincrónicamente al marcar.
  if (propagarHerenciaBomba(eng, planId, netId, disk)) dirty = true;
  const loadedPid = planId != null ? String(planId) : '';
  // npt = NIVEL del plano (PlanItem.nivel). ANTES leía `p.npt` — campo que NO existe en
  // PlanItem → guard siempre nulo → "desconocido = procesar" dejaba al piso INFERIOR
  // escribir el enlace invertido: sumaba sus UD locales a la herencia y envenenaba el piso
  // superior (orig. usuario: 12 UD abajo → 16 al reentrar; trinquete que nunca baja).
  // Ahora, sin nivel conocido NO se procesa (el efecto re-corre cuando `plans` llega — ya
  // está en sus deps).
  const nptOf = (pid: string): number | null => {
    const n = plans.find((x) => String(x.id) === pid)?.nivel;
    return typeof n === 'number' && Number.isFinite(n) ? n : null;
  };
  const loadedNpt = loadedPid ? nptOf(loadedPid) : null;
  // MONTANTES entre pisos (orig. usuario): mismas asociaciones que bajantes — la propagación
  // viva cubre TODAS las redes con elementos asociables (el cuerpo filtra por baj.net).
  for (const propNet of ['san', 'll', 'af', 'ac', 'gas', 'vent']) {
    for (const baj of eng.bajantes) {
      if (baj.net !== propNet) continue;
      const links: { ldPlan: string; lowerBajId: string; upperBajId: string }[] = [];
      if (baj.descargaEnId?.includes('|')) {
        const [q, qBaj] = baj.descargaEnId.split('|');
        const nq = q ? nptOf(q) : null;
        // Titular = bajante SUPERIOR con descargaEnId al piso de abajo: escribe solo si de
        // verdad está por encima del destino.
        if (q && qBaj && loadedNpt != null && nq != null && loadedNpt > nq)
          links.push({ ldPlan: q, lowerBajId: qBaj, upperBajId: baj.id });
      }
      if (baj.origenId?.includes('|')) {
        const [r, rBaj] = baj.origenId.split('|');
        const nr = r ? nptOf(r) : null;
        // Titular origenId = bajante INFERIOR (el apply se lo pone al destino): procesar
        // aquí propagaría inferior→superior (el veneno del trinquete). Solo se permite el
        // empate de nivel (misma regla del apply).
        if (r && rBaj && loadedNpt != null && nr != null && loadedNpt === nr)
          links.push({ ldPlan: r, lowerBajId: rBaj, upperBajId: baj.id });
      }
      for (const link of links) {
        const { ldPlan: ldPlanId, lowerBajId, upperBajId } = link;
        const srcAgg = collectSourceAgg({
          net: propNet,
          planId: loadedPid,
          bajId: upperBajId,
          liveBaj: eng.bajantes.find((b) => b.id === upperBajId) ?? null,
          liveRamales: (eng.ramales ?? []) as unknown as InheritPoolRamal[],
          storedBaj: null,
          storedRamales: null,
          counts: disk,
          hidro: hdisk as unknown as Record<string, { accesorios?: Record<string, number> }>,
        });
        const liveAgg = srcAgg.agg;
        const liveHydro = srcAgg.hydroAgg;
        // Sin agregado (el GC o claves stale vaciaron las claves del origen) NO se propaga:
        // escribía libro vacío y restaba a 0 las UDs heredadas del destino (mismo guard que
        // las ramas gemelas de espejos de salida).
        if (Object.keys(liveAgg).length === 0) continue;
        const lk = `${propNet}_${ldesvioIdFor(upperBajId)}_${ldPlanId}`;
        if (syncMirrorKey(disk, lk, liveAgg, true)) dirty = true;
        const tgt = loadFromStorage<{
          bajantes?: Array<{
            id: string;
            ucAcum?: number;
            recibeDeIds?: string[];
            alimentaIds?: string[];
            ucAplicado?: Record<string, Record<string, number>>;
            ucAplicadoHidro?: Record<string, Record<string, number>>;
          }>;
        } | null>(TRAZOS_PREFIX + ldPlanId, null);
        const tBaj = tgt?.bajantes?.find((x) => x.id === lowerBajId);
        const tgtRamalIds = [...(tBaj?.recibeDeIds || []), ...(tBaj?.alimentaIds || [])];
        const ownKey = `${propNet}_${lowerBajId}_${ldPlanId}`;
        const own = disk[ownKey] || {};
        const aplicadoPrev = tBaj?.ucAplicado || {};
        const aplicadoHidroPrev = tBaj?.ucAplicadoHidro || {};
        let tgtChanged = false;
        const ucAplicadoNuevo: Record<string, Record<string, number>> = {};
        const ucAplicadoHidroNuevo: Record<string, Record<string, number>> = {};
        for (const rid of tgtRamalIds) {
          const tk = `${propNet}_${rid}_${ldPlanId}`;
          const esAlimenta = (tBaj?.alimentaIds || []).includes(rid);
          const extra = esAlimenta ? { ...liveAgg, ...own } : liveAgg;
          const cur = disk[tk] || {};
          const prevAp = aplicadoPrev[tk] || {};
          const result: Record<string, number> = {};
          const keys = new Set([...Object.keys(cur), ...Object.keys(extra)]);
          for (const k of keys) {
            const nv = Math.max(0, (cur[k] || 0) - (prevAp[k] || 0)) + (extra[k] || 0);
            if (nv > 0) result[k] = nv;
          }
          if (syncMirrorKey(disk, tk, result, true)) tgtChanged = true;
          ucAplicadoNuevo[tk] = { ...extra };
          if (liveHydro) {
            const prevH = aplicadoHidroPrev[tk] || {};
            const hcur = hdisk[tk] || { accesorios: {}, Lh: 0, nSalidas: 0 };
            const acc: Record<string, number> = {};
            for (const k of new Set([
              ...Object.keys(hcur.accesorios || {}),
              ...Object.keys(liveHydro),
            ])) {
              const nv =
                Math.max(0, ((hcur.accesorios || {})[k] || 0) - (prevH[k] || 0)) +
                (liveHydro[k] || 0);
              if (nv > 0) acc[k] = nv;
            }
            if (JSON.stringify(hcur.accesorios || {}) !== JSON.stringify(acc)) {
              hdisk[tk] = { ...hcur, accesorios: acc };
              hdirty = true;
            }
            ucAplicadoHidroNuevo[tk] = { ...liveHydro };
          }
        }
        const totalUc = Object.values(liveAgg).reduce((s, v) => s + (v as number), 0);
        if (tBaj && (tBaj.ucAcum ?? 0) !== totalUc) {
          tBaj.ucAcum = totalUc;
          tgtChanged = true;
        }
        // El libro cubre también la clave del Ldesvio (el mismo agregado): sin esta entrada,
        // la desasociación no sabría qué restar de ella y sus UDs quedarían colgadas.
        ucAplicadoNuevo[lk] = { ...liveAgg };
        if (tBaj && JSON.stringify(tBaj.ucAplicado || {}) !== JSON.stringify(ucAplicadoNuevo)) {
          tBaj.ucAplicado = ucAplicadoNuevo;
          tgtChanged = true;
        }
        if (liveHydro) {
          ucAplicadoHidroNuevo[lk] = { ...liveHydro };
          if (
            JSON.stringify(tBaj?.ucAplicadoHidro || {}) !== JSON.stringify(ucAplicadoHidroNuevo) &&
            tBaj
          ) {
            tBaj.ucAplicadoHidro = ucAplicadoHidroNuevo;
            tgtChanged = true;
          }
        } else if (tBaj && Object.keys(aplicadoHidroPrev).length) {
          tBaj.ucAplicadoHidro = {};
          tgtChanged = true;
        }
        if (tgtChanged) {
          saveToStorage(TRAZOS_PREFIX + ldPlanId, tgt);
          saveTrazosToDB(ldPlanId, tgt);
          dirty = true;
        }
      }
    }
  }
  if (dirty) {
    saveAll(disk);
    setCounts(disk);
    // Tablas y paneles que leen claves (InfTab, diseño, validación) deben reconstruirse al
    // momento — sin estos eventos el bajante asociado a bomba quedaba con el valor viejo
    // hasta tocar algo a mano (orig. usuario, problema de sincronización 2).
    try {
      window.dispatchEvent(new CustomEvent('aparatos-clear'));
      window.dispatchEvent(new CustomEvent('civilflow_san_sync_changed'));
      window.dispatchEvent(new CustomEvent('civilflow_hidro_sync_changed'));
    } catch {
      /* sin window (tests) */
    }
  }
  if (hdirty) {
    saveHidroData(hdisk);
    setHidroData(hdisk);
  }
}

/** Cluster único de efectos de espejos (mismos deps explícitos que los effects originales). */
export function useFixtureMirrors(a: EspejosArgs): void {
  const {
    engineRef,
    loadingPlanRef,
    planLoadedTick,
    netId,
    targetId,
    counts,
    hidroData,
    planId,
    plans,
    agregadoBajante,
    exitsDeBajante,
    setCounts,
  } = a;
  useEffect(() => {
    correrSanadoSifones(a);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mismos deps que el effect original
  }, [planLoadedTick, engineRef, loadingPlanRef, setCounts]);
  useEffect(() => {
    const cleanup = correrPropagacion(a);
    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mismos deps que el effect original
  }, [netId, targetId]);
  useEffect(() => {
    correrEspejos(a);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mismos deps explícitos que el effect original
  }, [
    counts,
    hidroData,
    planId,
    plans,
    netId,
    agregadoBajante,
    exitsDeBajante,
    engineRef,
    loadingPlanRef,
    planLoadedTick,
  ]);
}
