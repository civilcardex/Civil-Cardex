export interface FactorPrestacional {
  id: string;
  codigo: string;
  nombre: string;
  factor: number;
  tipo: 'prestaciones' | 'seguridad_social' | 'parafiscales' | 'otros';
}

export interface Cargo {
  id: string;
  codigo: string;
  descripcion: string;
  num_salarios_base: number;
}

export interface CargoCalculado extends Cargo {
  valorBasico: number;
  costo_base_dia: number;
  costo_base_hora: number;
  costo_total_dia: number;
  costo_total_hora: number;
}

export interface CuadrillaIntegrante {
  id: string;
  cargo_id: string;
  cantidad: number;
}

export interface Cuadrilla {
  id: string;
  codigo: string;
  descripcion: string;
  integrantes: CuadrillaIntegrante[];
}

export interface Equipo {
  id: string;
  codigo: string;
  nombre: string;
  tipo: string;
  unidad: string;
  costo_hora: number;
  fecha_cotizacion: string;
  proveedor_id: string;
}

export type OrigenInsumo = 'Local' | 'Nacional' | 'Importado' | 'Preparado en obra';

export interface Insumo {
  id: string;
  codigo: string;
  nombre: string;
  unidad: string;
  origen: string;
  categoria: string;
  subcategoria: string;
  marca_referencia: string;
  costo_unitario: number;
  fecha_cotizacion: string;
  apu_basico_id: string;
  proveedor_id: string;
}

export interface Proveedor {
  id: string;
  codigo: string;
  nombre: string;
  nit: string;
  contacto: string;
  tel1: string;
  tel2: string;
  email: string;
  direccion: string;
  ciudad: string;
  departamento: string;
  tipo: string[];
  notas: string;
  activo: boolean;
}

export interface ApuRecursoMO {
  id: string;
  cargo_id: string;
  cant_personas: number;
  rendimiento: number;
}

export interface ApuRecursoEquipo {
  equipo_id: string;
  rendimiento: number;
}

export interface ApuRecursoInsumo {
  insumo_id: string;
  consumo: number;
  desperdicios_pct: number;
}

export interface ApuRecursoTransporte {
  equipo_id?: string;
  unidad: string;
  tarifa: number;
  distancia_km: number;
}

export interface Apu {
  id: string;
  codigo: string;
  nombre: string;
  categoria: string;
  unidad: string;
  fecha_creacion: string;
  es_basico: boolean;
  recursos_mo: ApuRecursoMO[];
  recursos_eq: ApuRecursoEquipo[];
  recursos_ins: ApuRecursoInsumo[];
  recursos_transporte: ApuRecursoTransporte[];
}

export interface ApuCalculado {
  id: string;
  subMO: number;
  herr: number;
  subEq: number;
  subIns: number;
  subTrans: number;
  vrPrest: number;
  subPers: number;
  totalDirecto: number;
  costo_unitario: number;
}

export interface PresupuestoItem {
  id: string;
  num_item: string;
  capitulo: string;
  descripcion: string;
  unidad: string;
  cantidad: number;
  apu_id: string;
  tiene_apu: boolean;
  alerta_sin_apu: boolean;
  es_capitulo: boolean;
  es_capitulo_manual: boolean | null;
}

export interface AiuOverride {
  activo: boolean;
  pct_a: number;
  pct_i: number;
  pct_u: number;
  iva_pct: number;
}

export type EstadoPresupuesto = 'borrador' | 'en_revision' | 'cerrado';

export interface Presupuesto {
  id: string;
  codigo: string;
  nombre: string;
  entidad: string;
  contrato: string;
  objeto: string;
  plazo: string;
  fecha_creacion: string;
  ciudad: string;
  departamento: string;
  elaborado_por: string;
  activo: boolean;
  con_sub_proyectos: boolean;
  parent_id: string | null;
  estado: EstadoPresupuesto;
  fecha_cierre: string;
  observaciones: string;
  items: PresupuestoItem[];
  aiu_override: AiuOverride;
  factores_snap: FactorPrestacional[];
  cargos_snap: Cargo[];
  apus_snap: Apu[];
}

export interface ListaItem {
  codigo: string;
  nombre?: string;
  categoria?: string;
  desc: string;
}

export interface UnidadMedida {
  abreviatura: string;
  descripcion: string;
  tipo: string;
}

export interface PerfilPais {
  codigo: string;
  nombre: string;
  moneda: string;
  smmlv: number;
  tope_ibc_mult: number;
  auxilio_transporte: number;
  dias_mes: number;
  horas_mes: number;
  unidad: 'mes' | 'hora';
}

export interface ConfigListas {
  unidades: UnidadMedida[];
  categorias_insumo: ListaItem[];
  categorias_apu: ListaItem[];
  tipos_equipo: ListaItem[];
  origenes: ListaItem[];
  unidades_transporte: ListaItem[];
  perfiles_pais: PerfilPais[];
  tipos_unidad: string[];
}

export interface ComentariosApu {
  tipo_salario: string;
  factor_prest: string;
  costo_personal_fp: string;
  herramienta_menor: string;
  administracion: string;
  imprevistos: string;
  utilidad: string;
  vr_resumido: string;
  usar_en_cada_apu: string;
}

export interface CivilManagerConfig {
  pais: string;
  moneda: string;
  salario_base: number;
  auxilio_transporte: number;
  ibc_tope: number;
  pct_administracion: number;
  pct_imprevistos: number;
  pct_utilidad: number;
  herr_pct: number;
  dias_mes: number;
  horas_mes: number;
  unidad: string;
  vr_resumido: boolean;
  usar_en_cada_apu: boolean;
  usar_fp_en_apu: boolean;
  comentarios_apu: ComentariosApu;
}

export interface CivilManagerState {
  schemaVersion: number;
  factoresPrestaciones: FactorPrestacional[];
  cargos: Cargo[];
  cuadrillas: Cuadrilla[];
  equipos: Equipo[];
  insumos: Insumo[];
  apus: Apu[];
  presupuestos: Presupuesto[];
  proveedores: Proveedor[];
  categorias_apu: ListaItem[];
  config_listas: ConfigListas;
  config: CivilManagerConfig;
}

export type CivilManagerEntityKey =
  | 'factoresPrestaciones'
  | 'cargos'
  | 'cuadrillas'
  | 'equipos'
  | 'insumos'
  | 'apus'
  | 'presupuestos'
  | 'proveedores'
  | 'categorias_apu';
