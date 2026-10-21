import { writeBajantePropToDrawing } from './escribeDiametroToDibujo.ts';
import { splitPtr } from './claves.ts';
import { bajanteLocalDe, bajanteLocalQueCumple } from './bajanteLocal.ts';
import { aplicarEnDocDePlan } from './escribePlanoDocumento.ts';
import { writeSanDrawingSync, writeHydroDrawingSync } from './dibujoSync.ts';
import type { SyncPlanInput } from './dibujoSync.ts';
import type { IPlanoEngineCore } from '../lib/PlanoEngine/PlanoEstado.ts';
import {
  removeCrossFloorGhost,
  removeCrossFloorLdesvioRamal,
  ldesvioIdFor,
} from './associateBajanteAcrossFloors';
import {
  loadFromStorage,
  saveToStorage,
  saveTrazosToDB,
} from '../services/almacenamientoServicio.ts';
import {
  TRAZOS_PREFIX,
  APARATOS_BY_TRAMO_KEY,
  HYDRO_DATA_STORAGE_KEY,
} from '../constants/almacenamientoClaves.ts';
import {
  resolveLinkRoles,
  readBajanteLink,
  estamparAsocsClearedTs,
  desasociarLdesvioDeBajante,
  GEO_TOL_BAJANTE,
} from './bajanteAsocCompartido.ts';
import type {
  StoredBajanteDesp,
  InheritPoolRamal,
  InheritPoolBajante,
} from './bajanteAsocCompartido.ts';
import { emitAparatosClear, emitSanSync, EV_STORAGE } from './aparatoEventos.ts';

/** Anula un puntero de asociación (origenId / descargaEnId) del doc del piso: si el piso está
 *  abierto se toca su estado VIVO (nunca se pisa lo dibujado hace un momento); si está cerrado,
 *  se lee del storage y se escribe. */
function limpiarPunteroEnStorage(
  eng: IPlanoEngineCore | null,
  planId: string,
  bajanteId: string,
  prop: 'origenId' | 'descargaEnId',
): void {
  try {
    aplicarEnDocDePlan(eng, planId, (doc) => {
      const b = (doc.bajantes || []).find((x) => (x as { id?: string }).id === bajanteId) as
        Record<string, unknown> | undefined;
      if (!b || b[prop] == null) return;
      b[prop] = null;
    });
  } catch {
    /* best-effort: la desasociación sigue valiendo en el motor */
  }
}

export function clearBajanteAssociation(
  eng: IPlanoEngineCore,
  sourcePlanId: string,
  sourceBajanteId: string,
  sourceNet: string,
  oldLinkValue: string,
  plans: SyncPlanInput[],
): void {
  const [targetPlanId, targetBajanteId] = splitPtr(oldLinkValue, '');
  if (!targetPlanId || !targetBajanteId) return;
  const loadedPlanId = String(eng._loadedPlanId ?? '');
  const reverseValue = `${sourcePlanId}|${sourceBajanteId}`;

  // LD/ghost/anillo de ESTE enlace y nada más: el LD es LD_<upperId> en el piso inferior
  // (nuevo) o en el superior (legado sin migrar — mismo id, otro piso).
  const roles = resolveLinkRoles(
    sourcePlanId,
    sourceBajanteId,
    targetPlanId,
    targetBajanteId,
    plans,
  );
  const exactLd = roles ? ldesvioIdFor(roles.upperId) : null;
  if (roles && exactLd) {
    removeCrossFloorLdesvioRamal(roles.lowerPlanId, roles.upperId);
    removeCrossFloorLdesvioRamal(roles.upperPlanId, roles.upperId);
    removeCrossFloorGhost(roles.upperPlanId, roles.lowerPlanId, roles.lowerId);
    // El LD era un RAMAL ASOCIADO del elemento destino (registro real): al morir el enlace,
    // sale también de sus listas — si se queda, los espejos le escriben la carga del bajante
    // y aparece una clave fantasma de UDs (orig. usuario).
    desasociarLdesvioDeBajante({
      planId: roles.lowerPlanId,
      bajanteId: roles.lowerId,
      ldId: exactLd,
      eng,
    });
    if (loadedPlanId === roles.lowerPlanId) {
      const vivo = bajanteLocalDe(eng, roles.lowerId) as
        (Record<string, unknown> & { id: string }) | undefined;
      if (vivo) {
        const recibe = ((vivo.recibeDeIds as string[] | undefined) || []).filter(
          (id) => id !== exactLd,
        );
        const manual = ((vivo.asocManual as string[] | undefined) || []).filter(
          (id) => id !== exactLd,
        );
        eng.updateElementById(vivo.id, { recibeDeIds: recibe, asocManual: manual });
      }
    }
    // El ANILLO del fantasma (desplazamientos/ghostData del bajante destino — el montante
    // fantasma dibujado en el piso inferior) muere con el enlace: sin esto quedaba el
    // fantasma flotando aunque el Ldesvio y el marcador XFG ya no existieran
    // (orig. usuario: al desasociar "solo se borra el Ldesvio").
    const sinAnillo = (b: Record<string, unknown>): boolean => {
      const desp = b.desplazamientos as Record<string, { Ldesvio?: string }> | undefined;
      if (!desp) return false;
      let toco = false;
      for (const lvl of Object.keys(desp)) {
        if (desp[lvl]?.Ldesvio === exactLd) {
          delete desp[lvl];
          if (b.ghostData) delete (b.ghostData as Record<string, unknown>)[lvl];
          toco = true;
        }
      }
      return toco;
    };
    try {
      aplicarEnDocDePlan(eng, roles.lowerPlanId, (doc) => {
        const bAnillo = (doc.bajantes || []).find(
          (x) => (x as { id?: string }).id === roles.lowerId,
        ) as Record<string, unknown> | undefined;
        // El helper persiste (estado vivo si el piso está abierto, storage si está cerrado).
        if (bAnillo) sinAnillo(bAnillo);
      });
    } catch {
      /* best-effort */
    }
    const vivoAnillo = bajanteLocalDe(eng, roles.lowerId) as
      (Record<string, unknown> & { id: string }) | undefined;
    if (vivoAnillo && sinAnillo(vivoAnillo)) {
      eng.updateElementById(vivoAnillo.id, {
        desplazamientos: vivoAnillo.desplazamientos,
        ghostData: vivoAnillo.ghostData,
      });
    }
  } else {
    // Último recurso (sin ghost ni npts): barrido amplio legacy.
    removeCrossFloorGhost(targetPlanId, sourcePlanId, sourceBajanteId);
    removeCrossFloorGhost(sourcePlanId, targetPlanId, targetBajanteId);
    removeCrossFloorLdesvioRamal(sourcePlanId, sourceBajanteId);
    removeCrossFloorLdesvioRamal(targetPlanId, targetBajanteId);
    removeCrossFloorLdesvioRamal(targetPlanId, sourceBajanteId);
    removeCrossFloorLdesvioRamal(sourcePlanId, targetBajanteId);
  }
  // Punteros: solo se anulan si aún apuntan a ESTE enlace (un puntero a otro enlace es de
  // otro par y no se toca — p. ej. el origenId de una cadena de 3 pisos).
  const curSrcPtr = readBajanteLink(eng, sourcePlanId, sourceBajanteId);
  const curTgtPtr = readBajanteLink(eng, targetPlanId, targetBajanteId);
  if (curTgtPtr.origenId === reverseValue) {
    writeBajantePropToDrawing(
      `${targetBajanteId}-${targetPlanId}`,
      sourceNet,
      'origenId',
      null,
      plans,
    );
  }
  if (curSrcPtr.descargaEnId === `${targetPlanId}|${targetBajanteId}`) {
    writeBajantePropToDrawing(
      `${sourceBajanteId}-${sourcePlanId}`,
      sourceNet,
      'descargaEnId',
      null,
      plans,
    );
  }
  // Los punteros también directo al storage de cada piso: `writeBajantePropToDrawing` solo
  // recorre los planes CONFIRMADOS que le pasan, y desde el motor no hay lista de planes —
  // sin esta pasada el origenId del piso vecino sobrevivía y el desplegable de origen seguía
  // apuntando a un enlace ya deshecho (orig. usuario: al borrar el fantasma, "sin origen").
  limpiarPunteroEnStorage(eng, targetPlanId, targetBajanteId, 'origenId');
  limpiarPunteroEnStorage(eng, sourcePlanId, sourceBajanteId, 'descargaEnId');

  // Fantasma en el motor vivo: el piso abierto lo renderiza (punteada + cuarto de círculo)
  // aunque el storage ya se limpió — antes solo se filtraba si el cargado era el TARGET, y
  // desasociar desde el superior (SOURCE) dejaba el fantasma pintado (orig. usuario).
  // Filtro por enlace exacto, sin importar qué lado está cargado.
  if (roles) {
    eng.crossFloorGhosts = eng.crossFloorGhosts.filter(
      (g) => !(g.sourcePlanId === roles.lowerPlanId && g.sourceBajanteId === roles.lowerId),
    );
  } else {
    eng.crossFloorGhosts = eng.crossFloorGhosts.filter(
      (g) =>
        !(
          (g.sourcePlanId === sourcePlanId && g.sourceBajanteId === sourceBajanteId) ||
          (g.sourcePlanId === targetPlanId && g.sourceBajanteId === targetBajanteId)
        ),
    );
  }
  if (loadedPlanId === targetPlanId) {
    const t = bajanteLocalDe(eng, targetBajanteId);
    if (t && (t.origenId ?? null) === reverseValue) eng.updateElementById(t.id, { origenId: null });
  }
  if (loadedPlanId === sourcePlanId) {
    const s = bajanteLocalDe(eng, sourceBajanteId);
    if (s && (s.descargaEnId ?? null) === `${targetPlanId}|${targetBajanteId}`)
      eng.updateElementById(s.id, { descargaEnId: null });
  }
  // El Ldesvio (ramal autogenerado) de ESTE enlace se borra del motor vivo por id exacto —
  // el filtro amplio por ambos ids borraba el LD de un enlace cruzado en el mismo piso.
  if (exactLd) eng.ramales = eng.ramales.filter((r) => r.id !== exactLd);
  // Anillo (desplazamientos) que referencia el LD exacto — en el bajante inferior (nuevo) o
  // en el superior (legado): buscar por id exacto, nunca por familia de ids.
  const limpiarDespExacto = (planId: string) => {
    if (!exactLd) return;
    aplicarEnDocDePlan(eng, planId, (doc) => {
      for (const raw of doc.bajantes || []) {
        const b = raw as StoredBajanteDesp & { id?: string };
        if (!b.desplazamientos) continue;
        const desp = { ...b.desplazamientos };
        const gd = b.ghostData ? { ...b.ghostData } : undefined;
        for (const lvl of Object.keys(desp)) {
          if (desp[lvl]?.Ldesvio === exactLd) {
            delete desp[lvl];
            if (gd) delete gd[lvl];
          }
        }
        b.desplazamientos = desp;
        if (gd) b.ghostData = gd;
      }
    });
  };
  const ringPlans = roles
    ? [roles.lowerPlanId, roles.upperPlanId]
    : [...new Set([targetPlanId, sourcePlanId])];
  const ringIds = exactLd
    ? new Set([exactLd])
    : new Set([ldesvioIdFor(sourceBajanteId), ldesvioIdFor(targetBajanteId)]);
  for (const pid of ringPlans) {
    if (loadedPlanId === pid) {
      const ids = roles ? [roles.lowerId, roles.upperId] : [targetBajanteId, sourceBajanteId];
      const bajL = bajanteLocalQueCumple(eng, (b) => ids.includes(b.id));
      if (!bajL) continue;
      const desp = { ...(bajL.desplazamientos || {}) };
      for (const lvl of Object.keys(desp)) {
        const ldRef = desp[lvl]?.Ldesvio;
        if (ldRef && ringIds.has(ldRef)) {
          delete desp[lvl];
        }
      }
      const gd = bajL.ghostData ? { ...bajL.ghostData } : undefined;
      if (gd) {
        for (const lvl of Object.keys(gd)) {
          if (!desp[lvl]) delete gd[lvl];
        }
      }
      eng.updateElementById(bajL.id, {
        desplazamientos: desp,
        ...(gd ? { ghostData: gd } : {}),
      });
    } else {
      if (!exactLd) {
        // Legacy sin id exacto: barrido amplio solo como último recurso (comportamiento previo).
        const raw = loadFromStorage<{ bajantes?: StoredBajanteDesp[] } | null>(
          TRAZOS_PREFIX + pid,
          null,
        );
        if (raw?.bajantes) {
          let changed = false;
          for (const b of raw.bajantes) {
            if (!b.desplazamientos) continue;
            const desp = { ...b.desplazamientos };
            const gd = b.ghostData ? { ...b.ghostData } : undefined;
            for (const lvl of Object.keys(desp)) {
              if (desp[lvl]?.Ldesvio && ringIds.has(desp[lvl]!.Ldesvio!)) {
                delete desp[lvl];
                if (gd) delete gd[lvl];
                changed = true;
              }
            }
            b.desplazamientos = desp;
            if (gd) b.ghostData = gd;
          }
          if (changed) {
            (raw as { ts?: number }).ts = Date.now();
            saveToStorage(TRAZOS_PREFIX + pid, raw);
            saveTrazosToDB(pid, raw);
          }
        }
      } else {
        limpiarDespExacto(pid);
      }
    }
  }

  // Revertir la herencia de UC/UD (orig. usuario): al asociar se SUMÓ el agregado del bajante
  // superior a los ramales del inferior (y a su Ldesvio + ucAcum). Al desasociar se RESTA esa
  // misma porción, se borra la clave del Ldesvio, se resetea ucAcum y se refrescan los paneles
  // en vivo (eventos storage/aparatos-clear).
  try {
    // 1) Reversión EXACTA por libro de herencia (orig. usuario): `ucAplicado` en el bajante
    //    destino registra lo que la asociación SUMÓ por clave — al desasociar se resta eso
    //    (piso a 0), preservando asignaciones manuales posteriores; la clave del Ldesvio se
    //    borra, ucAcum vuelve a 0 y se refresca en vivo.
    const tgtTrazosSnap = loadFromStorage<{
      bajantes?: Array<{
        id: string;
        ucAcum?: number;
        ucAplicado?: Record<string, Record<string, number>>;
        ucAplicadoHidro?: Record<string, Record<string, number>>;
      }>;
    } | null>(TRAZOS_PREFIX + targetPlanId, null);
    const tb = tgtTrazosSnap?.bajantes?.find((x) => x.id === targetBajanteId);
    // El motor VIVO manda sobre el storage cuando el piso destino es el cargado: el autosave
    // puede llevar hasta 1.5 s de retraso y un libro recién escrito solo existe en memoria.
    const liveTb = loadedPlanId === targetPlanId ? bajanteLocalDe(eng, targetBajanteId) : undefined;
    const aplicado =
      liveTb?.ucAplicado && Object.keys(liveTb.ucAplicado).length
        ? liveTb.ucAplicado
        : tb?.ucAplicado;
    const aplicadoHidro =
      liveTb?.ucAplicadoHidro && Object.keys(liveTb.ucAplicadoHidro).length
        ? liveTb.ucAplicadoHidro
        : tb?.ucAplicadoHidro;
    const snap = aplicado && Object.keys(aplicado).length ? aplicado : undefined;
    // Libro hidro gemelo; sin él (dibujos viejos) se resta el libro de aparatos, como antes.
    const snapHidro =
      aplicadoHidro && Object.keys(aplicadoHidro).length ? aplicadoHidro : undefined;
    if (snap || snapHidro) {
      const apos = loadFromStorage<Record<string, Record<string, number>>>(
        APARATOS_BY_TRAMO_KEY,
        {},
      );
      const hydro = loadFromStorage<
        Record<string, { accesorios?: Record<string, number>; Lh?: number; nSalidas?: number }>
      >(HYDRO_DATA_STORAGE_KEY, {});
      for (const [tk, applied] of Object.entries(snap || {})) {
        const cur = apos[tk];
        if (cur) {
          for (const [k, v] of Object.entries(applied)) {
            const nv = Math.max(0, (cur[k] || 0) - (v as number));
            if (nv > 0) cur[k] = nv;
            else delete cur[k];
          }
          if (Object.keys(cur).length === 0) delete apos[tk];
        }
      }
      for (const [tk, applied] of Object.entries(snapHidro || snap || {})) {
        const h = hydro[tk];
        if (h?.accesorios) {
          for (const [k, v] of Object.entries(applied)) {
            const nv = Math.max(0, (h.accesorios[k] || 0) - (v as number));
            if (nv > 0) h.accesorios[k] = nv;
            else delete h.accesorios[k];
          }
          if (Object.keys(h.accesorios).length === 0) delete h.accesorios;
        }
        // Sin accesorios ni valores queda un cascarón vacío creado por la herencia: fuera.
        if (h && !h.accesorios && !((h.Lh ?? 0) > 0) && !((h.nSalidas ?? 0) > 0)) delete hydro[tk];
      }
      if (tb) {
        tb.ucAcum = 0;
        delete tb.ucAplicado;
        delete tb.ucAplicadoHidro;
      }
      // La clave del Ldesvio es un espejo machine-written (panel de solo lectura): se borra
      // entera al desasociar. Scope EXACTO (id del upper de este enlace): el barrido amplio
      // borraba el LD de un enlace cruzado con el mismo id en otro piso.
      if (roles && exactLd) {
        delete apos[`${sourceNet}_${exactLd}_${roles.lowerPlanId}`];
        delete hydro[`${sourceNet}_${exactLd}_${roles.lowerPlanId}`];
        delete apos[`${sourceNet}_${exactLd}_${roles.upperPlanId}`];
        delete hydro[`${sourceNet}_${exactLd}_${roles.upperPlanId}`];
      } else {
        for (const ld of [ldesvioIdFor(sourceBajanteId), ldesvioIdFor(targetBajanteId)]) {
          for (const pid of [targetPlanId, sourcePlanId]) {
            delete apos[`${sourceNet}_${ld}_${pid}`];
            delete hydro[`${sourceNet}_${ld}_${pid}`];
          }
        }
      }
      saveToStorage(APARATOS_BY_TRAMO_KEY, apos);
      saveToStorage(HYDRO_DATA_STORAGE_KEY, hydro);
      // Sin snapshot del trazos destino (caché ausente, libro venía del motor vivo) no hay
      // nada que revertir en disco: escribir null fabricaba una caché muerta y el push vacío
      // a BD borraba el piso. Solo se re-escribe un documento existente.
      if (tgtTrazosSnap && String(loadedPlanId ?? '') !== String(targetPlanId)) {
        // Si el plano destino está ABIERTO, el motor es la verdad (y su autosave persiste):
        // reescribir el snapshot (un doc VIEJO) encima machacaría lo dibujado después.
        (tgtTrazosSnap as { ts?: number }).ts = Date.now();
        saveToStorage(TRAZOS_PREFIX + targetPlanId, tgtTrazosSnap);
        saveTrazosToDB(targetPlanId, tgtTrazosSnap);
      }
      try {
        writeSanDrawingSync(plans);
        writeHydroDrawingSync(plans);
      } catch {
        /* sync best-effort */
      }
      if (loadedPlanId === targetPlanId) {
        const t = bajanteLocalDe(eng, targetBajanteId);
        if (t)
          eng.updateElementById(t.id, {
            ucAcum: 0,
            ucAplicado: undefined,
            ucAplicadoHidro: undefined,
          });
      }
      emitAparatosClear();
      emitSanSync();
      window.dispatchEvent(new Event(EV_STORAGE));
      eng._markDirty?.();
      eng.render?.();
      return;
    }
    // Sin libro (dibujos viejos / otro dispositivo): la reversión exacta sale de la propia
    // clave LD — el espejo machine-written registra justo lo heredado. Solo sin LD se
    // recomputa en directo (mejor esfuerzo, sin topes).
    const apos = loadFromStorage<Record<string, Record<string, number>>>(APARATOS_BY_TRAMO_KEY, {});
    const hydro = loadFromStorage<
      Record<string, { accesorios?: Record<string, number>; Lh?: number; nSalidas?: number }>
    >(HYDRO_DATA_STORAGE_KEY, {});
    const ldKeyExact = roles && exactLd ? `${sourceNet}_${exactLd}_${roles.lowerPlanId}` : null;
    const ldAgg: Record<string, number> = (ldKeyExact && apos[ldKeyExact]) || {};
    const ldHydro: Record<string, number> = (ldKeyExact && hydro[ldKeyExact]?.accesorios) || {};
    const agg: Record<string, number> = { ...ldAgg };
    const hydroAgg: Record<string, number> = { ...ldHydro };
    if (!Object.keys(agg).length && !Object.keys(hydroAgg).length) {
      // Enlace alineado viejo (sin LD): recomputar directo del lado source, sin cierre
      // transitivo (espeja lo que el apply viejo sumó) y sin topes.
      const srcRaw = loadFromStorage<{
        bajantes?: InheritPoolBajante[];
        ramales?: InheritPoolRamal[];
      } | null>(TRAZOS_PREFIX + sourcePlanId, null);
      const liveSrcBaj =
        loadedPlanId === sourcePlanId ? bajanteLocalDe(eng, sourceBajanteId) : undefined;
      const srcBaj = liveSrcBaj ?? srcRaw?.bajantes?.find((b) => b.id === sourceBajanteId);
      const byId = new Map((srcRaw?.ramales || []).map((r) => [r.id, r]));
      for (const rid of srcBaj?.recibeDeIds || []) {
        const sk = `${sourceNet}_${rid}_${sourcePlanId}`;
        for (const [k, v] of Object.entries(apos[sk] || {})) agg[k] = (agg[k] || 0) + (v as number);
        const fx = byId.get(rid)?.fixtures;
        if (!apos[sk] && fx)
          for (const [k, v] of Object.entries(fx)) agg[k] = (agg[k] || 0) + (v as number);
        for (const [k, v] of Object.entries(hydro[sk]?.accesorios || {}))
          hydroAgg[k] = (hydroAgg[k] || 0) + (v as number);
      }
    }
    // Clave del Ldesvio: se borra entera (el conector desaparece con la desasociación).
    if (ldKeyExact) {
      delete apos[ldKeyExact];
      delete hydro[ldKeyExact];
    } else {
      const ldId = ldesvioIdFor(sourceBajanteId);
      delete apos[`${sourceNet}_${ldId}_${targetPlanId}`];
      delete hydro[`${sourceNet}_${ldId}_${targetPlanId}`];
    }
    // Ramales del destino: restar el agregado heredado (piso a 0, sin claves vacías). Sin
    // listas (dibujos viejos): respaldo geométrico por extremo, no toda la red (eso restaba
    // UDs ajenas al bajante).
    const tgtRaw = loadFromStorage<{
      bajantes?: (InheritPoolBajante & { x?: number; y?: number })[];
      ramales?: (InheritPoolRamal & { net: string })[];
    } | null>(TRAZOS_PREFIX + targetPlanId, null);
    const tgtBaj = tgtRaw?.bajantes?.find((x) => x.id === targetBajanteId);
    const liveTgtBaj =
      loadedPlanId === targetPlanId ? bajanteLocalDe(eng, targetBajanteId) : undefined;
    const effTgtBaj = liveTgtBaj ?? tgtBaj;
    const tgtRamalIds = [...(effTgtBaj?.recibeDeIds || []), ...(effTgtBaj?.alimentaIds || [])];
    if (tgtRamalIds.length === 0 && tgtRaw?.ramales?.length) {
      const bx = liveTgtBaj?.x ?? tgtBaj?.x;
      const by = liveTgtBaj?.y ?? tgtBaj?.y;
      for (const rr of tgtRaw.ramales) {
        if (rr.net !== sourceNet || !rr.id || rr.id.startsWith('LD_')) continue;
        if (bx == null || by == null || !rr.pts || rr.pts.length < 2) continue;
        const head = rr.pts[0];
        const tail = rr.pts[rr.pts.length - 1];
        if (
          Math.hypot(head[0] - bx, head[1] - by) < GEO_TOL_BAJANTE ||
          Math.hypot(tail[0] - bx, tail[1] - by) < GEO_TOL_BAJANTE
        )
          tgtRamalIds.push(rr.id);
      }
    }
    for (const rid of tgtRamalIds) {
      const tk = `${sourceNet}_${rid}_${targetPlanId}`;
      const cur = apos[tk];
      if (cur) {
        for (const [k, v] of Object.entries(agg)) {
          const nv = Math.max(0, (cur[k] || 0) - (v as number));
          if (nv > 0) cur[k] = nv;
          else delete cur[k];
        }
        if (Object.keys(cur).length === 0) delete apos[tk];
      }
      const h = hydro[tk];
      if (h?.accesorios) {
        for (const [k, v] of Object.entries(hydroAgg)) {
          const nv = Math.max(0, (h.accesorios[k] || 0) - (v as number));
          if (nv > 0) h.accesorios[k] = nv;
          else delete h.accesorios[k];
        }
        if (Object.keys(h.accesorios).length === 0) delete h.accesorios;
      }
    }
    saveToStorage(APARATOS_BY_TRAMO_KEY, apos);
    saveToStorage(HYDRO_DATA_STORAGE_KEY, hydro);
    // ucAcum del bajante destino vuelve a 0 — escritura directa al storage del piso destino
    // (no depende del parámetro plans, que llega vacío en algunos caminos de borrado).
    aplicarEnDocDePlan(eng, targetPlanId, (doc) => {
      const tb = (doc.bajantes || []).find((x) => (x as { id?: string }).id === targetBajanteId) as
        { id: string; ucAcum?: number } | undefined;
      if (tb && tb.ucAcum) tb.ucAcum = 0;
    });
    if (loadedPlanId === targetPlanId) {
      const t = bajanteLocalDe(eng, targetBajanteId);
      if (t) eng.updateElementById(t.id, { ucAcum: 0 });
    }
    // Refresco en vivo de paneles y tablas: reescribir sync (árbol sin el enlace) + eventos.
    try {
      writeSanDrawingSync(plans);
      writeHydroDrawingSync(plans);
    } catch {
      /* sync best-effort */
    }
    emitAparatosClear();
    emitSanSync();
    window.dispatchEvent(new Event(EV_STORAGE));
    eng._markDirty?.();
    eng.render?.();
  } catch {
    /* reversión best-effort */
  }

  // Marca de desasociación en AMBOS pisos (ver estamparAsocsClearedTs): corta la
  // resurrección desde cachés stale de otros dispositivos.
  estamparAsocsClearedTs(Array.from(new Set([sourcePlanId, targetPlanId])));
}
