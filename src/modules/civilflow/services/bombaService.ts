/** Servicio de la bomba sumergible AR (cf_bomba_datos_proyecto, 1:1 con el proyecto):
 *  carga y guardado vía RPC save_bomba_datos. Extraído de projectDataService (ronda
 *  monolitos 2026-11): el service central era el módulo más grande del repo mezclando
 *  core/gas/EP/bomba/RCI. Ej: loadBombaDatos('uuid') -> {salSim, hz, …} o null. */
import { supabase } from '../../../lib/supabase';
import { devError } from '../../../utils/devError.ts';
import { emitBdSaveError } from './storageService.ts';
import { CF_TABLES } from '../constants/tableNames.ts';

// ─── Bomba sumergible AR (bomba_datos_proyecto, 1:1 con el proyecto) ───────────────────
/** Fila bruta de la bomba en BD (snake_case del RPC/fila). */
export interface BombaDatosRow {
  sal_sim: string | null;
  ud_tot: string | null;
  hz: string | null;
  l_imp: string | null;
  d_imp: string | null;
  c_hw: string | null;
  p_desc: string | null;
  eta_b: string | null;
  f_srv: string | null;
  t_cic: string | null;
  h_min: string | null;
  h_max: string | null;
  b_cam: string | null;
  l_cam: string | null;
  npsh: string | null;
  tipo_tuberia: string | null;
  bombas: Record<string, Record<string, string>> | null;
}
/** Datos de la bomba en camelCase (lo que consume la página PumpAR). */
export interface BombaData {
  salSim: string;
  udTot: string;
  hz: string;
  lImp: string;
  dImp: string;
  cHW: string;
  pDesc: string;
  etaB: string;
  fSrv: string;
  tCic: string;
  hMin: string;
  hMax: string;
  bCam: string;
  lCam: string;
  npsh: string;
  tipoTuberia: string;
  bombas: Record<string, Record<string, string>>;
}

/** Columnas de la bomba ↔ BombaData: [columna snake_case, clave camelCase]. Una sola tabla
 *  genera el SELECT, el remap de carga y el payload del RPC — 17 columnas siempre alineadas. */
const CAMPOS_BOMBA: Array<[keyof BombaDatosRow, keyof BombaData]> = [
  ['sal_sim', 'salSim'],
  ['ud_tot', 'udTot'],
  ['hz', 'hz'],
  ['l_imp', 'lImp'],
  ['d_imp', 'dImp'],
  ['c_hw', 'cHW'],
  ['p_desc', 'pDesc'],
  ['eta_b', 'etaB'],
  ['f_srv', 'fSrv'],
  ['t_cic', 'tCic'],
  ['h_min', 'hMin'],
  ['h_max', 'hMax'],
  ['b_cam', 'bCam'],
  ['l_cam', 'lCam'],
  ['npsh', 'npsh'],
  ['tipo_tuberia', 'tipoTuberia'],
  ['bombas', 'bombas'],
];

/** Carga los datos de la bomba sumergible (bomba_datos_proyecto, 1:1 con el proyecto). Ej: loadBombaDatos('uuid') -> {salSim, …} o null si la fila no existe. */
export async function loadBombaDatos(proyectoId: string): Promise<BombaData | null> {
  try {
    const { data, error } = await supabase
      .from(CF_TABLES.bombaDatos)
      .select(CAMPOS_BOMBA.map(([col]) => col).join(', '))
      .eq('proyecto_id', proyectoId)
      .maybeSingle();
    if (error) {
      devError('bombaService load:', error.message);
      return null;
    }
    if (!data) return null;
    const row = data as unknown as BombaDatosRow;
    const salida: Record<string, unknown> = {};
    for (const [col, clave] of CAMPOS_BOMBA)
      salida[clave] = col === 'bombas' ? (row.bombas ?? {}) : (row[col] ?? '');
    return salida as unknown as BombaData;
  } catch (e) {
    devError('bombaService load exception:', e);
    return null;
  }
}

/** Guarda lo de la bomba sumergible en la BD (una fila por proyecto, vía RPC save_bomba_datos). */
export async function saveBombaDatos(proyectoId: string, b: BombaData): Promise<boolean> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      emitBdSaveError('sin-sesion', 'bombaService: sin sesión, respaldo no guardado.');
      return false;
    }
    const { error } = await supabase.rpc('save_bomba_datos', {
      p_proyecto_id: proyectoId,
      p_datos: Object.fromEntries(CAMPOS_BOMBA.map(([col, clave]) => [col, b[clave]])),
    });
    if (error) {
      emitBdSaveError('save-bomba', error.message);
      return false;
    }
    return true;
  } catch (e) {
    devError('bombaService save exception:', e);
    return false;
  }
}
