/** Servicio del Equipo de Presión (cf_ep_datos_proyecto, 1:1 con el proyecto): carga con
 *  extra incluida y guardado vía RPC save_ep_datos. Extraído de projectDataService (ronda
 *  monolitos 2026-11). Ej: loadEpDatos('uuid') -> {qac, pmin, modo, extra…} o null. */
import { supabase } from '../../../lib/supabase';
import { devError } from '../../../utils/devError.ts';
import { CF_TABLES } from '../constants/tableNames.ts';
import { emitBdSaveError } from './storageService.ts';
import { EP_DEFAULTS, type EPData } from '../components/ep/EPShared';

// ─── Equipo de Presión (ep_datos_proyecto, 1:1 con el proyecto) ────────────────────────
/** Fila bruta de ep en BD (snake_case; modo 'red'|'cisterna'). */
export interface EpDatosRow {
  qac: string | null;
  qasc: string | null;
  hfac: string | null;
  hfacs: string | null;
  hfotros: string | null;
  pred: string | null;
  pmin: string | null;
  pmax: string | null;
  zbomba: string | null;
  ztop: string | null;
  zcis: string | null;
  hfcis: string | null;
  nt: string | null;
  nr: string | null;
  etab: string | null;
  etam: string | null;
  fs: string | null;
  ciclos: string | null;
  alfa: string | null;
  vsuc: string | null;
  vimp: string | null;
  dnsuc: string | null;
  dnimp: string | null;
  pcomercial: string | null;
  modo: 'red' | 'cisterna' | null;
  dot_l: string | null;
  n_usuarios: string | null;
  dias_aut: string | null;
  bci_l: string | null;
  patm: string | null;
  pv: string | null;
  npshr: string | null;
  /** Bloque extra del formulario (control variador, entorno, aparato, material, fuente). */
  extra: Record<string, string> | null;
}

/** Claves extra que viven en la columna jsonb extra (sin columna propia por campo). */
export const EP_EXTRA_KEYS = [
  'margen',
  'dif',
  'qminp',
  'altitud',
  'temp',
  'poffmax',
  'apsel',
  'apcrit',
  'mat',
  'hfauto',
  'potSel',
  'usos',
  'cisHu',
  'cisHs',
  'cisBl',
  'cisQa',
  'cisHsum',
  'cisDc',
] as const;

/** Campos del estado EP ↔ columnas de la fila en BD: [columna snake_case, clave EPData].
 *  Una sola tabla genera el SELECT, el remap de carga y el payload de guardado — así ninguna
 *  de las 31 columnas queda desalineada. Las claves extra van aparte, en el jsonb extra. */
const CAMPOS_EP: Array<[keyof EpDatosRow, keyof EPData]> = [
  ['qac', 'qac'],
  ['qasc', 'qasc'],
  ['hfac', 'hfac'],
  ['hfacs', 'hfacs'],
  ['hfotros', 'hfotros'],
  ['pred', 'pred'],
  ['pmin', 'pmin'],
  ['pmax', 'pmax'],
  ['zbomba', 'zbomba'],
  ['ztop', 'ztop'],
  ['zcis', 'zcis'],
  ['hfcis', 'hfcis'],
  ['nt', 'nt'],
  ['nr', 'nr'],
  ['etab', 'etab'],
  ['etam', 'etam'],
  ['fs', 'fs'],
  ['ciclos', 'ciclos'],
  ['alfa', 'alfa'],
  ['vsuc', 'vsuc'],
  ['vimp', 'vimp'],
  ['dnsuc', 'dnsuc'],
  ['dnimp', 'dnimp'],
  ['pcomercial', 'pcomercial'],
  ['modo', 'modo'],
  ['dot_l', 'dotL'],
  ['n_usuarios', 'nUsuarios'],
  ['dias_aut', 'diasAut'],
  ['bci_l', 'bciL'],
  ['patm', 'patm'],
  ['pv', 'pv'],
  ['npshr', 'npshr'],
];

/** Remap de fila BD → estado EP: modo red/cisterna se normaliza, el resto es string o ''. */
function epRowToData(row: EpDatosRow): EPData {
  const salida: Record<string, unknown> = {};
  for (const [col, clave] of CAMPOS_EP)
    salida[clave] =
      col === 'modo' ? (row.modo === 'cisterna' ? 'cisterna' : 'red') : (row[col] ?? '');
  return salida as unknown as EPData;
}

/** Carga los datos del equipo de presión (ep_datos_proyecto, 1:1 con el proyecto). Ej: loadEpDatos('uuid') -> {qac, pmin, …} o null si la fila no existe. */
export async function loadEpDatos(proyectoId: string): Promise<EPData | null> {
  try {
    const { data, error } = await supabase
      .from(CF_TABLES.epDatos)
      .select(CAMPOS_EP.map(([col]) => col).join(', ') + ', extra')
      .eq('proyecto_id', proyectoId)
      .maybeSingle();
    if (error) {
      devError('epService load:', error.message);
      return null;
    }
    if (!data) return null;
    const row = data as unknown as EpDatosRow;
    /* Fila de proyecto anterior a la columna jsonb: las claves EPC ausentes/vacías se rellenan
     * con su default. Mandarlas como '' pisaba la banda de control (dif) y el tanque quedaba
     * sin calcular al recargar. Ej: extra sin dif -> dif '5'. */
    const extraGuardado = Object.fromEntries(
      EP_EXTRA_KEYS.map((k) => [k, row.extra?.[k] || EP_DEFAULTS[k]]),
    ) as Record<(typeof EP_EXTRA_KEYS)[number], string>;
    /* Bloque extra: el loader ya rellenó con EP_DEFAULTS las claves ausentes/vacías. */
    return { ...epRowToData(row), ...extraGuardado };
  } catch (e) {
    devError('epService load exception:', e);
    return null;
  }
}

/** Guarda lo del equipo a presión en la BD (una fila por proyecto, sin tocar lo demás). Lanza si falla: si no, el informe PDF generado desde la BD salía con los valores viejos. Ej: ep (Equipo de Presion) con caché viva en localStorage. */
export async function saveEpDatos(proyectoId: string, ep: EPData): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    emitBdSaveError('sin-sesion', 'epService: sin sesión, EP no guardado.');
    return;
  }
  const { error } = await supabase.rpc('save_ep_datos', {
    p_proyecto_id: proyectoId,
    p_datos: {
      ...Object.fromEntries(CAMPOS_EP.map(([col, clave]) => [col, ep[clave]])),
      extra: Object.fromEntries(EP_EXTRA_KEYS.map((k) => [k, ep[k]])),
    },
  });
  if (error) throw new Error(error.message);
}
