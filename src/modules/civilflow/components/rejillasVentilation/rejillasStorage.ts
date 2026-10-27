// Estado persistente del tab Rejillas: overrides por sector (lo editable sobre el dibujo)
// y tipo de gas del proyecto. La purga de kwById (deprecado) corre al cargar.
import { loadFromStorage, saveToStorage } from '../../services/storageService.ts';
import { APARATOS_BY_TRAMO_KEY } from '../../constants/storage-keys.ts';

const OVERRIDES_KEY = 'rejillas_overrides_v1';
/** Clave de storage del tipo de gas del proyecto para Rejillas de ventilación ('natural' |
 *  'glp'): la comparte rejillasGasodSync, que la sube al blob de BD (Base de Datos) en cada sync. */
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
/** Overrides (ajustes manuales) por sector dibujado, clave = id del área en el plano.
 *  Ej: ovr['ar_12'].altoM = 2.6 sube la altura libre de ese sector. */
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

/** Lee los overrides de Rejillas de ventilación del storage y purga el kwById deprecado
 *  en el mismo paso (guardando la limpieza: sin ella, cada sync re-enviaría el dato viejo a BD). */
export const loadOverrides = (): OverridesMap => {
  const ovr = loadFromStorage<OverridesMap>(OVERRIDES_KEY, {});
  // Purga kwById al cargar Y persiste: sin guardar, el push de rejillasGasodSync (lee el
  // disco tal cual) re-enviaría el dato deprecado al blob BD en cada sync.
  if (purgarKwById(ovr)) saveOverrides(ovr);
  return ovr;
};
/** Guarda los overrides por sector en el storage local (a BD se sincronizan aparte, vía
 *  rejillasGasodSync). */
export const saveOverrides = (o: OverridesMap) => saveToStorage(OVERRIDES_KEY, o);

/** Claves gas_AR… del mapa de aparatos con contenido (gasodomésticos por sector/área).
 *  Solo áreas: las de ramal ya las persiste saveToSupabase y duplicarlas resucitaba
 *  conteos borrados al hidratar desde BD. */
export function leerGasod(): Record<string, Record<string, number>> {
  const disk = loadFromStorage<Record<string, Record<string, number>>>(APARATOS_BY_TRAMO_KEY, {});
  const out: Record<string, Record<string, number>> = {};
  for (const [k, v] of Object.entries(disk)) {
    if (/^gas_AR/.test(k) && v && Object.keys(v).length) out[k] = v;
  }
  return out;
}
