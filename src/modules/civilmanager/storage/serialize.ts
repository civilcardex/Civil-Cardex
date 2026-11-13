import {
  CARGOS_DEFAULTS,
  CATEGORIAS_APU,
  CATEGORIAS_INSUMO,
  COMENTARIOS_APU_DEFAULTS,
  ORIGENES,
  PREST_DEFAULTS,
  TIPO_EQUIPO,
  TRANSP_UNIDADES,
  UNIDADES,
  cargoCodigoDefault,
  perfilesPaisDefault,
} from '../seedData.ts';
import type { CivilManagerState } from '../types.ts';

/**
 * Forma del estado CM (CivilManager) y saneo de filas antes de viajar a la BD (Base de Datos):
 * defaults, migración de estados viejos y whitelist de columnas. Todo puro, sin Supabase ni IDB.
 * Ej: un presupuesto viejo sin insumos_snap llega con [] y el motor nunca encuentra undefined.
 */
const SCHEMA_VERSION = 1;

/** Estado inicial del módulo: config por defecto (país CO, moneda USD, % de AIU) y listas semilla. Ej: un proyecto nuevo parte con salario_base 400 USD y sin APU. */
export function defaultState(): CivilManagerState {
  return {
    schemaVersion: SCHEMA_VERSION,
    factoresPrestaciones: PREST_DEFAULTS.map((p) => ({ ...p, id: crypto.randomUUID() })),
    cargos: CARGOS_DEFAULTS.map((c, i) => ({
      ...c,
      id: crypto.randomUUID(),
      codigo: cargoCodigoDefault(i),
    })),
    cuadrillas: [],
    equipos: [],
    insumos: [],
    apus: [],
    presupuestos: [],
    proveedores: [],
    categorias_apu: CATEGORIAS_APU.map((c) => ({ ...c })),
    config_listas: {
      unidades: UNIDADES.slice(),
      categorias_insumo: CATEGORIAS_INSUMO.slice(),
      categorias_apu: CATEGORIAS_APU.map((c) => ({
        codigo: c.codigo,
        categoria: c.categoria,
        desc: c.desc,
      })),
      tipos_equipo: TIPO_EQUIPO.slice(),
      origenes: ORIGENES.slice(),
      unidades_transporte: TRANSP_UNIDADES.slice(),
      perfiles_pais: perfilesPaisDefault(),
      tipos_unidad: [],
      mapeos_formulario: [],
    },
    config: {
      pais: 'CO',
      // Default USD (la app migró su moneda a USD): el salario ya se expresa en USD.
      moneda: 'USD',
      salario_base: 400,
      auxilio_transporte: 0, // sembrar por país (PerfilPaisPanel)
      ibc_tope: 25,
      pct_administracion: 10,
      pct_imprevistos: 3,
      pct_utilidad: 6,
      herr_pct: 5,
      dias_mes: 25,
      horas_mes: 182,
      unidad: 'mes',
      vr_resumido: false,
      usar_en_cada_apu: true,
      usar_fp_en_apu: false,
      comentarios_apu: { ...COMENTARIOS_APU_DEFAULTS },
    },
  };
}

/**
 * Rellena las claves ausentes de un estado guardado con defaults, sin pisar lo que sí viene.
 * Ej: un presupuesto viejo sin `insumos_snap` llega con `[]` y el resto del código confía en esa clave.
 * @param raw estado parcial leído de IDB o del jsonb de Supabase (puede ser null).
 * @returns estado completo listo para el motor.
 */
export function migrateState(
  raw: Partial<CivilManagerState> | null | undefined,
): CivilManagerState {
  const base = defaultState();
  if (!raw) return base;
  // Los presupuestos guardados antes de los snapshots completos llegan sin las claves nuevas:
  // se rellenan con sus valores vacíos para que el resto del código pueda confiar en ellas.
  const presupuestos = Array.isArray(raw.presupuestos)
    ? raw.presupuestos.map((p) => ({
        ...p,
        insumos_snap: p.insumos_snap ?? [],
        equipos_snap: p.equipos_snap ?? [],
        cuadrillas_snap: p.cuadrillas_snap ?? [],
        perfil_pais_snap: p.perfil_pais_snap ?? null,
        formulario_original: p.formulario_original ?? null,
      }))
    : base.presupuestos;
  return {
    ...base,
    ...raw,
    schemaVersion: SCHEMA_VERSION,
    // Respetar arrays vacíos vs. semillas: un proyecto nuevo debe partir SIN cargos,
    // factores ni entidades (vienen de cm_get_data como []). Solo se siembran los
    // defaults si el campo está ausente (undefined), no si llega vacío.
    factoresPrestaciones: Array.isArray(raw.factoresPrestaciones)
      ? raw.factoresPrestaciones
      : base.factoresPrestaciones,
    cargos: Array.isArray(raw.cargos) ? raw.cargos : base.cargos,
    categorias_apu: Array.isArray(raw.categorias_apu) ? raw.categorias_apu : base.categorias_apu,
    presupuestos,
    // RPC con forma inesperada (null/clave ausente): sin guard, `undefined` pisaba al base y
    // `loadedState.apus.length` reventaba — el catch lo tragaba y la UI mostraba defaults
    // vacíos con datos existentes en BD.
    cuadrillas: Array.isArray(raw.cuadrillas) ? raw.cuadrillas : base.cuadrillas,
    equipos: Array.isArray(raw.equipos) ? raw.equipos : base.equipos,
    insumos: Array.isArray(raw.insumos) ? raw.insumos : base.insumos,
    apus: Array.isArray(raw.apus) ? raw.apus : base.apus,
    proveedores: Array.isArray(raw.proveedores) ? raw.proveedores : base.proveedores,
    config_listas: { ...base.config_listas, ...(raw.config_listas || {}) },
    config: {
      ...base.config,
      ...(raw.config || {}),
      comentarios_apu: { ...base.config.comentarios_apu, ...(raw.config?.comentarios_apu || {}) },
    },
  };
}

// ═══ Whitelists de columnas reales por tabla (migración cm_schema + snaps) — compartidas
// por la RPC cm_save_state y el camino legado: todo campo de más (fuera de esta lista)
// tumbaba el upsert del legado con 400; el RPC también las usa para limpiar el jsonb.
const TABLE_COLUMNS: Record<string, string[]> = {
  cm_factores_prestacionales: ['id', 'codigo', 'nombre', 'factor', 'tipo'],
  cm_cargos: ['id', 'codigo', 'descripcion', 'num_salarios_base'],
  cm_proveedores: [
    'id',
    'codigo',
    'nombre',
    'nit',
    'contacto',
    'tel1',
    'tel2',
    'email',
    'direccion',
    'ciudad',
    'departamento',
    'tipo',
    'notas',
    'activo',
  ],
  cm_cuadrillas: ['id', 'codigo', 'descripcion'],
  cm_equipos: [
    'id',
    'codigo',
    'nombre',
    'tipo',
    'unidad',
    'costo_hora',
    'fecha_cotizacion',
    'proveedor_id',
  ],
  cm_insumos: [
    'id',
    'codigo',
    'nombre',
    'unidad',
    'origen',
    'categoria',
    'subcategoria',
    'marca_referencia',
    'costo_unitario',
    'fecha_cotizacion',
    'apu_basico_id',
    'proveedor_id',
  ],
  cm_apus: [
    'id',
    'codigo',
    'nombre',
    'categoria',
    'unidad',
    'fecha_creacion',
    'es_basico',
    'recursos_mo',
    'recursos_eq',
    'recursos_ins',
    'recursos_transporte',
  ],
  cm_presupuestos: [
    'id',
    'codigo',
    'nombre',
    'entidad',
    'contrato',
    'objeto',
    'plazo',
    'fecha_creacion',
    'ciudad',
    'departamento',
    'elaborado_por',
    'activo',
    'con_sub_proyectos',
    'parent_id',
    'estado',
    'fecha_cierre',
    'observaciones',
    'items',
    'aiu_override',
    'factores_snap',
    'cargos_snap',
    'apus_snap',
    'insumos_snap',
    'equipos_snap',
    'cuadrillas_snap',
    'perfil_pais_snap',
    'formulario_original',
    'tipo_precio_formulario',
    'alarmas_precio_faltante',
  ],
};
// FKs (Foreign Key, llave foránea) anulables: '' no existe en la tabla referenciada y
// violaba la FK con 409.
const NULLABLE_FK_EMPTY_TO_NULL: Record<string, string[]> = {
  cm_equipos: ['proveedor_id'],
  cm_insumos: ['proveedor_id'],
};
// Columnas anulables donde null significa "limpiar el valor" — viajan tal cual. En el
// resto, null/undefined/NaN se OMITEN: JSON.stringify(NaN) serializa a null y tumbaba el
// upsert con 23502 (es_basico, observaciones...); omitir deja que la BD aplique su default
// (fila nueva) o conserve el valor previo (upsert).
const NULLABLE: Record<string, string[]> = {
  cm_equipos: ['proveedor_id'],
  cm_insumos: ['proveedor_id', 'apu_basico_id'],
  cm_presupuestos: [
    'parent_id',
    'perfil_pais_snap',
    'formulario_original',
    'tipo_precio_formulario',
    'alarmas_precio_faltante',
  ],
};

/**
 * Sanea filas para la BD: whitelist de columnas, null/NaN fuera en NO anulables (la BD
 * aplica su default), '' → null en FKs anulables y sello user_id/proyecto_id.
 * Ej: un equipo con proveedor_id:'' viaja {proveedor_id: null} para no tumbar la FK.
 * @param table tabla destino (clave de TABLE_COLUMNS).
 * @param rows filas crudas del estado del módulo.
 * @param userIdEscritura user_id que se sella en cada fila (el RPC lo re-valida; el legado lo manda tal cual).
 * @param proyectoUid proyecto al que se atribuyen las filas.
 * @returns las filas listas para upsert (o para el jsonb de cm_save_state).
 */
export function limpiarFilas(
  table: string,
  rows: unknown[],
  userIdEscritura: string,
  proyectoUid: string,
): Record<string, unknown>[] {
  const cols = TABLE_COLUMNS[table];
  const nullFks = NULLABLE_FK_EMPTY_TO_NULL[table] || [];
  const nullables = NULLABLE[table] || [];
  return (rows as Record<string, unknown>[]).map((r) => {
    const clean: Record<string, unknown> = {};
    if (cols) {
      for (const c of cols) {
        if (!(c in r)) continue;
        const v = r[c];
        if (!nullables.includes(c)) {
          if (v == null) continue;
          if (typeof v === 'number' && Number.isNaN(v)) continue;
        }
        clean[c] = v;
      }
    } else {
      Object.assign(clean, r);
    }
    clean.user_id = userIdEscritura;
    clean.proyecto_id = r.proyecto_id ?? proyectoUid;
    for (const fk of nullFks) if (clean[fk] === '') clean[fk] = null;
    return clean;
  });
}
