/**
 * Opciones de diámetro del menú de BAJANTES/MONTANTES (extraído de diameterSelector para el
 * techo G1). Ej: MRCI1 con material 'PVC C900 RDE 18' en civilflow_mats -> lista 4"-12".
 */
import {
  DIAM_BAN,
  DIAM_BAN_LL,
  DIAM_BAN_SAN,
  DIAM_VENT,
  DIAM_BY_MAT,
  GAS_DN_LABELS,
} from '../constants';
import { loadFromStorage } from '../services/storageService.ts';
import { diamPulgFromLabel } from './diamInchesFromLabel.ts';
import { DIAMETROS_AF, DIAMETROS_AC } from '../constants/hydraulicsData.ts';

/** Opciones de diámetro. Montantes: MISMAS opciones que los ramales de SU red (ped. usuario)
 *  — la lista por material del catálogo de la red (DIAM_BY_MAT, gas vía GAS_DN_LABELS), no la
 *  lista comercial completa (el material activo es el PRIMERO de la red en civilflow_mats:
 *  PlanoBajante no tiene campo material — la rama `el.material` era código muerto). rci (Red
 *  Contra Incendio) usa el mismo mecanismo; sin material cae a A.C. SCH 40 (default REDES_MAT).
 *  El resto de elementos usa las listas de bajantes por red (vent/san/ll/común).
 *  Memo WeakMap POR ELEMENTO: el resultado depende solo de (tipo, net, mats en storage) —
 *  sin memo, cada render del menú re-parseaba civilflow_mats (patrón G8). Las claves
 *  estáticas (DIAM_VENT…) se devuelven directas sin memo. */
const memoOpciones = new WeakMap<object, Array<{ pulg: number; nom: string }>>();
export function opcionesDiametroElemento(el: {
  tipo?: string;
  net?: string;
}): Array<{ pulg: number; nom: string }> {
  const aLista = (noms: string[]) => noms.map((nom) => ({ pulg: diamPulgFromLabel(nom), nom }));
  if (
    el.tipo === 'montante' &&
    (el.net === 'gas' || el.net === 'af' || el.net === 'ac' || el.net === 'rci')
  ) {
    const hit = memoOpciones.get(el as object);
    if (hit) return hit;
    let out: Array<{ pulg: number; nom: string }>;
    if (el.net === 'gas') {
      out = aLista(GAS_DN_LABELS);
    } else {
      let matShort: string | undefined;
      try {
        const mats = loadFromStorage<Record<string, Array<{ val: string }>> | null>(
          'civilflow_mats',
          null,
        );
        matShort = mats?.[el.net]?.[0]?.val;
      } catch {
        /* sin storage: fallback abajo */
      }
      const porMat = matShort ? DIAM_BY_MAT[matShort] : undefined;
      if (porMat?.length) {
        out = aLista(porMat.map((d) => d.n));
      } else if (el.net === 'rci') {
        // Sin material en el PROP: el default de la red rci es A.C. SCH 40 (REDES_MAT) —
        // su lista comercial, no la de agua fría.
        out = aLista((DIAM_BY_MAT['A.C. SCH 40'] || []).map((d) => d.n));
      } else {
        out = (el.net === 'af' ? DIAMETROS_AF : DIAMETROS_AC).map((d) => ({
          pulg: d.pulg,
          nom: d.nominal,
        }));
      }
    }
    memoOpciones.set(el as object, out);
    return out;
  }
  if (el.net === 'vent') return DIAM_VENT;
  if (el.net === 'san') return DIAM_BAN_SAN;
  if (el.net === 'll') return DIAM_BAN_LL;
  return DIAM_BAN;
}
