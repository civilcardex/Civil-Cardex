/**
 * Catálogos semilla con los que nace el módulo CM (Civil Manager): factores
 * prestacionales por país (los 6 del selector de civilflow: CO/PE/EC/CL/AR/BO),
 * cargos típicos de obra, unidades, orígenes, categorías de insumo y APU
 * (Análisis de Precios Unitarios), y perfiles laborales de esos 6 países.
 * Se siembran una sola vez al inicializar; después las ediciones del usuario
 * son la verdad. Valores con vigencia 2026 (verificados contra fuente oficial;
 * el campo vigencia activa el semáforo de frescura).
 */
import type { FactorPrestacional, ListaItem, PerfilPais, UnidadMedida } from './types.ts';

/** FP (Factores Prestacionales) de la liquidación colombiana: prestaciones 37.06 %, seguridad social 27.46 %, parafiscales 11.5 %, otros 3 % — total ≈ 79 % sobre el salario. */
export const PREST_DEFAULTS: Omit<FactorPrestacional, 'id'>[] = [
  { codigo: 'FP-001', nombre: 'Subsidio de transporte', factor: 14.23, tipo: 'prestaciones' },
  {
    codigo: 'FP-002',
    nombre: 'Cesantías / Indemnización anual',
    factor: 8.33,
    tipo: 'prestaciones',
  },
  { codigo: 'FP-003', nombre: 'Intereses sobre cesantías', factor: 1, tipo: 'prestaciones' },
  { codigo: 'FP-004', nombre: 'Prima / Aguinaldo', factor: 8.33, tipo: 'prestaciones' },
  { codigo: 'FP-005', nombre: 'Vacaciones', factor: 4.17, tipo: 'prestaciones' },
  { codigo: 'FP-006', nombre: 'Dotación / Implementos', factor: 1, tipo: 'prestaciones' },
  { codigo: 'FP-007', nombre: 'Salud (aporte empleador)', factor: 8.5, tipo: 'seguridad_social' },
  { codigo: 'FP-008', nombre: 'Pensión (aporte empleador)', factor: 12, tipo: 'seguridad_social' },
  { codigo: 'FP-009', nombre: 'Riesgos laborales', factor: 6.96, tipo: 'seguridad_social' },
  { codigo: 'FP-010', nombre: 'Caja / Bienestar', factor: 4, tipo: 'parafiscales' },
  { codigo: 'FP-011', nombre: 'Formación profesional', factor: 2, tipo: 'parafiscales' },
  { codigo: 'FP-012', nombre: 'Protección a la infancia', factor: 3, tipo: 'parafiscales' },
  {
    codigo: 'FP-013',
    nombre: 'FIC (industria de la construcción)',
    factor: 2.5,
    tipo: 'parafiscales',
  },
  { codigo: 'FP-014', nombre: 'Horas extras (provisión)', factor: 2, tipo: 'otros' },
  { codigo: 'FP-015', nombre: 'Permisos / Ausentismo (provisión)', factor: 1, tipo: 'otros' },
  { codigo: 'FP-016', nombre: 'Otros auxilios', factor: 0, tipo: 'otros' },
];

/** Descripción que el panel muestra al desplegar cada categoría de FP (prestaciones / seguridad social / parafiscales / otros). */
export const FP_CAT_DESC_DEFAULTS: Record<FactorPrestacional['tipo'], string> = {
  prestaciones:
    'Beneficios económicos obligatorios derivados del contrato laboral: cesantías, intereses, prima, vacaciones, dotación, subsidio de transporte.',
  seguridad_social:
    'Aportes obligatorios al sistema de salud, pensión y riesgos laborales (ARL). Compartidos entre empleador y trabajador.',
  parafiscales:
    'Aportes a fondos de bienestar social: Caja de Compensación Familiar, SENA, ICBF. Solo a cargo del empleador.',
  otros:
    'Componentes adicionales específicos de cada empresa o sector: horas extras, recargos nocturnos, dominicales, beneficios extralegales.',
};

/**
 * FP (Factores Prestacionales) semilla POR PAÍS — solo los 6 del selector. Cada fila lleva
 * la fuente de su % en el nombre (verificación 2026-11); lo no verificable no se inventa.
 * CO = PREST_DEFAULTS (liquidación colombiana). Los otros 5 son aportes patronales +
 * provisiones mensualizadas (beneficio anual ÷ 12), la misma doctrina de las filas CO.
 */
export const FP_POR_PAIS: Record<string, Omit<FactorPrestacional, 'id'>[]> = {
  CO: PREST_DEFAULTS,
  // Perú (régimen general, planilla): EsSalud 9 % (Ley 26790); gratificaciones jul+dic
  // = 2 sueldos/año → 16.67 %/mes; bonificación extraordinaria del 9 % sobre gratificación
  // (DS 005-97-TR) ≈ 1.5 %; CTS ≈ 1 sueldo/año → 8.33 %; vacaciones 30 días → 8.33 %.
  PE: [
    {
      codigo: 'FP-101',
      nombre: 'EsSalud (aporte empleador, Ley 26790)',
      factor: 9,
      tipo: 'seguridad_social',
    },
    {
      codigo: 'FP-102',
      nombre: 'Gratificaciones julio + diciembre (provisión 2/12)',
      factor: 16.67,
      tipo: 'prestaciones',
    },
    {
      codigo: 'FP-103',
      nombre: 'Bonificación extraordinaria 9 % s/ gratificación (DS 005-97-TR)',
      factor: 1.5,
      tipo: 'prestaciones',
    },
    {
      codigo: 'FP-104',
      nombre: 'CTS (compensación por tiempo de servicios, provisión 1/12)',
      factor: 8.33,
      tipo: 'prestaciones',
    },
    {
      codigo: 'FP-105',
      nombre: 'Vacaciones 30 días (provisión 1/12)',
      factor: 8.33,
      tipo: 'prestaciones',
    },
  ],
  // Ecuador (régimen general, IESS): aporte patronal 11.15 % (Ley de Seguridad Social,
  // tabla 2026); décimo tercero y décimo cuarto = 8.33 % c/u (provisión 1/12); fondos de
  // reserva 8.33 % (desde el 3.er año — ajustar si el operario es nuevo); provisión de
  // vacaciones 8.33 %.
  EC: [
    {
      codigo: 'FP-201',
      nombre: 'IESS aporte patronal (11.15 %)',
      factor: 11.15,
      tipo: 'seguridad_social',
    },
    {
      codigo: 'FP-202',
      nombre: 'IESS riesgos del trabajo (0.5 %)',
      factor: 0.5,
      tipo: 'seguridad_social',
    },
    {
      codigo: 'FP-203',
      nombre: 'Décimo tercer sueldo (provisión 1/12)',
      factor: 8.33,
      tipo: 'prestaciones',
    },
    {
      codigo: 'FP-204',
      nombre: 'Décimo cuarto sueldo (provisión 1/12)',
      factor: 8.33,
      tipo: 'prestaciones',
    },
    {
      codigo: 'FP-205',
      nombre: 'Fondos de reserva (provisión 1/12, desde 3.er año)',
      factor: 8.33,
      tipo: 'prestaciones',
    },
    { codigo: 'FP-206', nombre: 'Vacaciones (provisión 1/12)', factor: 8.33, tipo: 'prestaciones' },
  ],
  // Chile: cargo del EMPLEADOR — cotización SSP (reforma previsional) 3.5 % desde ago-2026
  // (Ley 21.735, escala hasta 7 % en 2033); seguro de cesantía AFC contrato indefinido
  // 2.4 %; SIS invalidez y sobrevivencia 1.78 % (2026); Ley 16.744 accidentes 0.95 % base.
  // El 10 % AFP + salud los paga el trabajador (no son carga patronal).
  CL: [
    {
      codigo: 'FP-301',
      nombre: 'SSP cotización empleador (reforma previsional, 3.5 % desde ago-2026)',
      factor: 3.5,
      tipo: 'seguridad_social',
    },
    {
      codigo: 'FP-302',
      nombre: 'Seguro de cesantía AFC, contrato indefinido (2.4 %)',
      factor: 2.4,
      tipo: 'seguridad_social',
    },
    {
      codigo: 'FP-303',
      nombre: 'SIS invalidez y sobrevivencia (1.78 %, 2026)',
      factor: 1.78,
      tipo: 'seguridad_social',
    },
    {
      codigo: 'FP-304',
      nombre: 'Ley 16.744 accidentes del trabajo (prima base 0.95 %)',
      factor: 0.95,
      tipo: 'seguridad_social',
    },
    {
      codigo: 'FP-305',
      nombre: 'Feriado legal 15 días (provisión práctica 1/12)',
      factor: 8.33,
      tipo: 'prestaciones',
    },
  ],
  // Argentina (construcción, convenio UOCRA 130/75): jubilación 16 % (régimen construcción),
  // asignaciones familiares 4.5 %, FNE 1 %, INSSJP 2.5 %, obra social 6 %, contribución
  // adicional 0 % (construcción), Fondo de Cese Laboral ≈ 8.33 %. Excluye aportes
  // sindicales del trabajador y escalones de altos salarios (+19.5 % sobre excedente).
  AR: [
    {
      codigo: 'FP-401',
      nombre: 'Jubilación SIPA régimen construcción (16 %)',
      factor: 16,
      tipo: 'seguridad_social',
    },
    {
      codigo: 'FP-402',
      nombre: 'Asignaciones familiares (4.5 %)',
      factor: 4.5,
      tipo: 'seguridad_social',
    },
    {
      codigo: 'FP-403',
      nombre: 'Fondo Nacional de Empleo (1 %)',
      factor: 1,
      tipo: 'seguridad_social',
    },
    { codigo: 'FP-404', nombre: 'INSSJP (2.5 %)', factor: 2.5, tipo: 'seguridad_social' },
    { codigo: 'FP-405', nombre: 'Obra social (6 %)', factor: 6, tipo: 'seguridad_social' },
    {
      codigo: 'FP-406',
      nombre: 'Fondo de Cese Laboral (provisión ≈ 1/12)',
      factor: 8.33,
      tipo: 'prestaciones',
    },
    {
      codigo: 'FP-407',
      nombre: 'Otros (ajustar según CCT y aportes sindicales)',
      factor: 0,
      tipo: 'otros',
    },
  ],
  // Bolivia: CNS 10 %, AFP empresario (riesgo profesional) 1.71 %, aporte patronal
  // solidario 3 % (Ley 154 art. 4), pro-vivienda FOVIESS 2 % (exclusivamente patronal);
  // aguinaldo = 1 sueldo/año → provisión 8.33 %.
  BO: [
    {
      codigo: 'FP-501',
      nombre: 'CNS Caja Nacional de Salud (10 %)',
      factor: 10,
      tipo: 'seguridad_social',
    },
    {
      codigo: 'FP-502',
      nombre: 'AFP empresario, riesgo profesional (1.71 %)',
      factor: 1.71,
      tipo: 'seguridad_social',
    },
    {
      codigo: 'FP-503',
      nombre: 'Aporte patronal solidario (Ley 154, 3 %)',
      factor: 3,
      tipo: 'seguridad_social',
    },
    {
      codigo: 'FP-504',
      nombre: 'Pro-vivienda FOVIESS (2 %, solo empleador)',
      factor: 2,
      tipo: 'seguridad_social',
    },
    {
      codigo: 'FP-505',
      nombre: 'Aguinaldo diciembre (provisión 1/12)',
      factor: 8.33,
      tipo: 'prestaciones',
    },
  ],
};

/** Cargos típicos de obra con su paga en salarios base: ayudante 1.0 sb, oficial 2.0, Ing Civil Jr. 5.0. */
export const CARGOS_DEFAULTS: { descripcion: string; num_salarios_base: number }[] = [
  { descripcion: 'Ayudante de construcción', num_salarios_base: 1.0 },
  { descripcion: 'Ayudante de Soldadura', num_salarios_base: 1.5 },
  { descripcion: 'Cadenero I', num_salarios_base: 2.0 },
  { descripcion: 'Contra maestro', num_salarios_base: 2.5 },
  { descripcion: 'Ing Civil Jr.', num_salarios_base: 5.0 },
  { descripcion: 'Inspector de Obra Civil', num_salarios_base: 2.0 },
  { descripcion: 'Maestro General', num_salarios_base: 4.0 },
  { descripcion: 'Oficial de construcción', num_salarios_base: 2.0 },
  { descripcion: 'Oficial de Soldadura', num_salarios_base: 2.5 },
  { descripcion: 'Palettero', num_salarios_base: 1.5 },
  { descripcion: 'Topógrafo', num_salarios_base: 3.0 },
  { descripcion: 'Trabajadora Social', num_salarios_base: 2.0 },
];

/** Origen de un insumo: Local / Nacional / Importado / Preparado en obra (el precio lo trae el APU básico de referencia, no el catálogo). */
export const ORIGENES: ListaItem[] = [
  {
    codigo: 'OR-01',
    nombre: 'Local',
    desc: 'Insumo adquirido a proveedor local (mismo municipio o área metropolitana). Precio viene del catálogo de insumos.',
  },
  {
    codigo: 'OR-02',
    nombre: 'Nacional',
    desc: 'Insumo adquirido a proveedor en otra ciudad del país. Puede implicar costo de transporte adicional.',
  },
  {
    codigo: 'OR-03',
    nombre: 'Importado',
    desc: 'Insumo de origen extranjero. Puede incluir aranceles, flete internacional y nacionalización.',
  },
  {
    codigo: 'OR-04',
    nombre: 'Preparado en obra',
    desc: 'El insumo resulta de otro APU (ej: concreto mezclado en sitio, mortero, mezcla asfáltica). El precio = costo total del APU de referencia seleccionado.',
  },
];

/** Unidades de medida del catálogo con su tipo (Longitud, Masa, Conteo...) para agrupar el selector. */
export const UNIDADES: UnidadMedida[] = [
  { abreviatura: 'm', descripcion: 'Metro', tipo: 'Longitud' },
  { abreviatura: 'm2', descripcion: 'Metro cuadrado', tipo: 'Área' },
  { abreviatura: 'm3', descripcion: 'Metro cúbico', tipo: 'Volumen' },
  { abreviatura: 'ml', descripcion: 'Metro lineal', tipo: 'Longitud' },
  { abreviatura: 'km', descripcion: 'Kilómetro', tipo: 'Longitud' },
  { abreviatura: 'mm', descripcion: 'Milímetro', tipo: 'Longitud' },
  { abreviatura: 'kg', descripcion: 'Kilogramo', tipo: 'Masa' },
  { abreviatura: 'ton', descripcion: 'Tonelada métrica', tipo: 'Masa' },
  { abreviatura: 'lt', descripcion: 'Litro', tipo: 'Volumen' },
  { abreviatura: 'gal', descripcion: 'Galón', tipo: 'Volumen' },
  { abreviatura: 'un', descripcion: 'Unidad', tipo: 'Conteo' },
  { abreviatura: 'glb', descripcion: 'Global', tipo: 'Global' },
  { abreviatura: 'pto', descripcion: 'Punto', tipo: 'Conteo' },
  { abreviatura: 'hr', descripcion: 'Hora', tipo: 'Tiempo' },
  { abreviatura: 'dia', descripcion: 'Día laboral', tipo: 'Tiempo' },
  { abreviatura: 'mes', descripcion: 'Mes', tipo: 'Tiempo' },
  { abreviatura: 'par', descripcion: 'Par', tipo: 'Conteo' },
  { abreviatura: 'jgo', descripcion: 'Juego', tipo: 'Conteo' },
  { abreviatura: 'lote', descripcion: 'Lote', tipo: 'Conteo' },
  { abreviatura: 'bulto', descripcion: 'Bulto', tipo: 'Conteo' },
  { abreviatura: 'sc', descripcion: 'Saco (cemento)', tipo: 'Conteo' },
  { abreviatura: 'rollo', descripcion: 'Rollo', tipo: 'Conteo' },
  { abreviatura: 'kg/m', descripcion: 'Kilogramo por metro', tipo: 'Masa' },
  { abreviatura: 'cm', descripcion: 'Centímetro', tipo: 'Longitud' },
];

/** Unidades de la sección transporte del APU: Global (tarifa fija) o por volumen/peso × distancia (M3-Km, Ton-Km). */
export const TRANSP_UNIDADES: ListaItem[] = [
  { codigo: 'UT-01', nombre: 'Hasta la Obra', desc: 'Flete completo hasta el sitio de obra' },
  { codigo: 'UT-02', nombre: 'Acarreo Interno', desc: 'Movimiento de material dentro de la obra' },
  { codigo: 'UT-03', nombre: 'Global', desc: 'Tarifa fija por el servicio completo' },
  { codigo: 'UT-04', nombre: 'M3', desc: 'Por volumen de material transportado' },
  { codigo: 'UT-05', nombre: 'Kg', desc: 'Por peso de material transportado' },
  { codigo: 'UT-06', nombre: 'M3-Km', desc: 'Por volumen y distancia recorrida' },
  { codigo: 'UT-07', nombre: 'Ton-Km', desc: 'Por peso y distancia recorrida' },
];

/** Clasificación de equipos: maquinaria pesada, equipo especial y menor, transporte (sección C del APU, no la A) y herramienta menor. */
export const TIPO_EQUIPO: ListaItem[] = [
  {
    codigo: 'TE-01',
    nombre: 'Maquinaria pesada',
    desc: 'Equipos de movimiento de tierra, excavación, compactación y pavimentación. Ej: retroexcavadora, bulldozer, motoniveladora, vibrocompactador, extendedora.',
  },
  {
    codigo: 'TE-02',
    nombre: 'Equipo especial',
    desc: 'Equipos de alta especialización: topografía, perforación HDD, vactor, soldadura, oxicorte. Se diferencian de maquinaria pesada por su tecnología específica.',
  },
  {
    codigo: 'TE-03',
    nombre: 'Equipo menor',
    desc: 'Equipos de apoyo sin tecnología especializada: andamios, mezcladora, motobomba, vibrador de concreto, generador, compresor, diferencial.',
  },
  {
    codigo: 'TE-04',
    nombre: 'Transporte',
    desc: 'Vehículos que movilizan material entre origen y obra: volquetas, carrotanque, bomba de concreto. Aparece en la Sección C del APU, no en la A.',
  },
  {
    codigo: 'TE-05',
    nombre: 'Herramienta menor',
    desc: 'Herramientas manuales o eléctricas portátiles: taladro, pulidora, tronzadora, cortadora de asfalto, guadañadora.',
  },
];

/** Tipos de unidad predefinidos para el selector al crear una unidad nueva (Longitud, Área, Volumen, Masa...). */
export const TIPOS_UNIDAD_PRE: string[] = [
  'General',
  'Longitud',
  'Área',
  'Volumen',
  'Masa',
  'Tiempo',
  'Conteo',
  'Global',
];

/** Categorías del catálogo de insumos (CI-01..CI-12): pétreos, concretos, metales, tubería de presión y alcantarillado, eléctricos... */
export const CATEGORIAS_INSUMO: ListaItem[] = [
  {
    codigo: 'CI-01',
    nombre: 'Pétreos',
    desc: 'Áridos: arena, gravilla, recebo, rajón, subbase, base granular.',
  },
  {
    codigo: 'CI-02',
    nombre: 'Concretos',
    desc: 'Cemento, morteros, concretos premezclados, cal, yeso, mezclas asfálticas.',
  },
  {
    codigo: 'CI-03',
    nombre: 'Metales',
    desc: 'Acero de refuerzo, perfiles, mallas, platinas, ángulos y alambre.',
  },
  {
    codigo: 'CI-04',
    nombre: 'Tub. Presión',
    desc: 'Tubería y accesorios a presión: PVC, CPVC, HDPE, galvanizado, cobre.',
  },
  {
    codigo: 'CI-05',
    nombre: 'Tub. Alcantarillado',
    desc: 'Tubería sanitaria: PVC, gres, concreto, HDPE corrugado.',
  },
  {
    codigo: 'CI-06',
    nombre: 'Eléctricos',
    desc: 'Conductores, conduit, tableros, luminarias y accesorios eléctricos.',
  },
  {
    codigo: 'CI-07',
    nombre: 'Madera',
    desc: 'Maderas aserradas, tableros y derivados para encofrado y estructura.',
  },
  {
    codigo: 'CI-08',
    nombre: 'Acabados',
    desc: 'Pinturas, enchapes, cerámicas, sanitarios, grifería y carpintería.',
  },
  {
    codigo: 'CI-09',
    nombre: 'Impermeabilizantes',
    desc: 'Membranas, geomembranas, geotextiles y sellantes hídricos.',
  },
  { codigo: 'CI-10', nombre: 'Aislantes', desc: 'Aislamiento térmico, acústico y cortafuego.' },
  {
    codigo: 'CI-11',
    nombre: 'Insumos Varios',
    desc: 'Señalización, mobiliario urbano y materiales de difícil clasificación.',
  },
  {
    codigo: 'CI-12',
    nombre: 'Consumibles',
    desc: 'Combustibles, gases industriales, lubricantes y aditivos generales.',
  },
];

/** Categorías de APU por capítulo de obra (CAT-01..CAT-23): preliminares, movimiento de tierras, redes, acabados... incluida "Preparado en Obra" para subproductos. */
export const CATEGORIAS_APU: ListaItem[] = [
  {
    codigo: 'CAT-01',
    categoria: 'Preliminares',
    desc: 'Obras previas al inicio de construcción. Localización, descapote, campamento, cerramiento provisional, demoliciones y retiro de escombros.',
  },
  {
    codigo: 'CAT-02',
    categoria: 'Concretos, morteros y pañetes',
    desc: 'Mezclas de cemento para elementos estructurales y de acabado. Concretos simples e impermeabilizados, morteros, grouting y pañetes.',
  },
  {
    codigo: 'CAT-03',
    categoria: 'Movimiento de tierras y excavaciones',
    desc: 'Cortes, rellenos, conformación de taludes y terraplenes. Excavación manual y a máquina en material común y en roca.',
  },
  {
    codigo: 'CAT-04',
    categoria: 'Cimentaciones',
    desc: 'Obras de soporte de la estructura: zapatas, pilotes, vigas de cimentación, losas de fundación, muros de contención y mejoramiento de suelos.',
  },
  {
    codigo: 'CAT-05',
    categoria: 'Estructuras en concreto',
    desc: 'Elementos estructurales vaciados in situ: columnas, vigas, losas, muros, escaleras, placa de contrapiso y acero de refuerzo.',
  },
  {
    codigo: 'CAT-06',
    categoria: 'Estructuras metálicas',
    desc: 'Estructura en perfiles laminados y tubería estructural. Cubiertas, escaleras, barandas, pasarelas y conexiones soldadas.',
  },
  {
    codigo: 'CAT-07',
    categoria: 'Mampostería y muros',
    desc: 'Sistemas de cerramiento y partición: ladrillo, bloque, fachaleta, columnetas, vigas de amarre y resanes.',
  },
  {
    codigo: 'CAT-08',
    categoria: 'Impermeabilizaciones',
    desc: 'Sistemas de protección hídrica: membranas asfálticas, geomembranas, morteros cristalizantes, sellantes y geotextiles de impermeabilización.',
  },
  {
    codigo: 'CAT-09',
    categoria: 'Red de acueducto',
    desc: 'Redes de distribución de agua potable: tubería a presión, válvulas, hidrantes, cámaras, medidores y acometidas domiciliarias.',
  },
  {
    codigo: 'CAT-10',
    categoria: 'Red de alcantarillado',
    desc: 'Redes de recolección sanitaria y pluvial: tubería PVC, concreto y HDPE, pozos, sumideros y conexiones domiciliarias.',
  },
  {
    codigo: 'CAT-11',
    categoria: 'Saneamiento básico',
    desc: 'Infraestructura de tratamiento: PTAP, PTAR, plantas de potabilización, torres de aireación, sistemas de desinfección y disposición final.',
  },
  {
    codigo: 'CAT-12',
    categoria: 'Obras de drenaje',
    desc: 'Manejo de aguas superficiales: canales revestidos, alcantarillas, box culvert, cunetas, filtros franceses y disipadores de energía.',
  },
  {
    codigo: 'CAT-13',
    categoria: 'Pavimentos y vías',
    desc: 'Infraestructura vial: subrasante, subbase, base granular, imprimación, mezcla asfáltica, adoquín y sello de fisuras.',
  },
  {
    codigo: 'CAT-14',
    categoria: 'Señalización y demarcación',
    desc: 'Señal vertical reglamentaria e informativa, demarcación horizontal, defensas viales, tachas y semaforización.',
  },
  {
    codigo: 'CAT-15',
    categoria: 'Instalaciones hidráulicas',
    desc: 'Redes internas de edificaciones: agua fría y caliente, sanitaria interior, aparatos sanitarios, grifería y tanques domésticos.',
  },
  {
    codigo: 'CAT-16',
    categoria: 'Instalaciones eléctricas',
    desc: 'Acometidas, tableros, canalizaciones EMT/PVC, cableado, salidas de luz, tomas, luminarias y sistema a tierra.',
  },
  {
    codigo: 'CAT-17',
    categoria: 'Instalaciones especiales',
    desc: 'Contraincendio (NFPA 13/20), gas domiciliario, voz y datos, CCTV, BMS y sistemas de detección de incendio.',
  },
  {
    codigo: 'CAT-18',
    categoria: 'Acabados',
    desc: 'Pañetes, enchapes, pisos, pinturas, cielos rasos, carpintería metálica y de madera, vidrios y puertas.',
  },
  {
    codigo: 'CAT-19',
    categoria: 'Cubiertas',
    desc: 'Cubierta en zinc, fibrocemento, termoacústica, impermeabilización de cubierta, canales y bajantes de aguas lluvias.',
  },
  {
    codigo: 'CAT-20',
    categoria: 'Urbanismo y espacio público',
    desc: 'Andenes, sardineles, rampas para discapacitados, zonas verdes, arborización, mobiliario urbano y cerramiento definitivo.',
  },
  {
    codigo: 'CAT-21',
    categoria: 'Obras de arte y especiales',
    desc: 'Puentes peatonales, muros gavión, bioingeniería, escolleras, geomallas, estructuras prefabricadas y micropilotes.',
  },
  {
    codigo: 'CAT-22',
    categoria: 'Gestión, HSE y administración',
    desc: 'Director y residente de obra, inspector HSE, plan de manejo ambiental, ensayos de laboratorio, transporte de personal y planos récord.',
  },
  {
    codigo: 'CAT-23',
    categoria: 'Preparado en Obra',
    desc: 'APU elaborados para actividades de preparación y optimización en sitio, como mezclas, vaciados preliminares, movilización de materiales, y otros procesos previos a la instalación definitiva.',
  },
];

/** Perfiles de país semilla: los MISMOS 6 del selector de civilflow. Vigencia = año de referencia de smmlv/iva (verificados 2026-11: Decreto 1469 de 2025 CO; DS 015-2026-TR PE; Min. Trabajo EC 2026; Ley 21.830 CL desde may-2026; resolución SMVM AR nov-2026; DS 5516 BO). iva_pct = tasa general vigente (Art. 468 ET CO; SUNAT PE; SRI EC; SII CL; AFIP AR; Ley 843 BO). */
const PAISES: Record<string, Omit<PerfilPais, 'codigo'>> = {
  CO: {
    nombre: 'Colombia',
    moneda: 'COP',
    smmlv: 1750905,
    vigencia: 2026,
    iva_pct: 19,
    dias_mes: 25,
    horas_mes: 182,
    unidad: 'mes',
  },
  PE: {
    nombre: 'Perú',
    moneda: 'PEN',
    smmlv: 1230,
    vigencia: 2026,
    iva_pct: 18,
    dias_mes: 30,
    horas_mes: 240,
    unidad: 'mes',
  },
  EC: {
    nombre: 'Ecuador',
    moneda: 'USD',
    smmlv: 482,
    vigencia: 2026,
    iva_pct: 15,
    dias_mes: 30,
    horas_mes: 240,
    unidad: 'mes',
  },
  CL: {
    nombre: 'Chile',
    moneda: 'CLP',
    smmlv: 553553,
    vigencia: 2026,
    iva_pct: 19,
    dias_mes: 30,
    horas_mes: 225,
    unidad: 'mes',
  },
  AR: {
    nombre: 'Argentina',
    moneda: 'ARS',
    smmlv: 398800,
    vigencia: 2026,
    iva_pct: 21,
    dias_mes: 30,
    horas_mes: 240,
    unidad: 'mes',
  },
  BO: {
    nombre: 'Bolivia',
    moneda: 'BOB',
    smmlv: 3300,
    vigencia: 2026,
    iva_pct: 13,
    dias_mes: 30,
    horas_mes: 240,
    unidad: 'mes',
  },
};

/** Genera los perfiles de país semilla (6 países: moneda, salario mínimo, IVA, días/horas mes, mes vs hora). Copia fresca en cada llamada para no compartir referencias. */
export function perfilesPaisDefault(): PerfilPais[] {
  return Object.entries(PAISES).map(([codigo, p]) => ({ codigo, ...p }));
}

/** Perfil de un país buscado en la lista EDITADA por el usuario; si falta cae al semilla y de último a Colombia. Ej: getPaisData('US', ...) -> unidad 'hora'. */
export function getPaisData(codigo: string, perfilesPais?: PerfilPais[]): PerfilPais {
  const found = perfilesPais?.find((p) => p.codigo === codigo);
  if (found) return found;
  const base = PAISES[codigo] || PAISES.CO;
  return { codigo: codigo in PAISES ? codigo : 'CO', ...base };
}

/** Ayudas por defecto que la hoja de APU muestra junto a cada campo (tipo de salario, FP, herramienta menor, AIU...). */
export const COMENTARIOS_APU_DEFAULTS = {
  tipo_salario: 'Definir entre JORNAL/DIA o HH.',
  factor_prest: 'Valor Obtenido en Modulo Categorias',
  costo_personal_fp:
    'Si elije NO, el F.P. se incrusta en el costo unitario del personal. Si elije SI, el F.P. se calcula al final',
  herramienta_menor: 'Definir el valor a establecer, si elije Cero no se presenta en el APU',
  administracion: 'Esta asociado a los gastos de Administracion del proyecto',
  imprevistos: 'Es un valor establecido segun los riesgos de cada proyecto',
  utilidad: 'Establece un porcentaje de Utilidad estimado para el proyecto',
  vr_resumido: 'Establece si cuando se aplica el AIU, se discrimina o NO.',
  usar_en_cada_apu: 'Si se usa en cada APU o al final en el presupuesto aplica',
};

/** Código del próximo cargo creado: MO-001, MO-002... (índice 0 -> 'MO-001'). */
export function cargoCodigoDefault(index: number): string {
  return 'MO-' + String(index + 1).padStart(3, '0');
}
