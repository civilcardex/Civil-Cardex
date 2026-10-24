import { adoptarDiametroDelSuperior } from '../../utils/bajanteAssocShared.ts';
import type { InheritPoolBajante, InheritPoolRamal } from '../../utils/bajanteAssocShared.ts';
import { collectSourceAgg } from '../../utils/bajanteAssociation';
import { esRedAparatosPresion } from '../../utils/propagation';
import { ldesvioIdFor } from '../../utils/associateBajanteAcrossFloors';
import { TRAZOS_PREFIX } from '../../constants/storage-keys.ts';
import { loadFromStorage } from '../../services/storageService.ts';
import { syncMirrorKey } from '../fixturesStorage.ts';
import type { CountsMap, HidroDataMap } from '../fixturesStorage.ts';
import { bajanteDePisoEn } from '../../utils/bajanteLocal.ts';
import { pisoLbl } from '../../constants/helpers.ts';

/** Bajante del motor con lo que este pase lee/escribe (el enlace entre pisos). */
export interface MontanteLinkLike {
  id: string;
  net: string;
  tipo?: string;
  dNominal?: string;
  origenId?: string | null;
  recibeDeIds?: string[];
  alimentaIds?: string[];
  ucAplicado?: Record<string, Record<string, number>>;
  ucAcum?: number;
}

/**
 * Paridad con bajantes: un montante de presión del piso ABIERTO que es el ASOCIADO (inferior,
 * `origenId` apunta al de arriba) re-computa su libro heredado leyendo el storage del piso
 * superior. El bloque de espejos grande solo lo hace con el piso de arriba cargado; trabajando
 * abajo, un libro rancio no se refrescaba nunca y el panel lo seguía mostrando.
 * Escribe SOLO el montante del motor (el autosave persiste) — nunca el piso de arriba.
 * Ej: MAC1-P2 asociado a MAC1-P3 → su libro pasa a {lav:4.5} sin re-asociar.
 * @returns true si cambió algo (el llamador marca dirty).
 */
export function refreshMontanteBooksFromUpper(args: {
  bajantes: MontanteLinkLike[];
  loadedPid: string;
  loadedNpt: number | null;
  nptOf: (pid: string) => number | null;
  disk: CountsMap;
  hdisk: HidroDataMap;
}): boolean {
  const { bajantes, loadedPid, loadedNpt, nptOf, disk, hdisk } = args;
  let dirty = false;
  for (const baj of bajantes) {
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
      // Bajante REAL del piso superior (no su proyección en otros pisos, que comparte id y
      // arrastra un ucAplicado rancio — mismo criterio de bajanteLocal).
      const storedBaj = bajanteDePisoEn(srcRaw?.bajantes, upBajId, pisoLbl(nUp)) ?? null;
      if (adoptarDiametroDelSuperior(baj, storedBaj)) dirty = true;
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
      // Grupo vacío con el storage del superior PRESENTE = verdad (la fuente no tiene carga):
      // el libro del asociado se limpia TAMBIÉN — sin esto, un libro rancio de una era vieja
      // en el piso de abajo sobrevivía para siempre (el guard viejo solo protegía el caso
      // "storage ausente", no el "storage dice cero").
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
  return dirty;
}
