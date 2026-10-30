/**
 * Forma del jsonb que devuelve el RPC (Remote Procedure Call, función que vive en la BD y
 * se llama por red) cm_get_data: la frontera única BD→UI del módulo CM (Civil Manager).
 * Ej: { factores: [...], config: { config: {pais:'CO',...}, categorias_apu: [...] } }.
 */
import type {
  Apu,
  Cargo,
  CivilManagerConfig,
  ConfigListas,
  Cuadrilla,
  Equipo,
  FactorPrestacional,
  Insumo,
  ListaItem,
  Presupuesto,
  Proveedor,
} from './types.ts';

/** Fila de cm_proyectos tal como la serializa el RPC (to_jsonb de la tabla completa). */
export interface CmProyectoFila {
  id: string;
  user_id: string;
  codigo: string;
  nombre: string;
  created_at: string;
  updated_at: string;
}

/**
 * Clave `config` del RPC: la fila de cm_config sin user_id (el SQL la quita con `- 'user_id'`).
 * APU (Análisis de Precios Unitarios). Ej: { config: {salario_base: 400, ...}, categorias_apu: [...] }.
 */
export interface CmConfigFila {
  config?: CivilManagerConfig;
  config_listas?: ConfigListas;
  categorias_apu?: ListaItem[];
  updated_at?: string;
}

/**
 * Las 10 claves de cm_get_data, en el orden en que las arma el SQL. Todas OPCIONALES a
 * propósito: el passthrough no inventa datos — una clave ausente del jsonb queda undefined
 * y migrateState (storage.ts) aplica su default. Cuadrilla trae `integrantes` anidado.
 */
export interface CmGetDataDto {
  proyectos?: CmProyectoFila[];
  factores?: FactorPrestacional[];
  cargos?: Cargo[];
  cuadrillas?: Cuadrilla[];
  equipos?: Equipo[];
  insumos?: Insumo[];
  proveedores?: Proveedor[];
  apus?: Apu[];
  presupuestos?: Presupuesto[];
  config?: CmConfigFila;
}

/**
 * Lee el jsonb crudo de cm_get_data y lo presenta como CmGetDataDto. Es PASSTHROUGH puro:
 * copia las claves tal cual (shallow, un nivel) y NO rellena nada — lo que falte queda
 * undefined. Ej: readCmSnapshot({cargos: [c1]}) → {cargos: [c1]} sin claves de más.
 * Si raw no es objeto (null, undefined, array, string) devuelve {} — nada que leer; así
 * la carga de una respuesta malformada no se tumba: migrateState pone sus defaults.
 *
 * @param raw respuesta cruda del RPC, ya deserializada por supabase-js.
 * @returns copia shallow de raw con la forma declarada; {} si raw no es objeto.
 */
export function readCmSnapshot(raw: unknown): CmGetDataDto {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
  // Copia shallow de las claves tal cual llegan (mismo contenido que {...raw}): el jsonb
  // viaja sin tipos en runtime y CmGetDataDto es la forma declarada de la frontera.
  const copia: CmGetDataDto = {};
  Object.assign(copia, raw);
  return copia;
}
