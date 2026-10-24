import { TRAZOS_PREFIX } from '../../constants/storage-keys.ts';
import {
  adoptarDiametroDelSuperior,
  type InheritPoolRamal,
} from '../../utils/bajanteAssocShared.ts';
import type { PaseEspejos } from './fixtureMirrorsTypes.ts';
import { propioDeClave, stableStringify, syncMirrorKey } from '../fixturesStorage.ts';
import { collectSourceAgg } from '../../utils/bajanteAssociation';
import { esRedAparatosPresion } from '../../utils/propagation';
import { ldesvioIdFor } from '../../utils/associateBajanteAcrossFloors';
import { loadFromStorage, saveToStorage, saveTrazosToDB } from '../../services/storageService.ts';
import { bajanteDePisoEn, bajanteLocalQueCumple } from '../../utils/bajanteLocal.ts';
import { pisoLbl } from '../../constants/helpers.ts';

/** Propagación EN VIVO de la herencia entre pisos (todos los `propNet`): la clave del
 *  Ldesvio y el LIBRO del bajante destino reciben el agregado del superior — la misma
 *  verdad que el apply (collectSourceAgg). Solo escribe el extremo SUPERIOR del enlace
 *  (guard por npt): el inferior nunca re-empuja hacia arriba (trinquete). La herencia
 *  viaja SOLO por libro + Ldesvio — nunca al disco de los ramales destino (doctrina
 *  libro-solo: escribirlo ahí la re-sumaba en cada pase, +1 aparato por cambio de piso). */
export function heredarEntrePisos(
  p: PaseEspejos,
  planPorId: Map<string, { nivel?: number | null }>,
  loadedPid: string,
  loadedNpt: number | null,
  nptOf: (pid: string) => number | null,
): void {
  const { eng, disk, hdisk, propioSnap, esDeEstePiso } = p;
  // MONTANTES entre pisos (orig. usuario): mismas asociaciones que bajantes — la propagación
  // viva cubre TODAS las redes con elementos asociables (el cuerpo filtra por baj.net).
  for (const propNet of ['san', 'll', 'af', 'ac', 'gas', 'vent']) {
    // Índice id→bajante del motor: el .find por cada enlace era O(bajantes) por enlace.
    const bajantePorId = new Map((eng.bajantes ?? []).map((b) => [b.id, b] as const));
    for (const baj of eng.bajantes) {
      if (baj.net !== propNet) continue;
      // Proyección de otro piso: no es titular del enlace (ver `esDeEstePiso`).
      if (!esDeEstePiso(baj)) continue;
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
          liveBaj: bajantePorId.get(upperBajId) ?? null,
          liveRamales: (eng.ramales ?? []) as unknown as InheritPoolRamal[],
          storedBaj: null,
          storedRamales: null,
          counts: disk,
          hidro: hdisk as unknown as Record<string, { accesorios?: Record<string, number> }>,
        });
        const liveAgg = srcAgg.agg;
        const liveHydro = srcAgg.hydroAgg;
        // Origen VACÍO: se distingue "la verdad es cero" (el usuario borró los aparatos del
        // superior — su clave propia existe en el disco, aunque sea {}) de "no hay verdad"
        // (claves nunca escritas o comidas por el GC). Solo el primero limpia el libro del
        // destino; el segundo conserva el guard viejo — escribir libro vacío restaba a 0 las
        // UDs heredadas del destino.
        const clavePropiaOrigen = `${propNet}_${upperBajId}_${loadedPid}`;
        const origenPresente = disk[clavePropiaOrigen] != null;
        if (Object.keys(liveAgg).length === 0 && !origenPresente) continue;
        const lk = `${propNet}_${ldesvioIdFor(upperBajId)}_${ldPlanId}`;
        if (syncMirrorKey(disk, lk, liveAgg, true)) p.dirty = true;
        const tgt = loadFromStorage<{
          bajantes?: Array<{
            id: string;
            pisoBase?: string;
            ucAcum?: number;
            dNominal?: string;
            recibeDeIds?: string[];
            alimentaIds?: string[];
            ucAplicado?: Record<string, Record<string, number>>;
            ucAplicadoHidro?: Record<string, Record<string, number>>;
          }>;
        } | null>(TRAZOS_PREFIX + ldPlanId, null);
        // El libro y los ramales destino son los del bajante DUEÑO de ese piso: con una
        // proyección primero, el `find` plano escribía el libro en la copia equivocada y el
        // real quedaba sin herencia → el pase siguiente la contaba como propia y la sumaba.
        const tgtNivel = planPorId.get(ldPlanId)?.nivel;
        const tgtLbl =
          typeof tgtNivel === 'number' && Number.isFinite(tgtNivel) ? pisoLbl(tgtNivel) : '';
        const tBaj = bajanteDePisoEn(tgt?.bajantes, lowerBajId, tgtLbl);
        const tgtRamalIds = [...(tBaj?.recibeDeIds || []), ...(tBaj?.alimentaIds || [])];
        const ownKey = `${propNet}_${lowerBajId}_${ldPlanId}`;
        const own = disk[ownKey] || {};
        const aplicadoHidroPrev = tBaj?.ucAplicadoHidro || {};
        const dNomSup = baj.dNominal;
        let tgtChanged = false;
        // La adopción de diámetro sobre tBaj SOLO detecta el cambio (tgtChanged): el
        // diámetro de verdad se estampa en el parche FRESCO de abajo (escribirlo aquí se
        // perdía con el snapshot — el doc persistido se re-lee del storage).
        if (tBaj && adoptarDiametroDelSuperior(tBaj, baj)) tgtChanged = true;
        const snapKey = `${ldPlanId}|${lowerBajId}`;
        const snapBaj = propioSnap[snapKey] || { uc: {}, hidro: {} };
        propioSnap[snapKey] = snapBaj;
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
          // FOTO de lo propio de la clave: el disco ya no recibe herencia, así que lo que
          // hay aquí ES lo propio del ramal. La desasociación la usa de SUELO al restar el
          // libro — sin ella, restar el grupo completo de un libro rancio borraba las
          // asignaciones manuales del usuario (cur=0).
          const cur = disk[tk] || {};
          if (stableStringify(snapBaj.uc[tk] || {}) !== stableStringify(cur)) {
            snapBaj.uc[tk] = { ...cur };
            p.snapDirty = true;
          }
          // La herencia viaja SOLO por el libro del bajante destino (y la clave del Ldesvio,
          // espejada abajo) — NUNCA al disco de cada ramal. Escribirla ahí la mezclaba con
          // lo propio del ramal (RL1 con lavamanos propio sumaba ×2) y, con la entrada del
          // libro perdida/rancia, el delta la re-sumaba en cada pase (orig. usuario: +1
          // lavamanos/inodoro/ducha por cambio de piso). El panel del asociado lee el
          // libro; la rejilla del ramal muestra SOLO lo propio (recepción bloqueada).
          ucAplicadoNuevo[tk] = { ...extra };
          if (liveHydro) {
            const prevH = aplicadoHidroPrev[tk] || {};
            const hcur = hdisk[tk] || { accesorios: {}, Lh: 0, nSalidas: 0 };
            const tieneEntradaH = Object.prototype.hasOwnProperty.call(aplicadoHidroPrev, tk);
            const propioH = propioDeClave(
              hcur.accesorios || {},
              prevH,
              snapBaj.hidro[tk],
              tieneEntradaH,
            );
            const acc: Record<string, number> = { ...propioH };
            for (const [k, v] of Object.entries(liveHydro)) acc[k] = (acc[k] || 0) + Number(v || 0);
            for (const k of Object.keys(acc)) if (!(acc[k] > 0)) delete acc[k];
            if (tBaj) {
              if (stableStringify(hcur.accesorios || {}) !== stableStringify(acc)) {
                hdisk[tk] = { ...hcur, accesorios: acc };
                p.hdirty = true;
              }
              if (stableStringify(snapBaj.hidro[tk] || {}) !== stableStringify(propioH)) {
                snapBaj.hidro[tk] = { ...propioH };
                p.snapDirty = true;
              }
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
            const baj = bajanteDePisoEn(tgtFresco.bajantes, lowerBajId, tgtLbl);
            if (baj) {
              // Diámetro adoptado del superior — AQUÍ (doc fresco), no en el snapshot: es el
              // único sitio que sobrevive al guardado (mismo parche que el libro).
              if (dNomSup && baj.dNominal !== dNomSup) baj.dNominal = dNomSup;
              baj.ucAplicado = { ...ucAplicadoNuevo };
              if (liveHydro || Object.keys(ucAplicadoHidroNuevo).length)
                baj.ucAplicadoHidro = { ...ucAplicadoHidroNuevo };
              baj.ucAcum = totalUc;
              // Enlace DENTRO del mismo piso cargado (empate de nivel): el autosave serializa
              // el MOTOR, así que el libro tiene que quedar también en su objeto vivo — si no,
              // el guardado siguiente restaura el libro viejo y el pase vuelve a sumar el
              // grupo (crecimiento por cambio de piso). Para el piso vecino no se toca nada:
              // su motor no está cargado y el doc es la verdad.
              if (ldPlanId === loadedPid) {
                const vivoTgt = bajanteLocalQueCumple(eng, (b) => b.id === lowerBajId);
                if (vivoTgt) {
                  if (dNomSup && vivoTgt.dNominal !== dNomSup) vivoTgt.dNominal = dNomSup;
                  vivoTgt.ucAplicado = { ...ucAplicadoNuevo };
                  if (liveHydro || Object.keys(ucAplicadoHidroNuevo).length)
                    vivoTgt.ucAplicadoHidro = { ...ucAplicadoHidroNuevo };
                  vivoTgt.ucAcum = totalUc;
                }
              }
              (tgtFresco as { ts?: number }).ts = Date.now();
              saveToStorage(TRAZOS_PREFIX + ldPlanId, tgtFresco);
              saveTrazosToDB(ldPlanId, tgtFresco);
              p.dirty = true;
            }
          }
        }
      }
    }
  }
}
