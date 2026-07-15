import type { FactorPrestacional, ListaItem, PerfilPais, UnidadMedida } from './types';

export const PREST_DEFAULTS: Omit<FactorPrestacional, 'id'>[] = [
  { codigo: 'FP-001', nombre: 'Subsidio de transporte', factor: 14.23, tipo: 'prestaciones' },
  { codigo: 'FP-002', nombre: 'Cesantías / Indemnización anual', factor: 8.33, tipo: 'prestaciones' },
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
  { codigo: 'FP-013', nombre: 'FIC (industria de la construcción)', factor: 2.5, tipo: 'parafiscales' },
  { codigo: 'FP-014', nombre: 'Horas extras (provisión)', factor: 2, tipo: 'otros' },
  { codigo: 'FP-015', nombre: 'Permisos / Ausentismo (provisión)', factor: 1, tipo: 'otros' },
  { codigo: 'FP-016', nombre: 'Otros auxilios', factor: 0, tipo: 'otros' },
];

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

export const ORIGENES: ListaItem[] = [
  { codigo: 'OR-01', nombre: 'Local', desc: 'Insumo adquirido a proveedor local (mismo municipio o área metropolitana). Precio viene del catálogo de insumos.' },
  { codigo: 'OR-02', nombre: 'Nacional', desc: 'Insumo adquirido a proveedor en otra ciudad del país. Puede implicar costo de transporte adicional.' },
  { codigo: 'OR-03', nombre: 'Importado', desc: 'Insumo de origen extranjero. Puede incluir aranceles, flete internacional y nacionalización.' },
  { codigo: 'OR-04', nombre: 'Preparado en obra', desc: 'El insumo resulta de otro APU (ej: concreto mezclado en sitio, mortero, mezcla asfáltica). El precio = costo total del APU de referencia seleccionado.' },
];

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

export const TRANSP_UNIDADES: ListaItem[] = [
  { codigo: 'UT-01', nombre: 'Hasta la Obra', desc: 'Flete completo hasta el sitio de obra' },
  { codigo: 'UT-02', nombre: 'Acarreo Interno', desc: 'Movimiento de material dentro de la obra' },
  { codigo: 'UT-03', nombre: 'Global', desc: 'Tarifa fija por el servicio completo' },
  { codigo: 'UT-04', nombre: 'M3', desc: 'Por volumen de material transportado' },
  { codigo: 'UT-05', nombre: 'Kg', desc: 'Por peso de material transportado' },
  { codigo: 'UT-06', nombre: 'M3-Km', desc: 'Por volumen y distancia recorrida' },
  { codigo: 'UT-07', nombre: 'Ton-Km', desc: 'Por peso y distancia recorrida' },
];

export const TIPO_EQUIPO: ListaItem[] = [
  { codigo: 'TE-01', nombre: 'Maquinaria pesada', desc: 'Equipos de movimiento de tierra, excavación, compactación y pavimentación. Ej: retroexcavadora, bulldozer, motoniveladora, vibrocompactador, extendedora.' },
  { codigo: 'TE-02', nombre: 'Equipo especial', desc: 'Equipos de alta especialización: topografía, perforación HDD, vactor, soldadura, oxicorte. Se diferencian de maquinaria pesada por su tecnología específica.' },
  { codigo: 'TE-03', nombre: 'Equipo menor', desc: 'Equipos de apoyo sin tecnología especializada: andamios, mezcladora, motobomba, vibrador de concreto, generador, compresor, diferencial.' },
  { codigo: 'TE-04', nombre: 'Transporte', desc: 'Vehículos que movilizan material entre origen y obra: volquetas, carrotanque, bomba de concreto. Aparece en la Sección C del APU, no en la A.' },
  { codigo: 'TE-05', nombre: 'Herramienta menor', desc: 'Herramientas manuales o eléctricas portátiles: taladro, pulidora, tronzadora, cortadora de asfalto, guadañadora.' },
];

export const TIPOS_UNIDAD_PRE: string[] = ['General', 'Longitud', 'Área', 'Volumen', 'Masa', 'Tiempo', 'Conteo', 'Global'];

export const CATEGORIAS_INSUMO: ListaItem[] = [
  { codigo: 'CI-01', nombre: 'Pétreos', desc: 'Áridos: arena, gravilla, recebo, rajón, subbase, base granular.' },
  { codigo: 'CI-02', nombre: 'Concretos', desc: 'Cemento, morteros, concretos premezclados, cal, yeso, mezclas asfálticas.' },
  { codigo: 'CI-03', nombre: 'Metales', desc: 'Acero de refuerzo, perfiles, mallas, platinas, ángulos y alambre.' },
  { codigo: 'CI-04', nombre: 'Tub. Presión', desc: 'Tubería y accesorios a presión: PVC, CPVC, HDPE, galvanizado, cobre.' },
  { codigo: 'CI-05', nombre: 'Tub. Alcantarillado', desc: 'Tubería sanitaria: PVC, gres, concreto, HDPE corrugado.' },
  { codigo: 'CI-06', nombre: 'Eléctricos', desc: 'Conductores, conduit, tableros, luminarias y accesorios eléctricos.' },
  { codigo: 'CI-07', nombre: 'Madera', desc: 'Maderas aserradas, tableros y derivados para encofrado y estructura.' },
  { codigo: 'CI-08', nombre: 'Acabados', desc: 'Pinturas, enchapes, cerámicas, sanitarios, grifería y carpintería.' },
  { codigo: 'CI-09', nombre: 'Impermeabilizantes', desc: 'Membranas, geomembranas, geotextiles y sellantes hídricos.' },
  { codigo: 'CI-10', nombre: 'Aislantes', desc: 'Aislamiento térmico, acústico y cortafuego.' },
  { codigo: 'CI-11', nombre: 'Insumos Varios', desc: 'Señalización, mobiliario urbano y materiales de difícil clasificación.' },
  { codigo: 'CI-12', nombre: 'Consumibles', desc: 'Combustibles, gases industriales, lubricantes y aditivos generales.' },
];

export const CATEGORIAS_APU: ListaItem[] = [
  { codigo: 'CAT-01', categoria: 'Preliminares', desc: 'Obras previas al inicio de construcción. Localización, descapote, campamento, cerramiento provisional, demoliciones y retiro de escombros.' },
  { codigo: 'CAT-02', categoria: 'Concretos, morteros y pañetes', desc: 'Mezclas de cemento para elementos estructurales y de acabado. Concretos simples e impermeabilizados, morteros, grouting y pañetes.' },
  { codigo: 'CAT-03', categoria: 'Movimiento de tierras y excavaciones', desc: 'Cortes, rellenos, conformación de taludes y terraplenes. Excavación manual y a máquina en material común y en roca.' },
  { codigo: 'CAT-04', categoria: 'Cimentaciones', desc: 'Obras de soporte de la estructura: zapatas, pilotes, vigas de cimentación, losas de fundación, muros de contención y mejoramiento de suelos.' },
  { codigo: 'CAT-05', categoria: 'Estructuras en concreto', desc: 'Elementos estructurales vaciados in situ: columnas, vigas, losas, muros, escaleras, placa de contrapiso y acero de refuerzo.' },
  { codigo: 'CAT-06', categoria: 'Estructuras metálicas', desc: 'Estructura en perfiles laminados y tubería estructural. Cubiertas, escaleras, barandas, pasarelas y conexiones soldadas.' },
  { codigo: 'CAT-07', categoria: 'Mampostería y muros', desc: 'Sistemas de cerramiento y partición: ladrillo, bloque, fachaleta, columnetas, vigas de amarre y resanes.' },
  { codigo: 'CAT-08', categoria: 'Impermeabilizaciones', desc: 'Sistemas de protección hídrica: membranas asfálticas, geomembranas, morteros cristalizantes, sellantes y geotextiles de impermeabilización.' },
  { codigo: 'CAT-09', categoria: 'Red de acueducto', desc: 'Redes de distribución de agua potable: tubería a presión, válvulas, hidrantes, cámaras, medidores y acometidas domiciliarias.' },
  { codigo: 'CAT-10', categoria: 'Red de alcantarillado', desc: 'Redes de recolección sanitaria y pluvial: tubería PVC, concreto y HDPE, pozos, sumideros y conexiones domiciliarias.' },
  { codigo: 'CAT-11', categoria: 'Saneamiento básico', desc: 'Infraestructura de tratamiento: PTAP, PTAR, plantas de potabilización, torres de aireación, sistemas de desinfección y disposición final.' },
  { codigo: 'CAT-12', categoria: 'Obras de drenaje', desc: 'Manejo de aguas superficiales: canales revestidos, alcantarillas, box culvert, cunetas, filtros franceses y disipadores de energía.' },
  { codigo: 'CAT-13', categoria: 'Pavimentos y vías', desc: 'Infraestructura vial: subrasante, subbase, base granular, imprimación, mezcla asfáltica, adoquín y sello de fisuras.' },
  { codigo: 'CAT-14', categoria: 'Señalización y demarcación', desc: 'Señal vertical reglamentaria e informativa, demarcación horizontal, defensas viales, tachas y semaforización.' },
  { codigo: 'CAT-15', categoria: 'Instalaciones hidráulicas', desc: 'Redes internas de edificaciones: agua fría y caliente, sanitaria interior, aparatos sanitarios, grifería y tanques domésticos.' },
  { codigo: 'CAT-16', categoria: 'Instalaciones eléctricas', desc: 'Acometidas, tableros, canalizaciones EMT/PVC, cableado, salidas de luz, tomas, luminarias y sistema a tierra.' },
  { codigo: 'CAT-17', categoria: 'Instalaciones especiales', desc: 'Contraincendio (NFPA 13/20), gas domiciliario, voz y datos, CCTV, BMS y sistemas de detección de incendio.' },
  { codigo: 'CAT-18', categoria: 'Acabados', desc: 'Pañetes, enchapes, pisos, pinturas, cielos rasos, carpintería metálica y de madera, vidrios y puertas.' },
  { codigo: 'CAT-19', categoria: 'Cubiertas', desc: 'Cubierta en zinc, fibrocemento, termoacústica, impermeabilización de cubierta, canales y bajantes de aguas lluvias.' },
  { codigo: 'CAT-20', categoria: 'Urbanismo y espacio público', desc: 'Andenes, sardineles, rampas para discapacitados, zonas verdes, arborización, mobiliario urbano y cerramiento definitivo.' },
  { codigo: 'CAT-21', categoria: 'Obras de arte y especiales', desc: 'Puentes peatonales, muros gavión, bioingeniería, escolleras, geomallas, estructuras prefabricadas y micropilotes.' },
  { codigo: 'CAT-22', categoria: 'Gestión, HSE y administración', desc: 'Director y residente de obra, inspector HSE, plan de manejo ambiental, ensayos de laboratorio, transporte de personal y planos récord.' },
  { codigo: 'CAT-23', categoria: 'Preparado en Obra', desc: 'APU elaborados para actividades de preparación y optimización en sitio, como mezclas, vaciados preliminares, movilización de materiales, y otros procesos previos a la instalación definitiva.' },
];

export const PAISES: Record<string, Omit<PerfilPais, 'codigo'>> = {
  CO: { nombre: 'Colombia', moneda: 'COP', smmlv: 1750905, tope_ibc_mult: 2, auxilio_transporte: 147674, dias_mes: 25, horas_mes: 182, unidad: 'mes' },
  MX: { nombre: 'México', moneda: 'MXN', smmlv: 9582, tope_ibc_mult: 0, auxilio_transporte: 0, dias_mes: 30, horas_mes: 240, unidad: 'mes' },
  PE: { nombre: 'Perú', moneda: 'PEN', smmlv: 1130, tope_ibc_mult: 0, auxilio_transporte: 0, dias_mes: 30, horas_mes: 240, unidad: 'mes' },
  CL: { nombre: 'Chile', moneda: 'CLP', smmlv: 539000, tope_ibc_mult: 0, auxilio_transporte: 0, dias_mes: 30, horas_mes: 225, unidad: 'mes' },
  AR: { nombre: 'Argentina', moneda: 'ARS', smmlv: 341000, tope_ibc_mult: 0, auxilio_transporte: 0, dias_mes: 30, horas_mes: 240, unidad: 'mes' },
  EC: { nombre: 'Ecuador', moneda: 'USD', smmlv: 482, tope_ibc_mult: 0, auxilio_transporte: 0, dias_mes: 30, horas_mes: 240, unidad: 'mes' },
  VE: { nombre: 'Venezuela', moneda: 'VES', smmlv: 130, tope_ibc_mult: 0, auxilio_transporte: 0, dias_mes: 30, horas_mes: 220, unidad: 'mes' },
  BO: { nombre: 'Bolivia', moneda: 'BOB', smmlv: 3300, tope_ibc_mult: 0, auxilio_transporte: 0, dias_mes: 30, horas_mes: 240, unidad: 'mes' },
  PY: { nombre: 'Paraguay', moneda: 'PYG', smmlv: 2899048, tope_ibc_mult: 0, auxilio_transporte: 0, dias_mes: 30, horas_mes: 240, unidad: 'mes' },
  UY: { nombre: 'Uruguay', moneda: 'UYU', smmlv: 24572, tope_ibc_mult: 0, auxilio_transporte: 0, dias_mes: 30, horas_mes: 220, unidad: 'mes' },
  BR: { nombre: 'Brasil', moneda: 'BRL', smmlv: 1621, tope_ibc_mult: 0, auxilio_transporte: 0, dias_mes: 30, horas_mes: 240, unidad: 'mes' },
  CR: { nombre: 'Costa Rica', moneda: 'CRC', smmlv: 373092, tope_ibc_mult: 0, auxilio_transporte: 0, dias_mes: 30, horas_mes: 240, unidad: 'mes' },
  PA: { nombre: 'Panamá', moneda: 'PAB', smmlv: 637, tope_ibc_mult: 0, auxilio_transporte: 0, dias_mes: 30, horas_mes: 240, unidad: 'mes' },
  GT: { nombre: 'Guatemala', moneda: 'GTQ', smmlv: 4002, tope_ibc_mult: 0, auxilio_transporte: 0, dias_mes: 30, horas_mes: 240, unidad: 'mes' },
  HN: { nombre: 'Honduras', moneda: 'HNL', smmlv: 12930, tope_ibc_mult: 0, auxilio_transporte: 0, dias_mes: 30, horas_mes: 220, unidad: 'mes' },
  SV: { nombre: 'El Salvador', moneda: 'USD', smmlv: 409, tope_ibc_mult: 0, auxilio_transporte: 0, dias_mes: 30, horas_mes: 220, unidad: 'mes' },
  NI: { nombre: 'Nicaragua', moneda: 'NIO', smmlv: 5950, tope_ibc_mult: 0, auxilio_transporte: 0, dias_mes: 30, horas_mes: 240, unidad: 'mes' },
  DO: { nombre: 'Rep. Dominicana', moneda: 'DOP', smmlv: 16993, tope_ibc_mult: 0, auxilio_transporte: 0, dias_mes: 30, horas_mes: 220, unidad: 'mes' },
  CU: { nombre: 'Cuba', moneda: 'CUP', smmlv: 2100, tope_ibc_mult: 0, auxilio_transporte: 0, dias_mes: 30, horas_mes: 220, unidad: 'mes' },
  US: { nombre: 'Estados Unidos', moneda: 'USD', smmlv: 7.25, tope_ibc_mult: 0, auxilio_transporte: 0, dias_mes: 30, horas_mes: 200, unidad: 'hora' },
  ES: { nombre: 'España', moneda: 'EUR', smmlv: 1184, tope_ibc_mult: 0, auxilio_transporte: 0, dias_mes: 30, horas_mes: 173, unidad: 'mes' },
  DE: { nombre: 'Alemania', moneda: 'EUR', smmlv: 1241, tope_ibc_mult: 0, auxilio_transporte: 0, dias_mes: 30, horas_mes: 173, unidad: 'mes' },
  FR: { nombre: 'Francia', moneda: 'EUR', smmlv: 1188, tope_ibc_mult: 0, auxilio_transporte: 0, dias_mes: 30, horas_mes: 150, unidad: 'mes' },
  GB: { nombre: 'Reino Unido', moneda: 'GBP', smmlv: 11.44, tope_ibc_mult: 0, auxilio_transporte: 0, dias_mes: 30, horas_mes: 150, unidad: 'hora' },
  IT: { nombre: 'Italia', moneda: 'EUR', smmlv: 1184, tope_ibc_mult: 0, auxilio_transporte: 0, dias_mes: 30, horas_mes: 173, unidad: 'mes' },
  PT: { nombre: 'Portugal', moneda: 'EUR', smmlv: 820, tope_ibc_mult: 0, auxilio_transporte: 0, dias_mes: 30, horas_mes: 173, unidad: 'mes' },
  JP: { nombre: 'Japón', moneda: 'JPY', smmlv: 1004, tope_ibc_mult: 0, auxilio_transporte: 0, dias_mes: 30, horas_mes: 173, unidad: 'hora' },
  CN: { nombre: 'China', moneda: 'CNY', smmlv: 2420, tope_ibc_mult: 0, auxilio_transporte: 0, dias_mes: 30, horas_mes: 173, unidad: 'mes' },
  IN: { nombre: 'India', moneda: 'INR', smmlv: 17892, tope_ibc_mult: 0, auxilio_transporte: 0, dias_mes: 30, horas_mes: 192, unidad: 'mes' },
  AU: { nombre: 'Australia', moneda: 'AUD', smmlv: 24.1, tope_ibc_mult: 0, auxilio_transporte: 0, dias_mes: 30, horas_mes: 173, unidad: 'hora' },
  CA: { nombre: 'Canadá', moneda: 'CAD', smmlv: 17.3, tope_ibc_mult: 0, auxilio_transporte: 0, dias_mes: 30, horas_mes: 173, unidad: 'hora' },
};

export function perfilesPaisDefault(): PerfilPais[] {
  return Object.entries(PAISES).map(([codigo, p]) => ({ codigo, ...p }));
}

export function getPaisData(codigo: string, perfilesPais?: PerfilPais[]): PerfilPais {
  const found = perfilesPais?.find(p => p.codigo === codigo);
  if (found) return found;
  const base = PAISES[codigo] || PAISES.CO;
  return { codigo: codigo in PAISES ? codigo : 'CO', ...base };
}

export const COMENTARIOS_APU_DEFAULTS = {
  tipo_salario: 'Definir entre JORNAL/DIA o HH.',
  factor_prest: 'Valor Obtenido en Modulo Categorias',
  costo_personal_fp: 'Si elije NO, el F.P. se incrusta en el costo unitario del personal. Si elije SI, el F.P. se calcula al final',
  herramienta_menor: 'Definir el valor a establecer, si elije Cero no se presenta en el APU',
  administracion: 'Esta asociado a los gastos de Administracion del proyecto',
  imprevistos: 'Es un valor establecido segun los riesgos de cada proyecto',
  utilidad: 'Establece un porcentaje de Utilidad estimado para el proyecto',
  vr_resumido: 'Establece si cuando se aplica el AIU, se discrimina o NO.',
  usar_en_cada_apu: 'Si se usa en cada APU o al final en el presupuesto aplica',
};

export function cargoCodigoDefault(index: number): string {
  return 'MO-' + String(index + 1).padStart(3, '0');
}
