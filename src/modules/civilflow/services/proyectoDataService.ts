import { supabase } from '../../../lib/supabase';
import { devError } from '../../../utils/devError';
import type { Piso } from '../lib/shared/projectTypes';
import type { Proyecto, MaterialItem, ProfItem, CritItem } from '../context/ProjectContext';
import type { PlanMeta } from '../lib/shared/projectTypes';
import type { GasDatosGenerales } from '../utils/gasRows';

export type { GasDatosGenerales } from '../utils/gasRows';

export interface ProyectoCoreData {
  pisos: Piso[];
  proy: Proyecto;
  mats: Record<string, MaterialItem[]>;
  profs: ProfItem[];
  crits: CritItem[];
}

export interface ProyectoDataRow extends Partial<ProyectoCoreData> {
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
 * proyecto con el snapshot dado, vía RPC SECURITY DEFINER (borra-e-inserta por tabla en una
 * transacción atómica, replicando la semántica previa de "sobrescribir todo el blob jsonb"
 * ahora que cada colección es una tabla normalizada). Ver
 * supabase/migrations/20260813000002_rls_security_definer_writes.sql.
 */
export async function saveProyectoCoreData(
  proyectoId: number,
  core: ProyectoCoreData,
): Promise<void> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

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
    if (error) devError('proyectoDataService saveCore rpc:', error.message);
  } catch (e) {
    devError('proyectoDataService saveCore exception:', e);
  }
}

/**
 * Hace upsert solo de la columna `redes_activas` de proyecto_general vía RPC SECURITY
 * DEFINER — upsert parcial, no toca nombre/dir/mats/etc (a diferencia de
 * saveProyectoCoreData, que es dueña de toda la fila). Lo usa el toggle "Redes activas"/
 * "Equipos activos" de useWorkAreaState.ts, independiente del bundle de datos core de
 * ProjectContext.
 */
export async function saveRedesActivas(proyectoId: number, redes: string[]): Promise<void> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.rpc('save_redes_activas', {
      p_proyecto_id: proyectoId,
      p_redes: redes,
    });
    if (error) devError('proyectoDataService saveRedesActivas rpc:', error.message);
  } catch (e) {
    devError('proyectoDataService saveRedesActivas exception:', e);
  }
}

/**
 * Carga los datos generales de diseño de gas (gas_datos_proyecto, 1:1 con el proyecto).
 * Devuelve null cuando la fila no existe aún — el llamador decide si usar defaults.
 */
export async function loadGasDatos(proyectoId: number): Promise<GasDatosGenerales | null> {
  try {
    const { data, error } = await supabase
      .from('gas_datos_proyecto')
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
export async function saveGasDatos(proyectoId: number, datos: GasDatosGenerales): Promise<void> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.rpc('save_gas_datos', {
      p_proyecto_id: proyectoId,
      p_datos: {
        altitud: datos.alt,
        presion_atm: datos.patm,
        temperatura: datos.temp,
        presion_min: datos.pmin,
        densidad_relativa: datos.densRel,
      },
    });
    if (error) devError('proyectoDataService saveGasDatos rpc:', error.message);
  } catch (e) {
    devError('proyectoDataService saveGasDatos exception:', e);
  }
}

/**
 * Reemplaza las filas `planos` de un proyecto (solo metadatos — los binarios PDF van por
 * pdfStorageService) vía RPC SECURITY DEFINER.
 */
export async function saveProyectoPlansMeta(
  proyectoId: number,
  plansMeta: PlanMeta[],
): Promise<void> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.rpc('save_planos_meta', {
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
    });
    if (error) devError('proyectoDataService savePlansMeta rpc:', error.message);
  } catch (e) {
    devError('proyectoDataService savePlansMeta exception:', e);
  }
}

/**
 * Carga el dataset core completo de un proyecto en una sola ida y vuelta vía el
 * RPC get_proyecto_data (proyecto_general + pisos + materiales + profundidades +
 * criterios + metadatos de planos), en lugar de 6 selects secuenciales a tablas.
 */
export async function loadProyectoData(proyectoId: number): Promise<ProyectoDataRow | null> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase.rpc('get_proyecto_data', { p_proyecto_id: proyectoId });

    if (error) {
      devError('proyectoDataService load:', error.message);
      return null;
    }
    if (!data) return null;

    const result = data as GetProyectoDataResult;
    return {
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
    };
  } catch (e) {
    devError('proyectoDataService load exception:', e);
    return null;
  }
}
