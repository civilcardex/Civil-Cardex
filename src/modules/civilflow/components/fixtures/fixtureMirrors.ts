import { TRAZOS_PREFIX } from '../../constants/storage-keys';
import type { InheritPoolBajante, InheritPoolRamal } from '../../utils/bajanteAssocShared';
import type { EspejosArgs } from './fixtureMirrorsTypes';
import {
  aggParaEspejoSalida,
  libroHeredado,
  loadAll,
  loadHidroData,
  saveAll,
  saveHidroData,
  syncMirrorKey,
} from '../fixturesStorage';
import { collectSourceAgg } from '../../utils/bajanteAssociation';
import { esRedAparatosPresion } from '../../utils/propagation';
import { ldesvioIdFor } from '../../utils/associateBajanteAcrossFloors';
import { loadFromStorage, saveToStorage, saveTrazosToDB } from '../../services/storageService';
import { mapUdBombaDesdeTrazos, propagarHerenciaBomba } from '../../utils/bombaAssociation';

/** (3) Espejos de salidas + herencia entre pisos + bomba: el efecto grande, mantiene las
 *  claves espejo al día cada vez que algo cambia. */
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
          // Presión: entradas del libro = SOLO el grupo (lo propio del montante no es
          // herencia — misma regla del apply; mezclarlo pintaba el panel del asociado con
          // propio + heredado).
          const extra =
            esAlimenta && !esRedAparatosPresion(propNet) ? { ...liveAgg, ...own } : liveAgg;
          const cur = disk[tk] || {};
          const prevAp = aplicadoPrev[tk] || {};
          const result: Record<string, number> = {};
          const keys = new Set([...Object.keys(cur), ...Object.keys(extra)]);
          for (const k of keys) {
            const nv = Math.max(0, (cur[k] || 0) - (prevAp[k] || 0)) + (extra[k] || 0);
            if (nv > 0) result[k] = nv;
          }
          // PRESIÓN (af/ac/gas): la carga heredada viaja SOLO por el libro del montante (el
          // propagador la entrega aguas abajo con el upMonte) — escribirla TAMBIÉN en el
          // disco del ramal la duplicaba (misma regla del apply: 4 piezas × 3 UC = 12 UC).
          if (!esRedAparatosPresion(propNet) && syncMirrorKey(disk, tk, result, true))
            tgtChanged = true;
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
        // El fantasma (marcador del enlace en ESTE piso superior) muestra los mismos UC que
        // el Ldesvio y el montante destino: se actualiza SOLO el objeto vivo del motor (el
        // autosave lo persiste). Reescribir el doc completo del piso desde aquí pisaba el
        // autosave de 1.5 s y BORRABA los checkboxes de asociación recién marcados.
        const fantasmaVivo = (eng.crossFloorGhosts || []).find(
          (g) => g.sourcePlanId === ldPlanId && g.sourceBajanteId === lowerBajId,
        );
        if (fantasmaVivo) {
          fantasmaVivo.aparatos = { ...liveAgg };
          fantasmaVivo.ucAcum = totalUc;
        }
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
          // Parche QUIRÚRGICO sobre re-lectura FRESCA (fix pérdida de trazos): escribir el
          // doc completo leído al inicio del pase pisaba ramales que el usuario acababa de
          // dibujar en el piso de abajo (autosave 1.5 s / otra pestaña) y le estampaba
          // ts=ahora al snapshot viejo — ganaba la re-carga. Solo se aplican los campos del
          // enlace (ucAplicado/ucAplicadoHidro/ucAcum del bajante destino); RAMALES y resto
          // del doc SIEMPRE vienen del disco al momento de guardar.
          const tgtFresco = loadFromStorage<typeof tgt>(TRAZOS_PREFIX + ldPlanId, null);
          if (tgtFresco) {
            const baj = tgtFresco.bajantes?.find((x) => x.id === lowerBajId);
            if (baj) {
              baj.ucAplicado = { ...ucAplicadoNuevo };
              if (liveHydro || Object.keys(ucAplicadoHidroNuevo).length)
                baj.ucAplicadoHidro = { ...ucAplicadoHidroNuevo };
              baj.ucAcum = totalUc;
              (tgtFresco as { ts?: number }).ts = Date.now();
              saveToStorage(TRAZOS_PREFIX + ldPlanId, tgtFresco);
              saveTrazosToDB(ldPlanId, tgtFresco);
              dirty = true;
            }
          }
        }
      }
    }
  }
  // PARIDAD CON BAJANTES (orig. usuario: "literal replicar la lógica de los bajantes"):
  // montante de presión del piso INFERIOR con origenId. El bloque de arriba solo re-computa
  // el libro con el piso SUPERIOR cargado — trabajando en el piso de abajo (donde el usuario
  // pasa el rato), un libro rancio de una doctrina vieja JAMÁS se refrescaba y el panel
  // seguía mostrándolo. Se re-computa el grupo leyendo el storage del piso de arriba (sin
  // escribir NADA hacia arriba — el trinquete) y se actualiza SOLO el montante del MOTOR:
  // el autosave lo persiste (reescribir el doc del piso cargado aquí era el wipe de los
  // checkboxes de asociación). El libro lleva el grupo PURO (regla presión del apply).
  for (const baj of eng.bajantes as Array<{
    id: string;
    net: string;
    tipo?: string;
    origenId?: string | null;
    recibeDeIds?: string[];
    alimentaIds?: string[];
    ucAplicado?: Record<string, Record<string, number>>;
    ucAcum?: number;
  }>) {
    if (baj.tipo !== 'montante' || !baj.origenId?.includes('|')) continue;
    if (!esRedAparatosPresion(baj.net)) continue;
    const [upPlan, upBajId] = baj.origenId.split('|');
    const nUp = upPlan ? nptOf(upPlan) : null;
    if (!upPlan || !upBajId || loadedNpt == null || nUp == null || loadedNpt >= nUp) continue;
    try {
      const srcRaw = loadFromStorage<{
        bajantes?: InheritPoolBajante[];
        ramales?: InheritPoolRamal[];
      } | null>(TRAZOS_PREFIX + upPlan, null);
      const storedBaj = srcRaw?.bajantes?.find((x) => x.id === upBajId) ?? null;
      const { agg } = collectSourceAgg({
        net: baj.net,
        planId: upPlan,
        bajId: upBajId,
        liveBaj: null,
        liveRamales: null,
        storedBaj,
        storedRamales: srcRaw?.ramales ?? null,
        counts: disk,
        hidro: hdisk as unknown as Record<string, { accesorios?: Record<string, number> }>,
      });
      // Grupo vacío con el storage del superior PRESENTE = verdad (la fuente no tiene
      // carga): el libro del asociado se limpia TAMBIÉN — sin esto, un libro rancio de una
      // era vieja en el piso de abajo sobrevivía para siempre (el guard antiguo solo
      // protegía el caso "storage ausente", no el "storage dice cero").
      if (Object.keys(agg).length === 0) {
        if (srcRaw && baj.ucAplicado && Object.keys(baj.ucAplicado).length) {
          baj.ucAplicado = {};
          baj.ucAcum = 0;
          dirty = true;
        }
        continue;
      }
      const lk = `${baj.net}_${ldesvioIdFor(upBajId)}_${loadedPid}`;
      if (syncMirrorKey(disk, lk, agg, true)) dirty = true;
      const libroNuevo: Record<string, Record<string, number>> = {};
      for (const rid of [...(baj.recibeDeIds || []), ...(baj.alimentaIds || [])]) {
        libroNuevo[`${baj.net}_${rid}_${loadedPid}`] = { ...agg };
      }
      libroNuevo[lk] = { ...agg };
      if (JSON.stringify(baj.ucAplicado || {}) !== JSON.stringify(libroNuevo)) {
        baj.ucAplicado = libroNuevo;
        baj.ucAcum = Object.values(agg).reduce((s, v) => s + (v as number), 0);
        dirty = true;
      }
    } catch {
      /* best-effort: el próximo ciclo reintenta */
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

/** Grupo de efectos de espejos del panel (se disparan con los mismos datos que los efectos originales). */
