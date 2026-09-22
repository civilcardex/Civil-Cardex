// Datos del visor 3D "Cuarto de Bombas RCI" — extraídos verbatim del HTML standalone
// (RCI CIVILCARDEX SEP 17 2026). Sin dependencias de three: las posiciones de etiquetas son
// tuplas [x,y,z] en metros (el hook las convierte a Vector3).

// Constantes compartidas del módulo rci3d: ahora viven en shared/config3d (junto a las de
// aparatos/epc) y aquí solo se re-nombran para no tocar los consumidores.
export { MONO_3D as RCI_MONO, FOV_3D as RCI_FOV } from '../shared/config3d';

export interface RciComponente {
  id: number;
  name: string;
  modelKey: string | null;
  color: string;
}

export interface RciCompDesc {
  body: string;
  norm: string;
}

export interface RciLabelPos {
  pos: [number, number, number];
  scale: number;
  /** 0: círculo a la derecha | 1: a la izquierda. */
  dir: 0 | 1;
  /** Inclinación del segmento con flecha (grados desde la vertical). */
  ang: number;
  L1: number;
  L2: number;
  /** Sub-etiquetas ("2b") dibujan el número del componente padre. */
  ref?: number;
}

export const COMPONENTS: RciComponente[] = [
  { id: 1, name: 'Bomba Principal 4"x4"', modelKey: 'bomba', color: '#007fff' },
  { id: 2, name: 'Junta antivibratoria', modelKey: null, color: '#7d8590' },
  { id: 3, name: 'Tuberia succion 4" A.C. SCH-10', modelKey: 'succion_ppal', color: '#f85149' },
  { id: 4, name: 'Valvula de pie 4"', modelKey: null, color: '#f85149' },
  { id: 5, name: 'Valvula cheque 4"', modelKey: null, color: '#f85149' },
  { id: 6, name: 'Valvula de cortina 4"', modelKey: null, color: '#f85149' },
  { id: 7, name: 'Manometro de Glicerina', modelKey: null, color: '#7d8590' },
  { id: 8, name: 'Siamesa 4"x2-1/2"', modelKey: 'siamesa', color: '#f0a830' },
  { id: 9, name: 'Sensor de flujo', modelKey: null, color: '#7d8590' },
  { id: 10, name: 'Presostato', modelKey: null, color: '#7d8590' },
  { id: 11, name: 'Tuberia descarga 4" A.C. SCH-10', modelKey: 'descarga', color: '#f85149' },
  { id: 12, name: 'Valvula de mariposa 4"', modelKey: null, color: '#f85149' },
  { id: 13, name: 'Valvula de alivio', modelKey: null, color: '#f85149' },
  { id: 14, name: 'Cabezal de pruebas', modelKey: 'banco_pruebas', color: '#f0a830' },
  { id: 15, name: 'Bomba Jockey 2"x2"', modelKey: 'bomba_jockey', color: '#388bfd' },
  { id: 16, name: 'Registro de corte 2"', modelKey: null, color: '#f85149' },
  { id: 17, name: 'Valvula cheque 2"', modelKey: null, color: '#f85149' },
  { id: 18, name: 'Tuberia succion 2" A.C. SCH-10', modelKey: 'succion_jockey', color: '#f85149' },
  { id: 19, name: 'Valvula de pie 2"', modelKey: null, color: '#f85149' },
  { id: 20, name: 'Tablero electrico', modelKey: 'tablero_piso', color: '#3fb950' },
  { id: 21, name: 'Tablero de control', modelKey: 'tablero_pared', color: '#3fb950' },
  { id: 22, name: 'Sirena', modelKey: null, color: '#f0a830' },
  { id: 23, name: 'Tuberia drenaje 2" A.C. SCH-10', modelKey: 'recirculacion', color: '#f85149' },
];

export const COMP_DESC: Record<number, RciCompDesc> = {
  1: {
    body: 'Bomba centrifuga contra incendio listada que aporta el 100 % del caudal y de la presión de diseño de la red. Se selecciona con base en la demanda hidráulica del sistema, NPSH disponible y fuente de energía, según requerimiento de Norma.',
    norm: 'NFPA 20 cap.6-8 (curva 0/100/150) / NSR-10 Titulo J',
  },
  2: {
    body: 'Conexión flexible listada en succión y descarga que absorbe vibraciones del conjunto motor-bomba, compensa desalineaciones y minimiza la transmisión de esfuerzos dinámicos a la tubería.',
    norm: 'NFPA 20 cap.4 (conexiones flexibles) / NFPA 25 (ITM)',
  },
  3: {
    body: 'Tramo de succión en acero al carbono SCH-10 listado. Diámetro igual o mayor al puerto de succión; velocidad máxima recomendada 3.0 m/s para limitar perdidas de carga y preservar NPSH disponible. Reducción excéntrica con cara plana hacia arriba, soporte cerca de la bomba y placa anti-vortice en el tanque.',
    norm: 'NFPA 20 cap.4-5 / NTC 5562 (ASTM A795) / NSR-10 J.2.4.8',
  },
  4: {
    body: 'Válvula de retención con colador y base, ubicada al inicio de la línea de succión dentro del tanque: mantiene la línea cebada, impide el retorno al tanque y actúa como filtro grueso de sólidos. Área de rozadura del colador mínimo 2 áreas del tubo para limitar la perdida de carga.',
    norm: 'NFPA 20 cap.5 (foot valve/strainer) / NTC 1669',
  },
  5: {
    body: 'Válvula de retención listada en la descarga de la bomba principal: impide el flujo inverso cuando la bomba está detenida y protege el rodete de golpes de ariete. Instalación vertical u horizontal según el montaje.',
    norm: 'NFPA 20 cap.4 (check valves) / NTC 1669',
  },
  6: {
    body: 'Válvula OS&Y (poste indicador) supervisada eléctricamente: permite aislar la bomba para mantenimiento sin interrumpir el suministro a la red. Se instala y supervisa abierta; posición abierta reportada al panel de supervisión.',
    norm: 'NFPA 20 cap.4 (valvulas supervisadas) / NTC 1669',
  },
  7: {
    body: 'Manómetro con caratula mínima 3.5 in (90 mm), rango del doble de la presión normal de trabajo y relleno de glicerina para amortiguar vibración; se instalan en succión y en descarga con válvula de cierre y sifón para lectura estable.',
    norm: 'NFPA 20 cap.4 (manometros, rango 2x, glicerina) / NSR-10 Titulo J',
  },
  8: {
    body: 'Conexión de fachada (FDC) 4x2-1/2 con dos salidas de 2-1/2 con válvula check interna y tapas: permite a los carros de bomberos presurizar la red desde el exterior. Debe ser accesible, señalada y lejos de obstáculos; conectada a la válvula de cheque del sistema.',
    norm: 'NFPA 14 7.2 (FDC) / NTC 1669 / NSR-10 J.4.3',
  },
  9: {
    body: 'Interruptor de flujo (tipo paleta) instalado en la tubería: detecta circulación y envía señal al tablero de control para registro de evento y alarmas. Con retardo ajustable típico de 30-60 s para no activar por transitorios de arranque de bomba.',
    norm: 'NFPA 13 (waterflow switch) / NFPA 72 / NTC 2301',
  },
  10: {
    body: 'Interruptor de presión cuyo contacto ordena el arranque automático de la bomba cuando la presión del sistema cae al punto de ajuste. Setpoint típico: arranca por debajo del punto de paro de la bomba jockey para que la principal solo arranque ante caídas reales de presión. Contacto supervisado por el controlador.',
    norm: 'NFPA 20 cap.10 (arranque automatico) / RETIE',
  },
  11: {
    body: 'Tramo vertical de descarga de la bomba principal hacia el colector de la red. Flujo ascendente con válvula supervisada de descarga, manómetros y válvula de alivio cercanas a la salida de la bomba: velocidad máxima recomendada 3.0 m/s para limitar fuerzas y golpe de ariete.',
    norm: 'NFPA 20 cap.4-5 / NTC 5562 (ASTM A795) / NSR-10 J.2.4.8',
  },
  12: {
    body: 'Válvula de mariposa listada (UL 1091/FM) con indicador de posición y supervisión eléctrica: usada en descarga para aislar secciones de la red. La supervisión de posición abierta/cerrada se reporta al panel de alarma de incendio.',
    norm: 'NFPA 20 cap.4 / NFPA 13 (supervisadas) / NSR-10 J.2.4.8',
  },
  13: {
    body: 'Válvula de seguridad tipo resorte (relief valve) que libera presión del sistema cuando excede el diseño admisible, protegiendo tubería y accesorios cuando la presión de cierre (Churn) y la presión estática de red superan el margen de diseño.',
    norm: 'NFPA 20 cap.4 (relief valve) / NSR-10 Titulo J',
  },
  14: {
    body: 'Conjunto de válvulas de 2-1/2 (con medidor de caudal o boquilla tipo playpipe y acoples de manguera) que permite medir la curva 0/100/150% de la bomba sin activar la red; la descarga de la prueba se hace al tanque o al dren colocado con medio de descarga aprobado.',
    norm: 'NFPA 20 cap.4 (test header) / NFPA 25 (prueba anual de flujo)',
  },
  15: {
    body: 'Bomba compacta de mantenimiento de presión: compensa microfugas de la red para evitar arranques innecesarios de la principal. Caudal de practica típico del orden del 1 % del caudal de la principal (o mínimo 1 gpm por punto de fuga admisible).',
    norm: 'NFPA 20 cap.4 (jockey) / NSR-10 Titulo J',
  },
  16: {
    body: 'Válvula de cierre listada en la succión de la bomba jockey para aislamiento integral de la unidad durante mantenimiento o reemplazo, sin afectar la bomba principal.',
    norm: 'NFPA 20 cap.4 (aislamiento) / NTC 1669',
  },
  17: {
    body: 'Válvula de retención en la descarga de la bomba jockey: impide el flujo inverso a la bomba cuando esta inactiva y evita que la principal quede presurizando la descarga de la bomba jockey.',
    norm: 'NFPA 20 cap.4 (check valves) / NTC 1669',
  },
  18: {
    body: 'Línea de succión de la bomba jockey en acero al carbono SCH-10 con válvula y pie con colador; con diametro acorde al caudal de la junta, preservando NPSH disponible y perdidas admisibles en tramos cortos.',
    norm: 'NFPA 20 cap.4-5 / NTC 5562 (ASTM A795)',
  },
  19: {
    body: 'Válvula de retención con colador en la succión de la bomba jockey: mantiene el cebado de la línea e impide el retorno de agua al tanque cuando la bomba jockey no opera.',
    norm: 'NFPA 20 cap.5 (foot valve/strainer) / NTC 1669',
  },
  20: {
    body: 'Centro de control de motor (CCM) dedicado a la bomba principal: protecciones de alimentación, arranque automático y manual, detección de inversión de fase y caída de tensión. Controlador listado (UL 2181/FM) con operación automática por presostato y transferencia de energía.',
    norm: 'NFPA 20 cap.10 (controller UL 2181/FM) / RETIE / NTC 2050',
  },
  21: {
    body: 'Controlador listado que supervisa todo el sistema de bombeo: ordena el arranque automático de las bombas por caída de presión (señal del presostato), alterna/rearma bombas, registra eventos de arranque, paro y fallas, activa las señales luminosas y audibles (giro de motor, compañía en línea, motor sin rotación, sobrecarga), y permite operación manual local y remota de emergencia. La bomba jockey queda interrumpida por set-point diferencial para no discontinuar la principal.',
    norm: 'NFPA 20 cap.10 (listed controller) / RETIE',
  },
  22: {
    body: 'Dispositivo de aviso sonoro (bell/sirena) del cuarto de bombas: activado por el tablero en condiciones de falla o funcionamiento, dimensionado para ser audible en el cuarto de bombas y áreas adyacentes.',
    norm: 'NFPA 72 cap.18 (aviso sonoro) / NSR-10 J.4.2',
  },
  23: {
    body: 'Tubería de drenaje para pruebas periódicas y descargas del cuarto de bombas: permite vaciar la red para inspección, pruebas hidrostáticas/circuito de la prueba anual. Debe descargar a lugar seguro (tanque o drenaje pluvial), sin riesgo de inundación ni contaminación cruzada.',
    norm: 'NFPA 20 cap.5 (drenajes) / NFPA 25 (pruebas) / NSR-10 J.2.4.8',
  },
};

export const NOTA_NORMATIVA =
  'El presente detalle es una representación técnica de referencia elaborada con base en las normas NFPA 20:2025 y NSR-10 Titulo J (Colombia). Las descripciones provienen de la revisión de la base normativa internacional (NFPA 20/13/14/22/25/72 con sus numerales) y de su adaptación nacional (NTC 1669, NTC 2301, NTC 2050, RETIE, Decreto 0926/2010). Es responsabilidad del diseñador revisar y hacer los ajustes según la respectiva norma vigente. El presente esquema y sus descripciones NO sustituyen las normas oficiales; su propósito es servir de guía para robustecer las descripciones del visor CIVILCARDEX.';

/** Posición de montaje de cada pieza GLB (metros). */
export const GLB_POSITIONS: Record<string, [number, number, number]> = {
  tanque: [-2.126, -2.513, -0.369],
  mamposteria: [-2.13, 0.24, -0.37],
  bomba_jockey: [-2.31, -1.255, 0.132],
  succion_ppal: [-0.979, -2.047, -0.099],
  recirculacion: [-2.9, -0.4, 0.8],
  bomba: [-0.709, -1.248, -0.24],
  siamesa: [-0.001, 0.151, -0.001],
  tablero_pared: [-1.1, 0.15, -1.454],
  tablero_piso: [-4.277, -0.408, -1.396],
  succion_jockey: [-2.09, -1.099, 0.505],
  tapa_tanque: [-2.13, -1.25, -0.367],
  banco_pruebas: [-2.163, -0.086, -1.226],
  descarga: [-1.933, 0.868, 0.01],
};

/** Orden de carga (el mismo del HTML): pieza a pieza con pausa para no congelar el browser. */
export const MODELO_KEYS = Object.keys(GLB_POSITIONS);

/** Grupos cuyos vértices blanco/gris-claro se recolorean a rojo (válvulas de cheque). */
export const CHEQUE_GROUPS = [
  'succion_jockey',
  'banco_pruebas',
  'descarga',
  'succion_ppal',
  'recirculacion',
];

/** Anclas de las etiquetas numeradas con su geometría de línea guía. */
export const LABEL_POSITIONS: Record<string, RciLabelPos> = {
  1: { pos: [0.135, -0.83, -0.09], scale: 0.75, dir: 0, ang: 0, L1: 25, L2: 30 },
  2: { pos: [-0.655, -0.85, -0.09], scale: 0.75, dir: 0, ang: 0, L1: 25, L2: 40 },
  3: { pos: [-0.848, -0.9, -0.1], scale: 0.75, dir: 1, ang: 0, L1: 30, L2: 45 },
  4: { pos: [-1.167, -3.12, -0.1], scale: 0.75, dir: 0, ang: 45, L1: 20, L2: 25 },
  5: { pos: [-0.29, -0.34, -0.01], scale: 0.75, dir: 0, ang: 40, L1: 25, L2: 25 },
  6: { pos: [-0.64, 0.22, 0], scale: 0.75, dir: 1, ang: 25, L1: 40, L2: 40 },
  7: { pos: [-0.549, 0.441, 0], scale: 0.75, dir: 1, ang: 30, L1: 40, L2: 40 },
  8: { pos: [0.621, 0.192, 0], scale: 0.75, dir: 0, ang: 0, L1: 40, L2: 40 },
  9: { pos: [-1.928, 1.032, 0.79], scale: 0.75, dir: 0, ang: 0, L1: 40, L2: 40 },
  10: { pos: [-2.172, 0.939, 0.788], scale: 0.75, dir: 1, ang: 0, L1: 15, L2: 35 },
  11: { pos: [-0.9, 0.824, 0.791], scale: 0.75, dir: 0, ang: 0, L1: 40, L2: 40 },
  12: { pos: [-3.113, -0.671, -1.122], scale: 0.75, dir: 1, ang: 40, L1: 20, L2: 40 },
  13: { pos: [-3.845, -0.824, -1.264], scale: 0.75, dir: 0, ang: 0, L1: 15, L2: 35 },
  14: { pos: [-3.47, -0.9, -1.267], scale: 0.75, dir: 0, ang: 0, L1: 20, L2: 50 },
  15: { pos: [-2.167, -0.379, 0.3], scale: 0.75, dir: 0, ang: 0, L1: 25, L2: 40 },
  16: { pos: [-2.811, -0.68, 0.6], scale: 0.75, dir: 0, ang: 30, L1: 25, L2: 25 },
  17: { pos: [-1.877, -0.736, 0.288], scale: 0.75, dir: 1, ang: 0, L1: 15, L2: 30 },
  18: { pos: [-2.795, -2.308, 0.317], scale: 0.75, dir: 1, ang: 35, L1: 20, L2: 35 },
  19: { pos: [-2.726, -2.886, 0.301], scale: 0.75, dir: 0, ang: 35, L1: 20, L2: 40 },
  20: { pos: [-1.1, 0.429, -1.459], scale: 0.75, dir: 0, ang: 0, L1: 40, L2: 55 },
  21: { pos: [-4.145, 0.205, -1.3], scale: 0.75, dir: 0, ang: 0, L1: 40, L2: 40 },
  22: { pos: [-4.423, 0.425, -1.416], scale: 0.75, dir: 0, ang: 0, L1: 40, L2: 40 },
  23: { pos: [-2.808, 0, 0.583], scale: 0.75, dir: 0, ang: 30, L1: 20, L2: 40 },
  '2b': { pos: [-0.221, -0.68, -0.004], scale: 0.75, dir: 0, ang: 30, L1: 20, L2: 40, ref: 2 },
  '5b': { pos: [0.05, 0.04, -0.01], scale: 0.75, dir: 0, ang: 0, L1: 40, L2: 40, ref: 5 },
  '10b': { pos: [-1.391, -0.382, 0.29], scale: 0.75, dir: 0, ang: 20, L1: 15, L2: 35, ref: 10 },
  '16b': { pos: [-1.679, -0.606, 0.294], scale: 0.75, dir: 1, ang: 0, L1: 20, L2: 25, ref: 16 },
};

export function glbUrl(modelKey: string): string {
  return `/models/rci/${modelKey}.glb`;
}
