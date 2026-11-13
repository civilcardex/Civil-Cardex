/**
 * Orquestador de la copia entre pisos: lee el doc del plano origen, calibra, y por cada red
 * seleccionada renumera ids, remapea referencias y conteos, transforma geometría, empuja al
 * motor, genera fantasmas y retira XFG residuales — en EL MISMO orden del monolito original.
 * Ej: copiar la red af del Piso 1 al Piso 2 con {ramal, bajante} replica ramales, bajantes y conteos.
 */
import { loadFromStorage } from '../../services/storageService.ts';
import { NETS } from '../../lib/PlanoEngine/PlanoState.ts';
import type { PlanoRamal, PlanoBajante } from '../../lib/PlanoEngine/PlanoState.ts';
import { isLdesvioRamalId } from '../crossFloorStorage.ts';
import { direccionSegura } from '../../lib/PlanoEngine/directionRules.ts';
import { copyStoreKeys } from './storeKeys.ts';
import { renombrarElementos } from './renumber.ts';
import {
  remapearReferencias,
  limpiarCachesRender,
  remapearMergesYLibros,
  limpiarPunterosEntrePisos,
} from './references.ts';
import { calibrarCopiado, transformarGeometria } from './geometry.ts';
import { generarFantasmas, retirarGhostsResiduales } from './phantoms.ts';
import { guardarYRefrescar } from './persist.ts';
import type {
  CopySourceSelection,
  CopyAlineacion,
  CopyResult,
  CopyOpciones,
  CopyElement,
  ExtendedEngine,
} from './types.ts';

export function copyDrawingFromPlan(
  engine: ExtendedEngine,
  targetPlanId: string,
  sourcePlanId: string,
  selections: CopySourceSelection[],
  alineacion?: CopyAlineacion,
  opciones?: CopyOpciones,
): CopyResult {
  const sourceRaw = loadFromStorage(`trazos_${sourcePlanId}`, null);
  if (!sourceRaw) return { copied: 0, skippedNets: ['El plano origen no tiene datos de dibujo'] };

  const sourceData = (typeof sourceRaw === 'string' ? JSON.parse(sourceRaw) : sourceRaw) as {
    ramales?: CopyElement[];
    bajantes?: CopyElement[];
    scaleM?: number;
    crossFloorGhosts?: Array<Record<string, unknown>>;
  };
  // FANTASMA (orig. usuario) = el MISMO bajante copiado en su posición DESPLAZADA por el
  // anillo de asociación (x+dx, y+dy), con dirección 'sube'. El modo decide qué viaja:
  // originales / desplazados / ambos (ver CopyOpciones).
  const modoFantasmas = opciones?.fantasmas ?? 'ambos';
  const srcPid = String(sourcePlanId);

  const calib = calibrarCopiado(sourceData.scaleM, engine, alineacion);
  const { calibFactor, offX, offY, sinTransform } = calib;

  const sourceRamales: CopyElement[] = sourceData.ramales || [];
  const sourceBajantes: CopyElement[] = sourceData.bajantes || [];

  let totalCopied = 0;
  const skippedNets: string[] = [];
  const oldToNew: Record<string, string> = {};

  for (const sel of selections) {
    const { netId, tipos } = sel;
    if (tipos.size === 0) continue;

    const net = NETS.find((n) => n.id === netId);
    if (!net) {
      skippedNets.push(netId);
      continue;
    }
    const pfx = net.lbl;
    const bmPfx = net.bmPfx;
    // Prefijo de montante: para redes donde bmType === 'montante', usar net.bmPfx (MAF, MAC, etc.)
    // Para redes donde bmType === 'bajante' (saneamiento, ll), los montantes tienen su propio
    // prefijo 'M'+lbl
    const monPfx = net.bmType === 'montante' ? net.bmPfx || 'MON' : 'M' + (net.lbl || 'MON');

    const copyRamalTipos = new Set(['ramal', 'tributario'].filter((t) => tipos.has(t)));
    const copyBajanteTipos = new Set(['bajante', 'montante'].filter((t) => tipos.has(t)));
    const copyGlobalTipos = new Set(
      ['red_publica', 'contador', 'calentador'].filter((t) => tipos.has(t)),
    );

    // PUNTO 5: los Ldesvio de asociaciones jamás se convierten en ramales reales al copiar.
    const srcRamales = sourceRamales.filter(
      (r) => r.net === netId && copyRamalTipos.has(r.tipo) && !isLdesvioRamalId(r.id),
    );
    // Sin partición: TODOS los bajantes son fuente de ambas formas — el FANTASMA es el
    // MISMO bajante renderizado desplazado (definición usuario); el clon desplazado se
    // genera tras el push según el modo.
    const srcBajantes = sourceBajantes.filter(
      (b) => b.net === netId && copyBajanteTipos.has(b.tipo),
    );
    const srcGlobals = sourceBajantes.filter((b) => copyGlobalTipos.has(b.tipo) && b.net === netId);

    if (srcRamales.length === 0 && srcBajantes.length === 0 && srcGlobals.length === 0) continue;

    const srcAll = [...srcRamales, ...srcBajantes, ...srcGlobals];
    const knownIds = new Set(Object.keys(oldToNew));

    /* ── Los elementos del piso destino SE CONSERVAN (orig. usuario) ── */
    /* Antes se borraban los coincidentes (misma red+tipo) y los contadores reiniciaban en 1,
     * reseteando el piso actual. Ahora todo lo existente se mantiene y las copias toman la
     * numeración consecutivo siguiente de ESTE piso (los contadores de abajo ya siembran del
     * máximo existente); copiar dos veces el mismo origen duplica el dibujo — el usuario puede
     * borrar lo que sobra a mano. */

    /* ── Generar nuevos IDs ── */
    const { contadores, offsetFantasma } = renombrarElementos(
      engine,
      netId,
      pfx,
      bmPfx,
      monPfx,
      srcRamales,
      srcBajantes,
      srcGlobals,
      srcPid,
      oldToNew,
    );

    /* ── Reasignar referencias internas ── */
    remapearReferencias(srcAll, oldToNew, engine);
    limpiarCachesRender(srcAll);
    // Copia total (orig. usuario): geometría + estructura remapeada + TODOS los datos
    // hidráulicos (diámetros, materiales, accesorios, aparatos, fixtures) y los conteos
    // remapeados a los ids nuevos del piso destino.
    const selPairs = Object.keys(oldToNew)
      .filter((k) => !knownIds.has(k))
      .map((k) => ({ oldId: k, newId: oldToNew[k] }));
    remapearMergesYLibros(srcRamales, srcBajantes, srcGlobals, oldToNew);
    copyStoreKeys(selPairs, netId, srcPid, String(targetPlanId));
    limpiarPunterosEntrePisos(srcBajantes, srcGlobals, engine);

    // Normalización de calibración SOLO si hay algo que corregir: mismo escala y mismos
    // orígenes ⇒ geometría bit-exacta (posiciones idénticas ⇒ cotas idénticas en todos los
    // pisos). Con láminas desalineadas, el delta de orígenes traslada la copia al mismo
    // punto físico de la lámina destino.
    if (!sinTransform) {
      transformarGeometria(srcRamales, srcBajantes, calibFactor, offX, offY, engine);
    }
    // PUNTO 9 (copia): 'baja' sin piso debajo en el destino → 'continua'.
    for (const b of srcBajantes)
      b.direccion = direccionSegura(engine, b, b.direccion) ?? b.direccion;
    engine.ramales.push(...(srcRamales as unknown as PlanoRamal[]));
    engine.bajantes.push(
      ...(srcBajantes as unknown as PlanoBajante[]),
      ...(srcGlobals as unknown as PlanoBajante[]),
    );

    // Copias FANTASMA (definición usuario): el mismo bajante en su posición DESPLAZADA
    // (x+dx, y+dy del anillo) con direccion 'sube' — la versión dashed de la imagen. Se
    // generan tras el push (x/y ya transformadas por la alineación).
    const { phantoms, oldIdsConClon } = generarFantasmas({
      engine,
      netId,
      bmPfx,
      monPfx,
      modoFantasmas,
      oldToNew,
      offsetFantasma,
      calibFactor,
      contadores,
      srcRamales,
      srcBajantes,
      srcGlobals,
      selPairs,
      targetPlanId,
    });

    // PUNTO (orig. usuario): las COTAS NO se copian — al copiar bajantes con una cota cerca,
    // la cota viajaba también con la copia. Las cotas pertenecen a la anotación del plano
    // destino y se acotan allí manualmente.

    retirarGhostsResiduales(engine, modoFantasmas, oldToNew, oldIdsConClon, srcPid);

    engine._netCounts[netId] = engine._netCounts[netId] || { ramal: 0, tributario: 0 };
    if (contadores.ramal > engine._netCounts[netId].ramal) {
      engine._netCounts[netId].ramal = contadores.ramal;
    }

    // Conteo HONESTO: lo que queda en el destino tras los splice — en modo fantasmas solo
    // los clones (las bases se retiraron; antes se contaba srcAll completo siempre).
    if (modoFantasmas === 'fantasmas') totalCopied += phantoms.length;
    else totalCopied += srcAll.length + (modoFantasmas === 'ambos' ? phantoms.length : 0);
  }

  guardarYRefrescar(engine, targetPlanId);

  return { copied: totalCopied, skippedNets };
}
