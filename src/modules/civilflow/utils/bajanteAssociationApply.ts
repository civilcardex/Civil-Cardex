import { clearBajanteAssociation } from './bajanteAssociationClear.ts';
import { bajanteDePisoEn, bajanteLocalDe as bajanteLocalCompartido } from './bajanteLocal.ts';
import { splitPtr } from './keys.ts';
import { esRedAparatosPresion, propagarAparatosPresion } from './propagation';
// Establece source -> target: escribe AMBOS punteros (source.descargaEnId, target.origenId),
// siempre crea el fantasma (en el piso del target, en la posición del source — una confirmación
// visual permanente de que el enlace existe, no solo algo que aparece cuando está desalineado), y
// crea el ramal de desvío Ldesvio (en el piso del source) solo cuando los dos no están ya
// alineados.
import { writeBajantePropToDrawing } from './writeDiameterToDrawing.ts';
import { writeSanDrawingSync, writeHydroDrawingSync } from './drawingSync.ts';
import type { SyncPlanInput } from './drawingSync.ts';
import type { IPlanoEngineCore, PlanoBajante } from '../lib/PlanoEngine/PlanoState.ts';
import {
  writeCrossFloorGhost,
  createCrossFloorLdesvioRamal,
  buildLdesvioRamal,
  ldesvioIdFor,
  nextRamalLabel,
  loadData,
  saveData,
  type CrossFloorGhost,
} from './associateBajanteAcrossFloors';
import { aFrameDe } from './crossFloorStorage.ts';
import { markAssocLayout } from './assocLayoutMigration.ts';
import { direccionSegura } from '../lib/PlanoEngine/directionRules.ts';
import { devError } from '../../../utils/devError.ts';
import { loadFromStorage, saveToStorage, saveTrazosToDB } from '../services/storageService.ts';
import {
  TRAZOS_PREFIX,
  APARATOS_BY_TRAMO_KEY,
  APARATOS_PROPIO_KEY,
  HYDRO_DATA_STORAGE_KEY,
} from '../constants/storage-keys.ts';
import { pisoCorto, pisoLbl } from '../constants';
import {
  isAligned,
  readBajanteLink,
  setBajanteDesplazamientoInStorage,
  collectSourceAgg,
  registrarLdesvioComoAsociado,
  GEO_TOL_BAJANTE,
} from './bajanteAssocShared.ts';
import type { AssocEndpoint, InheritPoolRamal, InheritPoolBajante } from './bajanteAssocShared.ts';
import { emitAparatosClear, emitSanSync, EV_STORAGE } from './fixtureEvents.ts';

/** Estampa la carga heredada en el fantasma (XFG) del enlace: el marcador guarda y muestra
 *  los UC que bajan por él (NO participa en cálculos - sigue siendo un marcador). Se escribe
 *  en el storage del piso del fantasma y en el motor vivo si ese piso está cargado. */
function estamparCargaEnFantasma(
  eng: IPlanoEngineCore,
  ghostPlanId: string,
  sourcePlanId: string,
  sourceBajanteId: string,
  carga: Record<string, number>,
): void {
  const total = Object.values(carga).reduce((s, v) => s + (Number(v) || 0), 0);
  // Motor vivo (el piso del fantasma cargado): el label se repinta al instante.
  const vivo = (eng.crossFloorGhosts || []).find(
    (g) => g.sourcePlanId === sourcePlanId && g.sourceBajanteId === sourceBajanteId,
  );
  if (vivo) {
    vivo.aparatos = { ...carga };
    vivo.ucAcum = total;
  }
  try {
    const data = loadData(ghostPlanId);
    const g = (data.crossFloorGhosts || []).find(
      (x) => x.sourcePlanId === sourcePlanId && x.sourceBajanteId === sourceBajanteId,
    );
    if (!g) return;
    g.aparatos = { ...carga };
    g.ucAcum = total;
    saveData(ghostPlanId, data);
  } catch (e) {
    devError('[ASSOC] carga del fantasma:', e);
  }
}

/** Bajante vivo por id prefiriendo el del PISO ABIERTO: el motor tiene los bajantes de otros
 *  pisos que atraviesan esta altura (proyecciones con pisoBase ajeno y el MISMO id tras un
 *  renombre) — un find() plano podía traer la proyección con libro rancio (orig. usuario).
 *  Resolvedor compartido (utils/bajanteLocal) para que TODOS loslectores usen el mismo criterio. */
function bajanteLocalDe(eng: IPlanoEngineCore, id: string): PlanoBajante | undefined {
  return bajanteLocalCompartido(eng, id);
}

export function applyBajanteAssociation(
  eng: IPlanoEngineCore,
  source: AssocEndpoint,
  target: AssocEndpoint,
  plans: SyncPlanInput[],
): { aligned: boolean } {
  const loadedPlanId = String(eng._loadedPlanId ?? '');
  const linkValue = `${target.planId}|${target.id}`;
  const reverseValue = `${source.planId}|${source.id}`;
  const targetIsBelow = target.npt < source.npt;
  // Dirección del flujo: la MISMA lógica para bajantes y montantes (orig. usuario): el
  // extremo de ARRIBA marca 'baja' (el agua baja por la tubería) y el fantasma marca 'sube'
  // (la flecha del enlace señala lo que entra por arriba). Antes los montantes quedaban
  // forzados a 'sube' y su glifo no cuadraba con el del bajante equivalente.
  const sourceDireccion: 'sube' | 'baja' = targetIsBelow ? 'baja' : 'sube';
  const ghostDireccion: 'sube' | 'baja' = targetIsBelow ? 'sube' : 'baja';
  const aligned = isAligned(source, target);

  // Enlaces en conflicto: si el destino ya colgaba de OTRO origen, o el origen descargaba
  // en OTRO destino, limpiar esos enlaces PRIMERO (cambiar de asociado sin esto dejaba al
  // otro extremo como escritor rancio: su propagación en vivo re-empujaba su agregado viejo
  // sobre la herencia nueva). La UI ya limpia el previo del mismo extremo; esto cubre el
  // extremo opuesto. Idempotente: con punteros ya nulos no hace nada.
  try {
    const curSrc = readBajanteLink(eng, source.planId, source.id);
    if (curSrc.descargaEnId && curSrc.descargaEnId !== linkValue)
      clearBajanteAssociation(
        eng,
        source.planId,
        source.id,
        source.net,
        curSrc.descargaEnId,
        plans,
      );
    const curTgt = readBajanteLink(eng, target.planId, target.id);
    if (curTgt.origenId && curTgt.origenId !== reverseValue) {
      const [opPlan, opId] = splitPtr(curTgt.origenId, '');
      if (opPlan && opId)
        clearBajanteAssociation(
          eng,
          opPlan,
          opId,
          target.net,
          `${target.planId}|${target.id}`,
          plans,
        );
    }
  } catch {
    /* limpieza best-effort */
  }

  writeBajantePropToDrawing(
    `${source.id}-${source.planId}`,
    source.net,
    'descargaEnId',
    linkValue,
    plans,
  );
  writeBajantePropToDrawing(
    `${source.id}-${source.planId}`,
    source.net,
    'direccion',
    sourceDireccion,
    plans,
  );
  writeBajantePropToDrawing(
    `${target.id}-${target.planId}`,
    target.net,
    'origenId',
    reverseValue,
    plans,
  );
  // Direccion automática (orig. usuario): el fantasma queda 'sube' y el PADRE/ORIGINAL 'baja' —
  // la dirección de la asociación manda en ambos extremos sin pasar por la validación del menú.
  writeBajantePropToDrawing(
    `${target.id}-${target.planId}`,
    target.net,
    // PUNTO 9: el original inferior recibe 'baja' — salvo que sea el último nivel (sin piso
    // debajo), en cuyo caso se coerces a 'continua' (dirección válida alternativa).
    'direccion',
    direccionSegura(eng, { nptBase: target.npt }, sourceDireccion) ?? sourceDireccion,
    plans,
  );
  if (loadedPlanId === source.planId) {
    eng.updateElementById(source.id, { descargaEnId: linkValue, direccion: sourceDireccion });
  }
  if (loadedPlanId === target.planId) {
    eng.updateElementById(target.id, {
      origenId: reverseValue,
      direccion: direccionSegura(eng, { nptBase: target.npt }, sourceDireccion) ?? sourceDireccion,
    });
  }

  // Layout de la asociación (orig. usuario): el FANTASMA (anillo del bajante superior) y el
  // Ldesvio viven en el PISO INFERIOR; el piso superior solo lleva los marcadores (círculo
  // punteado + línea punteada de renderCrossFloorGhosts) referenciando el Ldesvio y el bajante
  // inferior. `upper`/`lower` por NPT — en ambos flujos de la UI el source es el superior, pero
  // se deriva de npt para no depender de eso.
  const upper = targetIsBelow ? source : target;
  const lower = targetIsBelow ? target : source;
  const ldId = ldesvioIdFor(upper.id);
  // El upper traducido al frame del piso inferior (delta de orígenes de calibración): anillo y
  // Ldesvio viven en el piso inferior y deben apuntar a dónde cae la columna superior FÍSICAMENTE
  // en esa hoja, no a sus px crudos de otra lámina.
  const upperEnLower = aFrameDe({ x: upper.x, y: upper.y }, upper.planId, lower.planId);

  // Marcadores en el piso SUPERIOR: ghost posicionado donde cae el bajante inferior en ESA hoja
  // (coords del inferior traducidas al frame del superior), con targetBajanteId = bajante
  // superior — renderCrossFloorGhosts dibuja el círculo punteado en ese punto y la línea
  // punteada hasta el superior.
  const ghostPos = aFrameDe({ x: lower.x, y: lower.y }, lower.planId, upper.planId);
  const ghost: CrossFloorGhost = {
    id: `XFG_${lower.id}_${lower.planId}`,
    net: lower.net,
    code: lower.code || lower.id,
    x: ghostPos.x,
    y: ghostPos.y,
    dNominal: upper.dNominal || lower.dNominal || '',
    direccion: ghostDireccion,
    parentDireccion: sourceDireccion,
    piso: pisoCorto(lower.nivelN),
    sourcePlanId: lower.planId,
    sourceBajanteId: lower.id,
    targetBajanteId: upper.id,
    layout: 2,
  };
  writeCrossFloorGhost(upper.planId, ghost);
  markAssocLayout(upper.planId);
  // Diámetro (orig. usuario): el bajante inferior asociado toma el dNominal del SUPERIOR
  // (escritura directa al storage + campo vivo; bypass del guard de reducción de ramales —
  // el usuario quiere que tome el diámetro del superior incondicionalmente). El fantasma ya
  // nace con ese dNominal y los cambios posteriores del superior lo sincronizan solos.
  if (upper.dNominal && upper.dNominal !== lower.dNominal) {
    writeBajantePropToDrawing(
      `${lower.id}-${lower.planId}`,
      lower.net,
      'dNominal',
      upper.dNominal,
      plans,
    );
    if (loadedPlanId === lower.planId) {
      const liveLower = bajanteLocalDe(eng, lower.id);
      if (liveLower) liveLower.dNominal = upper.dNominal;
    }
  }
  if (loadedPlanId === upper.planId) {
    eng.crossFloorGhosts = [
      ...eng.crossFloorGhosts.filter(
        (g) => !(g.sourcePlanId === lower.planId && g.sourceBajanteId === lower.id),
      ),
      ghost,
    ];
  }

  // El anillo (desplazamientos) SOLO cuando NO están alineados (orig. usuario): alineados no
  // se crea Ldesvio ni etiqueta de fantasma — el bajante inferior ya está en su sitio y su
  // propia etiqueta basta; el marcador del piso superior queda suprimido por coincidir con el
  // bajante real (overlapReal en renderCrossFloorGhosts).
  if (!aligned) {
    if (loadedPlanId === lower.planId) {
      const lvl = eng.nivelActual?.label ?? '';
      if (lvl) {
        const lowBaj = bajanteLocalDe(eng, lower.id);
        if (lowBaj) {
          const desp = { ...(lowBaj.desplazamientos || {}) };
          desp[lvl] = {
            dx: upperEnLower.x - lower.x,
            dy: upperEnLower.y - lower.y,
            Ldesvio: ldId,
          };
          // El anillo (en la posición del bajante superior) muestra siempre el flujo SUBIENDO
          // (orig. usuario) — vía ghostData del nivel, sin tocar la dirección propia de B.
          const gd = { ...(lowBaj.ghostData || {}) };
          gd[lvl] = { ...(gd[lvl] ?? {}), direccion: 'sube' };
          eng.updateElementById(lower.id, { desplazamientos: desp, ghostData: gd });
        }
      }
    } else {
      // El piso inferior no está cargado (asociar desde el piso superior) — mismo bookkeeping,
      // escrito directo al storage de ese piso.
      setBajanteDesplazamientoInStorage(
        lower.planId,
        lower.id,
        pisoLbl(lower.nivelN),
        {
          dx: upperEnLower.x - lower.x,
          dy: upperEnLower.y - lower.y,
          Ldesvio: ldId,
        },
        'sube',
      );
    }
  }
  markAssocLayout(lower.planId);

  if (!aligned) {
    // Ldesvio en el PISO INFERIOR: del punto del bajante superior (traducido a esta hoja) al
    // inferior.
    createCrossFloorLdesvioRamal(
      lower.planId,
      upper.id,
      lower.net,
      upperEnLower.x,
      upperEnLower.y,
      lower.x,
      lower.y,
      upper.dNominal || '',
      lower.nivelN,
    );
    if (loadedPlanId === lower.planId) {
      const existing = eng.ramales.find((r) => r.id === ldId);
      const label = existing?.label || nextRamalLabel(lower.net, eng.ramales);
      const ramal = buildLdesvioRamal(
        ldId,
        label,
        lower.net,
        upperEnLower.x,
        upperEnLower.y,
        lower.x,
        lower.y,
        upper.dNominal || '',
        lower.nivelN,
        eng.scaleM || 0.5,
        existing ? existing.bloqueado : true,
      );
      eng.ramales = [...eng.ramales.filter((r) => r.id !== ldId), ramal as never];
    }
    // El LD es un RAMAL ASOCIADO del elemento al que llega (el original): queda registrado en
    // `recibeDeIds` + `asocManual` y con `fin` = su código → "Ramal asociado" sale MARCADO en
    // el panel derecho y en el menú contextual, y el estado es el REAL (no visual) — también
    // para los MONTANTES (misma lógica de asociación) (orig. usuario).
    const lowCode = lower.code || lower.id;
    registrarLdesvioComoAsociado({
      planId: lower.planId,
      bajanteId: lower.id,
      bajanteCode: lowCode,
      ldId,
      eng,
    });
    if (loadedPlanId === lower.planId) {
      const liveLow = bajanteLocalDe(eng, lower.id);
      if (liveLow) {
        const recibe = new Set(liveLow.recibeDeIds || []);
        const manual = new Set(liveLow.asocManual || []);
        recibe.add(ldId);
        manual.add(ldId);
        eng.updateElementById(lower.id, {
          recibeDeIds: [...recibe],
          asocManual: [...manual],
        });
      }
      const liveLd = eng.ramales.find((r) => r.id === ldId);
      if (liveLd && liveLd.fin !== lowCode) eng.updateElementById(ldId, { fin: lowCode });
    }
  }

  // Herencia UD: el piso inferior (fantasma/Ldesvio/original) recibe el agregado COMPLETO
  // del bajante superior — la misma verdad que muestra su panel y que propaga el vivo
  // (collectSourceAgg): clave propia + cierre transitivo, sin topes.
  try {
    const srcRaw = loadFromStorage<{
      bajantes?: InheritPoolBajante[];
      ramales?: InheritPoolRamal[];
    } | null>(TRAZOS_PREFIX + source.planId, null);
    const apos = loadFromStorage<Record<string, Record<string, number>>>(APARATOS_BY_TRAMO_KEY, {});
    const hydro = loadFromStorage<
      Record<string, { accesorios?: Record<string, number>; Lh?: number; nSalidas?: number }>
    >(HYDRO_DATA_STORAGE_KEY, {});
    const { agg, hydroAgg } = collectSourceAgg({
      net: source.net,
      planId: source.planId,
      bajId: source.id,
      liveBaj: loadedPlanId === source.planId ? (bajanteLocalDe(eng, source.id) ?? null) : null,
      liveRamales:
        loadedPlanId === source.planId ? (eng.ramales as unknown as InheritPoolRamal[]) : null,
      storedBaj: bajanteDePisoEn(srcRaw?.bajantes, source.id, pisoLbl(source.nivelN)) ?? null,
      storedRamales: srcRaw?.ramales ?? null,
      counts: apos,
      hidro: hydro,
    });
    // Sin caché del piso origen el agregado sale vacío y la herencia se omite en silencio:
    // avisar en vez de dejar el panel en 0 sin explicación (orig. usuario).
    if (!srcRaw && !Object.keys(agg).length && !hydroAgg) {
      eng.triggerAlert(
        'Unidades no heredadas',
        `No se pudieron leer las unidades de ${source.code || source.id} (piso ${source.planId}): su piso no tiene datos en este equipo. Ábrelo en el visor y vuelve a asociar para traer sus UD.`,
      );
    }
    if (Object.keys(agg).length || hydroAgg) {
      let aposDirty = false;
      let hydroDirty = false;
      // El FANTASMA (marcador del enlace en el piso de arriba) lleva la misma carga que
      // viaja por el Ldesvio: el usuario quiere ver los mismos UC en las tres piezas
      // (montante de destino, Ldesvio y fantasma). El fantasma no entra en ningún cálculo
      // (sigue siendo un marcador) — solo guarda y muestra la carga.
      if (Object.keys(agg).length) {
        estamparCargaEnFantasma(eng, upper.planId, lower.planId, lower.id, agg);
      }
      if (!aligned) {
        // El Ldesvio vive en el PISO INFERIOR (layout nuevo) — su clave de aparatos también.
        const ldKey = `${source.net}_${ldId}_${lower.planId}`;
        if (Object.keys(agg).length) {
          apos[ldKey] = { ...agg };
          aposDirty = true;
        }
        if (hydroAgg) {
          hydro[ldKey] = { accesorios: { ...hydroAgg }, Lh: 0, nSalidas: 0 };
          hydroDirty = true;
        }
      }
      // UCs automáticas al piso inferior (orig. usuario): los ramales conectados al bajante
      // DESTINO reciben el agregado del piso superior SUMADO a lo que ya tengan — y el
      // bajante destino marca el total en ucAcum.
      const tgtRaw = loadFromStorage<{
        bajantes?: {
          id: string;
          recibeDeIds?: string[];
          alimentaIds?: string[];
          ucAplicado?: Record<string, Record<string, number>>;
          ucAplicadoHidro?: Record<string, Record<string, number>>;
        }[];
        ramales?: { id: string; net: string }[];
      } | null>(TRAZOS_PREFIX + target.planId, null);
      const tgtBaj = bajanteDePisoEn(tgtRaw?.bajantes, target.id, pisoLbl(target.nivelN));
      // Mismo criterio vivo-sobre-storage para el bajante destino.
      const liveTgtBaj =
        loadedPlanId === target.planId ? bajanteLocalDe(eng, target.id) : undefined;
      const effTgtBaj = liveTgtBaj ?? tgtBaj;
      // Ramales que LLEGAN (recibeDeIds) y los que SALEN del bajante destino (alimentaIds,
      // orig. usuario: los ramales que salen del bajante también reciben las UDs). Sin topes:
      // un tope truncaba la herencia en pisos con muchos ramales.
      const tgtRamalIds: string[] = [
        ...(effTgtBaj?.recibeDeIds || []),
        ...(effTgtBaj?.alimentaIds || []),
      ];
      if (tgtRamalIds.length === 0 && tgtRaw?.ramales?.length) {
        // fallback geométrico (dibujos viejos sin listas): ramales de la red con un EXTREMO
        // junto al bajante destino — no toda la red (eso heredaba UDs ajenas al bajante).
        for (const rr of tgtRaw.ramales) {
          const pts = (rr as { pts?: number[][] }).pts;
          if (rr.net !== target.net || !rr.id || rr.id.startsWith('LD_') || !pts || pts.length < 2)
            continue;
          const head = pts[0];
          const tail = pts[pts.length - 1];
          if (
            Math.hypot(head[0] - target.x, head[1] - target.y) < GEO_TOL_BAJANTE ||
            Math.hypot(tail[0] - target.x, tail[1] - target.y) < GEO_TOL_BAJANTE
          )
            tgtRamalIds.push(rr.id);
        }
      }
      // UDs propias del bajante destino: los ramales que SALEN de él deben tener las mismas
      // UDs que el bajante (orig. usuario, asignación automática).
      // Libro de herencia (orig. usuario): por cada ramal destino se registra lo APLICADO
      // (`ucAplicado`/`ucAplicadoHidro` en el bajante destino, persistidos con sus trazos).
      // La (re)asociación y la propagación en vivo restan la herencia anterior y aplican la
      // nueva (delta): preserva asignaciones manuales, no acumula al reprocesar y la
      // desasociación resta exactamente lo heredado.
      const ucAplicado: Record<string, Record<string, number>> = {};
      const ucAplicadoHidro: Record<string, Record<string, number>> = {};
      const prevBook = effTgtBaj?.ucAplicado || {};
      const prevHydroBook = effTgtBaj?.ucAplicadoHidro || {};
      const own = apos[`${target.net}_${target.id}_${target.planId}`] || {};
      for (const rid of tgtRamalIds) {
        const tk = `${target.net}_${rid}_${target.planId}`;
        const esAlimenta = (effTgtBaj?.alimentaIds || []).includes(rid);
        // PRESIÓN (af/ac/gas): las entradas del libro son SOLO el grupo del superior — lo
        // propio del montante destino NO es herencia (baja a sus ramales por el upMonte) y
        // si se mezclaba aquí, el panel del asociado (máximo del libro) mostraba propio +
        // heredado juntos (orig. usuario: 16.5 en vez de los 4.5 heredados).
        const extra = esAlimenta && !esRedAparatosPresion(target.net) ? { ...agg, ...own } : agg;
        const prevAp = prevBook[tk] || {};
        const cur = apos[tk] || {};
        // Delta UNA SOLA VEZ (acción del usuario): reemplaza la herencia previa por la nueva
        // conservando lo propio — y en el caso ALINEADOS sin Ldesvio este disco es el ÚNICO
        // camino de la herencia. Auto-consistente: el libro previo se lee del MISMO doc que
        // se está por escribir (a diferencia de los espejos, que re-lean un doc que otro
        // writer pudo mover — ahí la herencia va SOLO por libro + Ldesvio; el delta repetido
        // re-sumaba en cada pase: +1 aparato por cambio de piso, orig. usuario).
        const result: Record<string, number> = {};
        for (const k of new Set([...Object.keys(cur), ...Object.keys(extra)])) {
          const nv = Math.max(0, (cur[k] || 0) - (prevAp[k] || 0)) + (extra[k] || 0);
          if (nv > 0) result[k] = nv;
        }
        // Con LDesvio (!aligned) la herencia viaja SOLO por el libro + la clave del LD:
        // escribirla además en cada ramal la mezclaba con lo propio y los espejos la
        // re-sumaban en cada pase (+1 lavamanos/inodoro/ducha por cambio de piso — orig.
        // usuario). ALINEADOS (sin LD) este disco es el ÚNICO camino de la herencia y el
        // delta queda (el apply es una acción única y lee el libro del mismo doc que escribe).
        if (aligned) {
          if (JSON.stringify(cur) !== JSON.stringify(result)) {
            if (Object.keys(result).length) apos[tk] = result;
            else delete apos[tk];
            aposDirty = true;
          }
        }
        ucAplicado[tk] = { ...extra };
        if (hydroAgg) {
          const prevH = prevHydroBook[tk] || {};
          const hcur = hydro[tk] || { accesorios: {}, Lh: 0, nSalidas: 0 };
          const acc: Record<string, number> = {};
          for (const k of new Set([
            ...Object.keys(hcur.accesorios || {}),
            ...Object.keys(hydroAgg),
          ])) {
            const nv =
              Math.max(0, ((hcur.accesorios || {})[k] || 0) - (prevH[k] || 0)) + (hydroAgg[k] || 0);
            if (nv > 0) acc[k] = nv;
          }
          if (JSON.stringify(hcur.accesorios || {}) !== JSON.stringify(acc)) {
            hydro[tk] = { ...hcur, accesorios: acc };
            hydroDirty = true;
          }
          ucAplicadoHidro[tk] = { ...hydroAgg };
        }
      }
      if (!aligned) {
        // SEMBRAR la foto de lo propio del enlace AHORA (no esperar al primer pase de
        // espejos): un clear inmediato, sin foto todavía, caía al fallback "resta completa"
        // y borraba las asignaciones manuales de un disco que jamás recibió herencia
        // (doctrina libro-solo — orig. auditoría F-1'). En no-alineado el disco de cada
        // clave destino ES lo propio en este momento.
        try {
          const snap =
            loadFromStorage<
              Record<
                string,
                {
                  uc?: Record<string, Record<string, number>>;
                  hidro?: Record<string, Record<string, number>>;
                }
              >
            >(APARATOS_PROPIO_KEY, {}) || {};
          const entry = snap[`${lower.planId}|${lower.id}`] || { uc: {}, hidro: {} };
          entry.uc = entry.uc || {};
          for (const rid of tgtRamalIds) {
            const tk = `${target.net}_${rid}_${target.planId}`;
            entry.uc[tk] = { ...(apos[tk] || {}) };
          }
          snap[`${lower.planId}|${lower.id}`] = entry;
          saveToStorage(APARATOS_PROPIO_KEY, snap);
        } catch {
          /* best-effort: el pase de espejos re-siembra */
        }
      }
      if (!aligned) {
        const ldKey = `${source.net}_${ldId}_${lower.planId}`;
        // El Ldesvio lleva las UDs del agregado del superior: escribir su clave REAL.
        // Sin agregado, la clave se borra (no dejar `{}` vacío colgado).
        if (Object.keys(agg).length) {
          apos[ldKey] = { ...agg };
          ucAplicado[ldKey] = { ...agg };
        } else {
          delete apos[ldKey];
        }
        aposDirty = true;
        if (hydroAgg) {
          hydro[ldKey] = { accesorios: { ...hydroAgg }, Lh: 0, nSalidas: 0 };
          hydroDirty = true;
          ucAplicadoHidro[ldKey] = { ...hydroAgg };
        } else {
          delete hydro[ldKey];
          hydroDirty = true;
        }
      }
      if (!hydroAgg && Object.keys(prevHydroBook).length) {
        // El superior perdió su hidro desde la última aplicación: restar la herencia hidro
        // vieja de los ramales destino para no dejarla colgada.
        for (const [tk, prevH] of Object.entries(prevHydroBook)) {
          const hcur = hydro[tk];
          if (!hcur?.accesorios) continue;
          for (const [k, v] of Object.entries(prevH)) {
            const nv = Math.max(0, (hcur.accesorios[k] || 0) - (v as number));
            if (nv > 0) hcur.accesorios[k] = nv;
            else delete hcur.accesorios[k];
          }
          if (Object.keys(hcur.accesorios).length === 0) delete hcur.accesorios;
          hydroDirty = true;
        }
      }
      // Persistir los libros de herencia en el bajante destino (storage + BD).
      {
        const tgtSave = loadFromStorage<{
          bajantes?: Array<{
            id: string;
            ucAplicado?: Record<string, Record<string, number>>;
            ucAplicadoHidro?: Record<string, Record<string, number>>;
          }>;
        } | null>(TRAZOS_PREFIX + target.planId, null);
        const tb = bajanteDePisoEn(tgtSave?.bajantes, target.id, pisoLbl(target.nivelN));
        if (tb) {
          tb.ucAplicado = ucAplicado;
          if (Object.keys(ucAplicadoHidro).length) tb.ucAplicadoHidro = ucAplicadoHidro;
          else delete tb.ucAplicadoHidro;
          // ts fresco: el doc cambió y debe quedar como el más nuevo (el árbitro de carga
          // deja ganar a la BD si su ts es mayor → la asociación se perdía al recargar).
          (tgtSave as { ts?: number }).ts = Date.now();
          saveToStorage(TRAZOS_PREFIX + target.planId, tgtSave);
          saveTrazosToDB(target.planId, tgtSave);
        }
      }
      if (aposDirty) saveToStorage(APARATOS_BY_TRAMO_KEY, apos);
      if (hydroDirty) saveToStorage(HYDRO_DATA_STORAGE_KEY, hydro);
      // ucAcum del bajante destino = total UC agregada del piso superior (visible en tablas).
      const totalUc = Object.values(agg).reduce((s, v) => s + (v as number), 0);
      if (loadedPlanId === target.planId) {
        // El libro también vive en el motor: la próxima (re)asociación lee el vivo primero
        // (el storage puede ir 1.5 s tarde) y el delta necesita el libro previo exacto.
        const liveSync: Record<string, unknown> = { ucAplicado, ucAplicadoHidro };
        if (totalUc > 0) liveSync.ucAcum = totalUc;
        eng.updateElementById(target.id, liveSync);
        // La carga nueva del montante (ucAplicado) se propaga a los ramales que nacen de él
        // (af/ac, orig. usuario).
        const netAsoc = String(source.net || '');
        if (esRedAparatosPresion(netAsoc)) propagarAparatosPresion(netAsoc);
      }
      if (totalUc > 0) {
        writeBajantePropToDrawing(
          `${target.id}-${target.planId}`,
          target.net,
          'ucAcum',
          totalUc,
          plans,
        );
      }
      if (aposDirty || hydroDirty) {
        try {
          emitAparatosClear();
          emitSanSync();
        } catch {
          /* ignore */
        }
      }
    }
  } catch (e) {
    // La herencia UC/libro pudo quedar aplicada a MEDIAS: visible en DEV, no silencio total.
    devError('[assoc] herencia UC/libro a medias:', e);
  }

  // Refresco garantizado tras asociar (en vivo, orig. usuario): reescribir las claves de sync
  // reconstruye el árbol de conectividad (con el enlace nuevo) y los eventos hacen que panel y
  // tablas relean storage al instante.
  try {
    writeSanDrawingSync(plans);
    writeHydroDrawingSync(plans);
    emitAparatosClear();
    emitSanSync();
    window.dispatchEvent(new Event(EV_STORAGE));
  } catch {
    /* ignore */
  }
  eng.render();
  eng._markDirty();
  return { aligned };
}
