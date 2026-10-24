import { supabase } from '../../../lib/supabase';
import { emitBdSaveError } from './storageService.ts';
import { devError } from '../../../utils/devError.ts';
import { CF_TABLES } from '../constants/tableNames.ts';
import type { Piso } from '../lib/shared/projectTypes.ts';
import type { Proyecto, MaterialItem, ProfItem, CritItem } from '../context/ProjectContext.tsx';
import type { PlanMeta } from '../lib/shared/projectTypes.ts';
import type { GasDatosGenerales } from '../utils/gasRows.ts';

export type { GasDatosGenerales } from '../utils/gasRows.ts';

interface ProyectoCoreData {
  pisos: Piso[];
  proy: Proyecto;
  mats: Record<string, MaterialItem[]>;
  profs: ProfItem[];
  crits: CritItem[];
}

interface ProyectoDataRow extends Partial<ProyectoCoreData> {
  plans_meta?: PlanMeta[];
  redesActivas?: string[];
}

// Formas de fila devueltas por el RPC get_proyecto_data(proyecto_id) — lee en una sola
// ida y vuelta proyecto_general + pisos + materiales + profundidades + criterios + planos
// meta, en lugar de 6 consultas secuenciales separadas. Ver
// supabase/migrations/20260730000001_civilflow_schema.sql.
interface ProyectoGeneralRow {
  nombre?: string;
  dir?: string;
  ciudad?: string;
  pais?: string;
  uso?: string;
  empresa?: string;
  p_red?: string;
  dot?: string;
  mat_af?: string;
  mat_ac?: string;
  mat_rci?: string;
  mat_san?: string;
  mat_ll?: string;
  mat_ven?: string;
  mat_gas?: string;
  altitud?: string;
  p_atm?: string;
  pobl_fija?: number;
  pobl_flot?: number;
  area_piscina?: number;
  area_verdes?: number;
  c_escorrentia?: number;
  pendiente_san?: number;
  redes_activas?: string[] | null;
  af_alimentacion?: string | null;
  tanque_npt?: string | null;
}
interface PisoRow {
  id: number;
  n: number;
  npt: number | null;
  ok: boolean;
  tipo: string;
  h: number | null;
}
interface ProfundidadRow {
  client_id: string;
  red: string;
  col?: string;
  prof?: number;
  norma?: string;
  nota?: string;
}
interface CriterioRow {
  client_id: string;
  red: string;
  param?: string;
  val?: string;
  uni?: string;
  norma?: string;
  art?: string;
  cumple?: string;
  nota?: string;
}
interface PlanoMetaRow {
  id: number;
  name: string;
  nivel: number | null;
  scale: number;
  status: string;
  origen_x_px?: number | null;
  origen_y_px?: number | null;
  factor_x?: number | null;
  factor_y?: number | null;
  cal_global?: boolean | null;
  defined_scale?: number | null;
}
interface GetProyectoDataResult {
  proyecto_general: ProyectoGeneralRow | null;
  pisos: PisoRow[];
  materiales: Record<string, MaterialItem[]>;
  profundidades: ProfundidadRow[];
  criterios: CriterioRow[];
  planos_meta: PlanoMetaRow[];
}

function proyectoGeneralRowToProy(row: ProyectoGeneralRow): Partial<Proyecto> {
  return {
    nombre: row.nombre,
    dir: row.dir,
    ciudad: row.ciudad,
    pais: row.pais,
    uso: row.uso,
    empresa: row.empresa,
    p_red: row.p_red,
    dot: row.dot,
    mat_af: row.mat_af,
    mat_ac: row.mat_ac,
    mat_rci: row.mat_rci,
    mat_san: row.mat_san,
    mat_ll: row.mat_ll,
    mat_ven: row.mat_ven,
    mat_gas: row.mat_gas,
    altitud: row.altitud,
    p_atm: row.p_atm,
    poblFija: row.pobl_fija,
    poblFlot: row.pobl_flot,
    areaPiscina: row.area_piscina,
    areaVerdes: row.area_verdes,
    C_escorrentia: row.c_escorrentia,
    pendienteSan: row.pendiente_san,
  };
}

function proyToProyectoGeneralRow(proy: Proyecto) {
  return {
    nombre: proy.nombre,
    dir: proy.dir,
    ciudad: proy.ciudad,
    pais: proy.pais,
    uso: proy.uso,
    empresa: proy.empresa,
    p_red: proy.p_red,
    dot: proy.dot,
    mat_af: proy.mat_af,
    mat_ac: proy.mat_ac,
    mat_rci: proy.mat_rci,
    mat_san: proy.mat_san,
    mat_ll: proy.mat_ll,
    mat_ven: proy.mat_ven,
    mat_gas: proy.mat_gas,
    altitud: proy.altitud,
    p_atm: proy.p_atm,
    pobl_fija: proy.poblFija,
    pobl_flot: proy.poblFlot,
    area_piscina: proy.areaPiscina,
    area_verdes: proy.areaVerdes,
    c_escorrentia: proy.C_escorrentia,
    pendiente_san: proy.pendienteSan,
  };
}

function planoMetaRowToPlanMeta(row: PlanoMetaRow): PlanMeta {
  return {
    id: row.id,
    name: row.name,
    nivel: row.nivel,
    scale: row.scale,
    status: row.status,
    origen:
      row.origen_x_px != null && row.origen_y_px != null
        ? { x_px: row.origen_x_px, y_px: row.origen_y_px }
        : null,
    factorX: row.factor_x ?? null,
    factorY: row.factor_y ?? null,
    calGlobal: row.cal_global ?? null,
    definedScale: row.defined_scale ?? null,
  };
}

/**
 * Reemplaza las filas de pisos/proyecto_general/materiales/profundidades/criterios de un
 * proyecto con el snapshot dado, vía RPC seguro en la BD (borra e inserta por tabla en una
 * transacción atómica). Ver supabase/migrations/20260813000002_rls_security_definer_writes.sql.
 */
/**
 * Esqueleto común de los guardados RPC: exige sesión (emite 'sin-sesion' si no hay), corre
 * la escritura, emite el error etiquetado y convierte la excepción en false.
 * Ej: conSesion('save-gas', () => supabase.rpc('save_gas_datos', {...})) → true solo si la
 * RPC volvió sin error.
 * @param etiqueta etiqueta corta para el canal de alertas (ej. 'save-core').
 * @param fn la escritura; se ejecuta solo con sesión activa.
 * @returns true si la RPC terminó sin error; false sin sesión, con error o con excepción.
 */
async function conSesion(
  etiqueta: string,
  // PromiseLike: el builder de Postgrest es thenable pero no Promise nativa.
  fn: () => PromiseLike<{ error: { message: string } | null }>,
): Promise<boolean> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      emitBdSaveError('sin-sesion', 'proyectoDataService: sin sesión, respaldo no guardado.');
      return false;
    }
    const { error } = await fn();
    if (error) {
      emitBdSaveError(etiqueta, error.message);
      return false;
    }
    return true;
  } catch (e) {
    devError(`proyectoDataService ${etiqueta} exception:`, e);
    return false;
  }
}

export async function saveProyectoCoreData(
  proyectoId: string,
  core: ProyectoCoreData,
): Promise<boolean> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      emitBdSaveError('sin-sesion', 'proyectoDataService: sin sesión, respaldo no guardado.');
      return false;
    }

    const { error } = await supabase.rpc('save_proyecto_core', {
      p_proyecto_id: proyectoId,
      p_data: {
        proyecto_general: proyToProyectoGeneralRow(core.proy),
        pisos: core.pisos.map((p) => ({
          n: p.n,
          npt: typeof p.npt === 'number' ? p.npt : Number(p.npt) || null,
          ok: p.ok,
          tipo: p.tipo,
          h: p.h ? Number(p.h) : null,
        })),
        mats: Object.fromEntries(
          Object.entries(core.mats).map(([categoria, items]) => [
            categoria,
            items.map((item) => ({ id: item.id, val: item.val })),
          ]),
        ),
        profs: core.profs.map((p, i) => ({
          client_id: p.id,
          red: p.red,
          col: p.col,
          prof: p.prof,
          norma: p.norma,
          nota: p.nota,
          orden: i,
        })),
        crits: core.crits.map((c, i) => ({
          client_id: c.id,
          red: c.red,
          param: c.param,
          val: c.val,
          uni: c.uni,
          norma: c.norma,
          art: c.art,
          cumple: c.cumple,
          nota: c.nota,
          orden: i,
        })),
      },
    });
    if (error) {
      emitBdSaveError('save-core', error.message);
      return false;
    }
    return true;
  } catch (e) {
    devError('proyectoDataService saveCore exception:', e);
    return false;
  }
}

/**
 * Actualiza solo la columna `redes_activas` del proyecto vía RPC seguro — no toca el resto
 * de los datos del proyecto. Lo usa el toggle "Redes activas"/"Equipos activos", que es
 * independiente del guardado principal del proyecto.
 */
export async function saveRedesActivas(proyectoId: string, redes: string[]): Promise<boolean> {
  return conSesion('save-redes', () =>
    supabase.rpc('save_redes_activas', {
      p_proyecto_id: proyectoId,
      p_redes: redes,
    }),
  );
}

/**
 * Carga los datos generales de diseño de gas (gas_datos_proyecto, 1:1 con el proyecto).
 * Devuelve null cuando la fila no existe aún — el llamador decide si usar defaults.
 */
export async function loadGasDatos(proyectoId: string): Promise<GasDatosGenerales | null> {
  try {
    const { data, error } = await supabase
      .from(CF_TABLES.gasDatos)
      .select('altitud, presion_atm, temperatura, presion_min, densidad_relativa')
      .eq('proyecto_id', proyectoId)
      .maybeSingle();
    if (error) {
      devError('proyectoDataService loadGasDatos:', error.message);
      return null;
    }
    if (!data) return null;
    return {
      alt: data.altitud,
      patm: data.presion_atm,
      temp: data.temperatura,
      pmin: data.presion_min,
      densRel: data.densidad_relativa,
    };
  } catch (e) {
    devError('proyectoDataService loadGasDatos exception:', e);
    return null;
  }
}

/**
 * Upsert parcial de gas_datos_proyecto vía RPC SECURITY DEFINER — igual que
 * saveRedesActivas, no toca otras tablas. Lo usa GasDesign (debounced) como fuente de
 * verdad; localStorage queda como caché en vivo.
 */
export async function saveGasDatos(proyectoId: string, datos: GasDatosGenerales): Promise<boolean> {
  return conSesion('save-gas', () =>
    supabase.rpc('save_gas_datos', {
      p_proyecto_id: proyectoId,
      p_datos: {
        altitud: datos.alt,
        presion_atm: datos.patm,
        temperatura: datos.temp,
        presion_min: datos.pmin,
        densidad_relativa: datos.densRel,
      },
    }),
  );
}

/**
 * Reemplaza las filas `planos` de un proyecto (solo metadatos — los binarios PDF van por
 * pdfStorageService) vía RPC SECURITY DEFINER.
 */
export async function saveProyectoPlansMeta(
  proyectoId: string,
  plansMeta: PlanMeta[],
): Promise<boolean> {
  return conSesion('save-planos-meta', () =>
    supabase.rpc('save_planos_meta', {
      p_proyecto_id: proyectoId,
      p_planos: plansMeta.map((p) => ({
        id: p.id,
        name: p.name,
        nivel: p.nivel,
        scale: p.scale,
        status: p.status,
        origen_x_px: p.origen?.x_px ?? null,
        origen_y_px: p.origen?.y_px ?? null,
        factor_x: p.factorX ?? null,
        factor_y: p.factorY ?? null,
        cal_global: p.calGlobal ?? null,
        defined_scale: p.definedScale ?? null,
      })),
    }),
  );
}

/**
 * Carga el dataset core completo de un proyecto en una sola ida y vuelta vía el
 * RPC get_proyecto_data (proyecto_general + pisos + materiales + profundidades +
 * criterios + metadatos de planos), en lugar de 6 selects secuenciales a tablas.
 */
export async function loadProyectoData(proyectoId: string): Promise<ProyectoDataRow | null> {
  const { data } = await loadProyectoDataConError(proyectoId);
  return data;
}

/**
 * Igual que loadProyectoData, pero DISTINGUE "el proyecto no tiene datos" de "la carga
 * falló" (sin red, RLS, suscripción vencida).
 *
 * Por qué: con un único `null` el flujo de apertura de proyecto no podía saber si abrir
 * un proyecto vacío (legítimo: recién creado) o si la carga falló (ilegítimo: el
 * proyecto está en la nube y el workarea abriría VACÍO, y el usuario redibujaría encima).
 *
 * @param proyectoId id del proyecto.
 * @returns los datos (o null si no hay) y el mensaje de error (o null si no hubo).
 */
export async function loadProyectoDataConError(
  proyectoId: string,
): Promise<{ data: ProyectoDataRow | null; error: string | null }> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return { data: null, error: 'sin-sesion' };

    const { data, error } = await supabase.rpc('get_proyecto_data', { p_proyecto_id: proyectoId });

    if (error) {
      devError('proyectoDataService load:', error.message);
      return { data: null, error: error.message };
    }
    if (!data) return { data: null, error: null };

    const result = data as GetProyectoDataResult;
    return {
      data: {
        pisos: (result.pisos ?? []).map((p) => ({
          id: p.id,
          n: p.n,
          npt: p.npt ?? '',
          ok: p.ok,
          tipo: p.tipo,
          h: p.h != null ? String(p.h) : '',
        })),
        proy: result.proyecto_general
          ? (proyectoGeneralRowToProy(result.proyecto_general) as Proyecto)
          : undefined,
        mats: result.materiales ?? {},
        profs: (result.profundidades ?? []).map((r) => ({
          id: r.client_id,
          red: r.red,
          col: r.col ?? '',
          prof: r.prof ?? 0,
          norma: r.norma ?? '',
          nota: r.nota ?? '',
        })),
        crits: (result.criterios ?? []).map((r) => ({
          id: r.client_id,
          red: r.red,
          param: r.param ?? '',
          val: r.val ?? '',
          uni: r.uni ?? '',
          norma: r.norma ?? '',
          art: r.art ?? '',
          cumple: r.cumple ?? '',
          nota: r.nota ?? '',
        })),
        plans_meta: (result.planos_meta ?? []).map(planoMetaRowToPlanMeta),
        redesActivas: result.proyecto_general?.redes_activas ?? undefined,
      },
      error: null,
    };
  } catch (e) {
    devError('proyectoDataService load exception:', e);
    return { data: null, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Escribe UN campo whitelisteado de cf_proyecto_general vía RPC SECURITY DEFINER — el
 *  upsert directo chocaba con el revoke de 20260813000003 (permission denied silencioso). */
export async function saveCampoProyectoGeneral(
  proyectoId: string,
  campo: 'af_alimentacion' | 'tanque_npt' | 'presion_garantizada' | 'rejillas',
  value: string,
): Promise<void> {
  await conSesion(`save-${campo}`, () =>
    supabase.rpc('save_proyecto_general_campo', {
      p_proyecto_id: proyectoId,
      p_campo: campo,
      p_valor: value,
    } as never),
  );
}

/** Lee UNA columna whitelisteada de cf_proyecto_general por proyecto (null si no hay fila). */
export async function loadCampoProyectoGeneral<T>(
  proyectoId: string,
  campo: 'af_alimentacion' | 'tanque_npt' | 'presion_garantizada' | 'rejillas',
): Promise<T | null> {
  try {
    const { data, error } = await supabase
      .from(CF_TABLES.proyectoGeneral)
      .select(campo)
      .eq('proyecto_id', proyectoId)
      .maybeSingle();
    if (error) {
      devError(`loadCampoProyectoGeneral(${campo}):`, error.message);
      return null;
    }
    return (data as Record<string, T | null> | null)?.[campo] ?? null;
  } catch (e) {
    devError(`loadCampoProyectoGeneral(${campo}) exception:`, e);
    return null;
  }
}

/** Guarda lo de rejillas (huecos de ventilación) del proyecto en la BD. Ej: NTC (Norma Tecnica Colombiana) 3631 + gas (Gas) natural/glp en un solo blob. */
export interface RejillasBlob {
  overrides?: Record<string, unknown>;
  gas?: 'natural' | 'glp';
  gasod?: Record<string, Record<string, number>>;
  ts?: number;
}

export async function saveRejillasProyecto(proyectoId: string, blob: RejillasBlob): Promise<void> {
  return saveCampoProyectoGeneral(proyectoId, 'rejillas', JSON.stringify(blob ?? {}));
}

/** Lee el blob de rejillas del proyecto (null si no hay fila o aún no se guardó). */
export async function loadRejillasProyecto(proyectoId: string): Promise<RejillasBlob | null> {
  return loadCampoProyectoGeneral<RejillasBlob | null>(proyectoId, 'rejillas');
}
