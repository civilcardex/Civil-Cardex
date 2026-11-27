/**
 * Modelo de datos del módulo CM (Civil Manager): catálogos de costos (cargos,
 * cuadrillas, equipos, insumos, proveedores), APU (Análisis de Precios
 * Unitarios) y presupuestos con AIU e IVA. La hidráulica vive en civilflow;
 * aquí solo el dinero de la obra.
 */
export interface FactorPrestacional {
  id: string;
  codigo: string;
  nombre: string;
  factor: number;
  tipo: 'prestaciones' | 'seguridad_social' | 'parafiscales' | 'otros';
}

/** Plaza laboral medida en salarios base. Ej: "Contra maestro" 2.5 sb — con salario base $1.400.000 gana $3.500.000/mes básicos. */
export interface Cargo {
  id: string;
  codigo: string;
  descripcion: string;
  num_salarios_base: number;
}

/** Cargo + costos derivados: valor básico mensual y costo por día/hora con (total) y sin (base) FP (Factor Prestacional). Es el insumo de los jornales en los APU (Análisis de Precios Unitarios). */
export interface CargoCalculado extends Cargo {
  valorBasico: number;
  costo_base_dia: number;
  costo_base_hora: number;
  costo_total_dia: number;
  costo_total_hora: number;
}

/** Cargo dentro de una cuadrilla y cuántos hay. Ej: {cargo_id: oficial, cantidad: 1} + {ayudante, 2}. */
export interface CuadrillaIntegrante {
  id: string;
  cargo_id: string;
  cantidad: number;
}

/** Equipo de trabajo para un frente de obra: qué cargos lo integran y en qué cantidad. Ej: 1 oficial + 2 ayudantes. */
export interface Cuadrilla {
  id: string;
  codigo: string;
  descripcion: string;
  integrantes: CuadrillaIntegrante[];
}

/** Máquina o herramienta con costo_hora: en el APU multiplica el rendimiento, igual que la mano de obra. fecha_cotizacion/proveedor_id dejan rastro de la última actualización de precio. */
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

/** Material del catálogo. Con origen 'Preparado en obra' el precio NO sale de costo_unitario sino del APU básico apu_basico_id (ej: mortero mezclado en sitio). */
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

/** Proveedor de insumos del catálogo de costos (nit para la factura del APU). */
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

/** Fila de mano de obra de un APU: cargo, cuántas personas y rendimiento (fracción de jornada por unidad de obra — 0.5 = media jornada). */
export interface ApuRecursoMO {
  id: string;
  cargo_id: string;
  cant_personas: number;
  rendimiento: number;
}

/** Equipo dentro de un APU con su rendimiento (unidades/hora — multiplica el costo_hora). */
export interface ApuRecursoEquipo {
  equipo_id: string;
  rendimiento: number;
}

/** Insumo de un APU: consumo por unidad y desperdicio. Costo = costo_unitario × consumo × (1 + desperdicios_pct/100). Ej: cemento 0.35 bultos con 5 % de desperdicio. */
export interface ApuRecursoInsumo {
  insumo_id: string;
  consumo: number;
  desperdicios_pct: number;
}

/** Transporte de un APU: unidad 'Global' cobra tarifa fija; el resto multiplica tarifa × distancia_km (ej: M3-Km, Ton-Km). */
export interface ApuRecursoTransporte {
  equipo_id?: string;
  unidad: string;
  tarifa: number;
  distancia_km: number;
}

/** APU (Análisis de Precios Unitarios): cuánto cuesta una unidad de obra (ej: "Excavación m³") sumando sus 4 listas de recursos. es_basico lo marca como subproducto reutilizable desde otros APU ("Preparado en obra"). */
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

/** Resultado de calcAPU: subtotales por recurso (mano de obra, equipo, insumo, transporte), herramienta menor, prestaciones y totalDirecto = costo_unitario. */
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

/** Fila del presupuesto. es_capitulo/es_capitulo_manual: fila que agrupa sin valor propio; alerta_sin_apu: quedó sin APU y sin precio al importar. */
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

/** AIU (Administración, Imprevistos, Utilidad) exclusivo de este presupuesto, que pisa los % globales de la config. iva_pct (19 % por defecto) se aplica solo a la utilidad — estilo colombiano. */
export interface AiuOverride {
  activo: boolean;
  pct_a: number;
  pct_i: number;
  pct_u: number;
  iva_pct: number;
  vr_resumido?: boolean;
  usar_en_cada_apu?: boolean;
}

/** Ciclo de vida del presupuesto: borrador -> en_revision -> cerrado. Doctrina: 'cerrado' calcula SIEMPRE con las snaps congeladas (calcMapParaPres) — editar el catálogo global no mueve un presupuesto ya entregado; borrador/en_revision calculan con los catálogos vivos. Al pasar a 'cerrado' el panel refresca las snaps con los catálogos actuales. */
export type EstadoPresupuesto = 'borrador' | 'en_revision' | 'cerrado';

/** Objetivo de obra con sus ítems. Los campos *_snap congelan los catálogos al crearlo; al cambiar estado a 'cerrado' se refrescan con los vigentes — desde ahí el cálculo sale de la foto (calcMapParaPres), no del catálogo global. */
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
  /** Copias de los catálogos tomadas al cerrar (o crear): el presupuesto cerrado calcula con estas, no con el catálogo global. */
  insumos_snap: Insumo[];
  equipos_snap: Equipo[];
  cuadrillas_snap: Cuadrilla[];
  perfil_pais_snap: PerfilPais | null;
  /** % de herramienta y uso de factores prestacionales congelados AL CERRAR (auditoría
   *  2026-11-27): el recálculo de un cerrado no usa la config viva. null = histórico sin
   *  foto (cae a la config vigente, documentado). */
  herr_pct_snap?: number | null;
  usar_fp_en_apu_snap?: boolean | null;
}

/** Fila de una lista de precios exportada/importada (desc legible + categoría para agrupar). */
export interface ListaItem {
  codigo: string;
  nombre?: string;
  categoria?: string;
  desc: string;
}

/** Unidad de medida del catálogo global (m, m³, gl, und…) con su tipo para agrupar. */
export interface UnidadMedida {
  abreviatura: string;
  descripcion: string;
  tipo: string;
}

/** Parámetros laborales por país: salario mínimo (smmlv), moneda, días/horas del mes y unidad mes|hora (por hora: el jornal no se divide). vigencia: año de referencia de los valores (semáforo de frescura); iva_pct: tasa general del impuesto al valor agregado del país (se copia a config al activar). */
export interface PerfilPais {
  codigo: string;
  nombre: string;
  moneda: string;
  smmlv: number;
  vigencia: number;
  iva_pct: number;
  dias_mes: number;
  horas_mes: number;
  unidad: 'mes' | 'hora';
}

/** Catálogos de las listas desplegables del módulo: unidades, categorías, tipos de equipo, orígenes y perfiles de país. (Las categorías de APU viven SOLO en state.categorias_apu.) */
export interface ConfigListas {
  unidades: UnidadMedida[];
  categorias_insumo: ListaItem[];
  tipos_equipo: ListaItem[];
  origenes: ListaItem[];
  unidades_transporte: ListaItem[];
  perfiles_pais: PerfilPais[];
}

/** Ayudas por campo que la hoja de APU muestra junto a cada concepto (texto configurable; no son valores de cálculo). */
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

/** Config activa: país/salario base y % de AIU, más flags de doctrina de precios. iva_pct: tasa del país activo (CO 19, PE 18, EC 15, CL 19, AR 21, BO 13) — se aplica solo a la utilidad (estilo colombiano). usar_fp_en_apu: FP dentro del jornal o como línea aparte; vr_resumido: AIU discriminado o en una sola línea. */
export interface CivilManagerConfig {
  pais: string;
  moneda: string;
  salario_base: number;
  iva_pct: number;
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

/** Raíz del estado persistido del módulo: todos los catálogos + config + presupuestos. schemaVersion permite migrar datos viejos al cargar. */
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
