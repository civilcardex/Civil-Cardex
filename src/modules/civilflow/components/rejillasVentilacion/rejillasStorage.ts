// Estado persistente del tab Rejillas: overrides por sector (lo editable sobre el dibujo)
// y tipo de gas del proyecto. La purga de kwById (deprecado) corre al cargar.
import { loadFromStorage, saveToStorage } from '../../services/storageService';

const OVERRIDES_KEY = 'rejillas_overrides_v1';
export const GAS_KEY = 'rejillas_gas';
/** Override editable por sector (lo que no viene del dibujo ni del catálogo). */
export interface RejOverride {
  sector?: string;
  apto?: string;
  piso?: string;
  mono?: boolean;
  altoM?: number;
  sol?: string;
  vadj?: number;
  padj?: number;
  aconec?: number;
  /** Deprecado: kw ahora viene del catálogo (queda solo por dato viejo en disco; se ignora). */
  kwById?: Record<string, number>;
  tipoById?: Record<string, 'A' | 'B' | 'C'>;
  slotsExtra?: number;
}
export type OverridesMap = Record<string, RejOverride>;

/** Purga progresiva de kwById en un mapa de overrides (dato viejo en disco; se ignora):
 *  borra la clave de cada override que la traiga con entradas. true = purgó algo. */
export function purgarKwById(ovr: OverridesMap): boolean {
  let cambio = false;
  for (const ov of Object.values(ovr)) {
    if (ov && typeof ov === 'object' && ov.kwById && Object.keys(ov.kwById).length) {
      delete ov.kwById;
      cambio = true;
    }
  }
  return cambio;
}

export const loadOverrides = (): OverridesMap => {
  const ovr = loadFromStorage<OverridesMap>(OVERRIDES_KEY, {});
  // Purga kwById al cargar Y persiste: sin guardar, el push de rejillasGasodSync (lee el
  // disco tal cual) re-enviaría el dato deprecado al blob BD en cada sync.
  if (purgarKwById(ovr)) saveOverrides(ovr);
  return ovr;
};
export const saveOverrides = (o: OverridesMap) => saveToStorage(OVERRIDES_KEY, o);
