/** Decisiones de ESCALA del piso al cargar el visor + registro de diagnóstico.
 *
 * Motivo (orig. usuario): al reingresar al visor, los elementos aparecían desplazados y las
 * cotas en metros leían menos. La escala del dibujo vive en el doc del piso (`scaleM`, metros
 * por píxel de plano) y hay tres rutas que la tocaban sin dar cuenta: el cambio de piso, el
 * re-base a la escala global del proyecto y la calibración. Aquí vive la decisión PURA de qué
 * escala manda (testeable sin motor) y el registro de lo que pasó en cada carga.
 *
 * Ej: piso calibrado a 0.669 m/px cuyo doc quedó con `scaleM` 0.5 → la decisión es
 * "reparar etiqueta" (los píxeles están bien, la etiqueta mal): las cotas vuelven a leer bien
 * sin mover un solo trazo.
 */
import { loadFromStorage, saveToStorage } from '../services/almacenamientoServicio.ts';
import type { PlanMeta } from './planosMeta.ts';

/** Escalas del set estándar de planos (metros por píxel): 1:200, 1:133, 1:100, 1:80, 1:50. */
export const ESCALAS_ESTANDAR = [0.5, 0.75, 1, 1.25, 2];

/** Tolerancia de redondeo: por debajo de ella la diferencia entre dos escalas es ruido del
 * meta (0.4723 redondeado a 0.47 = 0.49 %) y no justifica mover la geometría. */
export const TOLERANCIA_ESCALA = 0.006;

/** ¿La escala es una del set estándar? Solo el "pisado" de escala escribe valores así. */
export function esEscalaEstandar(escala: number | null | undefined): boolean {
  if (escala == null || !Number.isFinite(escala)) return false;
  return ESCALAS_ESTANDAR.some((e) => Math.abs(escala - e) < 1e-9);
}

/**
 * ¿El cambio de piso debe aplicar la escala por defecto del plano (`plano.scale/100`)?
 * NO si el piso ya tiene un doc con escala propia o con contenido: ahí la escala del doc es
 * la verdad (el piso dibujado manda sobre el valor por defecto del plano).
 * @param escalaDoc - escala (m/px) del doc guardado del piso; null si no hay doc.
 * @param tieneContenido - el motor tiene elementos cargados de este piso.
 * @param escalaPlan - escala por defecto del plano (`plano.scale/100`).
 */
export function decideEscalaPorDefectoDelPlan(args: {
  escalaDoc: number | null;
  tieneContenido: boolean;
  escalaPlan: number | null;
}): boolean {
  if (args.escalaPlan == null || !Number.isFinite(args.escalaPlan)) return false;
  if (args.tieneContenido) return false;
  if (args.escalaDoc != null && Number.isFinite(args.escalaDoc)) return false;
  return true;
}

/** Qué hacer con la escala del doc frente a la escala calibrada del piso. */
export type DecisionEscalaDoc =
  /** El doc y la calibración coinciden (o no hay calibración): no se toca nada. */
  | { accion: 'nada' }
  /** La diferencia es redondeo del meta: el doc (exacto) corrige al meta, la geometría no se mueve. */
  | { accion: 'autoheal'; escala: number }
  /** El doc tiene una escala del set estándar que no es la calibrada: la etiqueta quedó pisada
   *  y los píxeles están bien → se restaura la etiqueta SIN tocar la geometría. */
  | { accion: 'reparar-etiqueta'; escala: number }
  /** El doc está en otra escala real: hay que re-escalar la geometría (factor = doc/calibrada). */
  | { accion: 'rebase'; escala: number; factor: number };

/**
 * Decide qué hacer con la escala de un doc frente a la escala calibrada de SU piso.
 * @param escalaDoc - `scaleM` del doc cargado (metros por píxel); null si no hay.
 * @param escalaPlano - escala calibrada del piso (m/px); null si el piso no está calibrado.
 * @param tolerancia - margen de redondeo aceptable (0.006 = 0.6 %).
 */
export function decideEscalaDelDoc(args: {
  escalaDoc: number | null;
  escalaPlano: number | null;
  tolerancia?: number;
}): DecisionEscalaDoc {
  const tol = args.tolerancia ?? TOLERANCIA_ESCALA;
  const doc = args.escalaDoc;
  const plano = args.escalaPlano;
  if (doc == null || !Number.isFinite(doc) || doc <= 0) return { accion: 'nada' };
  if (plano == null || !Number.isFinite(plano) || plano <= 0) return { accion: 'nada' };
  if (Math.abs(doc - plano) <= 1e-9) return { accion: 'nada' };
  if (Math.abs(doc - plano) / plano <= tol) return { accion: 'autoheal', escala: doc };
  // Una escala del set estándar solo la escribe el "pisado" (el doc pasó a 0.5/1/... sin que
  // los píxeles cambien) → la etiqueta es lo que está mal, la geometría está bien.
  if (esEscalaEstandar(doc)) return { accion: 'reparar-etiqueta', escala: plano };
  return { accion: 'rebase', escala: plano, factor: doc / plano };
}

/**
 * Corrige el meta de calibraciones con la escala exacta del doc (el meta guarda el valor en
 * porcentaje y a veces venía redondeado: 0.4723 → 47 → 0.47).
 * @param meta - entradas de `plans_meta`.
 * @param planId - id del plano corregido.
 * @param escala - escala exacta en m/px.
 * @param sincronizarGlobal - además corrige el portador de la calibración global (calGlobal).
 * @returns el meta corregido y si hubo cambio.
 */
export function corrigeEscalaMeta(
  meta: PlanMeta[],
  planId: string | number,
  escala: number,
  sincronizarGlobal = false,
): { meta: PlanMeta[]; cambio: boolean } {
  const out = meta.map((m) => ({ ...m }));
  let cambio = false;
  const propio = out.find((m) => String(m.id) === String(planId));
  if (propio && typeof propio.scale === 'number' && Math.abs(propio.scale / 100 - escala) > 1e-9) {
    propio.scale = escala * 100;
    cambio = true;
  }
  if (sincronizarGlobal) {
    const portador = out.find(
      (m) => m.calGlobal === true && m.origen && typeof m.scale === 'number',
    );
    if (portador && Math.abs(portador.scale / 100 - escala) > 1e-9) {
      portador.scale = escala * 100;
      cambio = true;
    }
  }
  return { meta: out, cambio };
}

/** Lo que pasó en una carga de piso (escala, decisión, lámina y cámara). */
export interface ReporteCargaPlano {
  planId: string;
  ts: number;
  /** `scaleM` del doc cargado (m/px). */
  escalaDoc: number | null;
  /** Escala calibrada del piso (m/px). */
  escalaPlano: number | null;
  /** Escala global del proyecto (m/px). */
  escalaGlobal: number | null;
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

/** Último reporte de carga de un piso (null si nunca se cargó). */
export function ultimoReporte(planId: string | number): ReporteCargaPlano | null {
  const lista = leeReportes(planId);
  return lista.length ? lista[lista.length - 1] : null;
}

/** Texto plano del reporte (para el portapapeles): una línea por dato. */
export function textoReporte(planId: string | number): string {
  const r = ultimoReporte(planId);
  if (!r) return `[CF-CARGA] sin registro para el piso ${planId}`;
  const lineas = [
    `[CF-CARGA] piso ${r.planId}`,
    `escalaDoc=${r.escalaDoc} escalaPlano=${r.escalaPlano} escalaGlobal=${r.escalaGlobal}`,
    `accion=${r.accion} factor=${r.factor}`,
    `escalaRaster=${r.escalaRaster} lamina=${r.pageW}x${r.pageH}`,
    `camara zoom=${r.zoom} off=${r.offX},${r.offY} elementos=${r.elementos}`,
    `ts=${new Date(r.ts).toISOString()}`,
  ];
  return lineas.join('\n');
}
