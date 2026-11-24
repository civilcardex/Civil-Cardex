/** Diagnóstico de carga: separa la escala de medidas del tamaño con que se pintó el PDF. */
import { loadFromStorage, saveToStorage } from '../services/storageService.ts';

/** Lo que pasó en una carga de piso (escala, decisión, lámina y cámara). */
interface ReporteCargaPlano {
  planId: string;
  ts: number;
  /** `scaleM` del doc cargado (m/px). */
  escalaDoc: number | null;
  /** Escala calibrada del piso (m/px). */
  escalaPlano: number | null;
  /** Escala global del proyecto (m/px). */
  escalaGlobal: number | null;
  /** `scaleM` de la copia LOCAL del doc (la que gana el arbitrage si su ts es mayor). */
  escalaLocal: number | null;
  /** `scaleM` de la copia de BD. */
  escalaBd: number | null;
  /** ts (milisegundos) de cada copia: el arbitro local-vs-BD gana el mayor. */
  tsLocal: number | null;
  tsBd: number | null;
  /** Decisión tomada con la escala. */
  accion: string;
  /** Factor aplicado al re-escalar la geometría (null si no hubo re-base). */
  factor: number | null;
  /** Escala con la que se rasterizó la lámina de fondo (m/px). */
  escalaRaster: number | null;
  /** Tamaño de la lámina en px (a escala 1). */
  pageW: number | null;
  pageH: number | null;
  /** Cámara del visor (zoom/offset). */
  zoom: number | null;
  offX: number | null;
  offY: number | null;
  /** Elementos dibujados en el piso. */
  elementos: number;
}

const PREFIJO_DIAG = 'diag_carga_';
const MAX_REPORTES = 20;

/** Evento que avisa de que la escala del piso cambió: la lámina de fondo tiene que volver a
 * rasterizarse con la escala nueva (si no, el fondo y el dibujo quedan en escalas distintas). */
export const EVENTO_ESCALA_CAMBIADA = 'civilflow_escala_cambiada';

/**
 * Registra (o completa) el reporte de la última carga de un piso.
 * El motor (lámina y cámara) y el cargador (decisión de escala) reportan por separado: si
 * llegan con menos de 15 s de diferencia se completan en el mismo registro.
 * @param planId - id del plano.
 * @param parcial - datos a registrar o completar.
 */
export function registraCarga(planId: string | number, parcial: Partial<ReporteCargaPlano>): void {
  const id = String(planId);
  const lista = leeReportes(id);
  const ahora = Date.now();
  const ultimo = lista[lista.length - 1];
  let registro: ReporteCargaPlano;
  if (ultimo && ahora - ultimo.ts < 15000) {
    registro = { ...ultimo, ...parcial, planId: id, ts: ahora };
    lista[lista.length - 1] = registro;
  } else {
    registro = {
      planId: id,
      ts: ahora,
      escalaDoc: null,
      escalaPlano: null,
      escalaGlobal: null,
      escalaLocal: null,
      escalaBd: null,
      tsLocal: null,
      tsBd: null,
      accion: 'nada',
      factor: null,
      escalaRaster: null,
      pageW: null,
      pageH: null,
      zoom: null,
      offX: null,
      offY: null,
      elementos: 0,
      ...parcial,
    };
    lista.push(registro);
  }
  saveToStorage(PREFIJO_DIAG + id, lista.slice(-MAX_REPORTES));
}

/** Reportes de carga de un piso (los últimos, el más nuevo al final). */
export function leeReportes(planId: string | number): ReporteCargaPlano[] {
  const lista = loadFromStorage<ReporteCargaPlano[] | null>(PREFIJO_DIAG + String(planId), null);
  return Array.isArray(lista) ? lista : [];
}
