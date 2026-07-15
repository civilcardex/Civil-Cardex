export interface Feature {
  icon: string;
  title: string;
  desc: string;
  span?: string;
  badge?: string | null;
  badgeColor?: string | null;
  tags?: string[];
  terminal?: string[];
  autoSize?: boolean;
  highlight?: boolean;
}

export interface Spec {
  param: string;
  hid: string;
  san: string;
  gas: string;
}

export interface ModuleConfig {
  title: string;
  metaTitle: string;
  metaDesc: string;
  accent: string;
  logo: string;
  badgeLabel: string;
  headline: string;
  description: string;
  ctaText?: string;
  features: Feature[];
  specs?: Spec[];
  normas?: string[];
  syncRows?: { id: string; cat: string; estado: string; desv: string; desvColor: string; valid: string; validColor: string }[];
  metrics?: { label: string; value: string; isAccent?: boolean }[];
  customLayout?: 'flow' | 'structure' | 'terrain' | 'bim' | 'manage' | 'mep' | 'roads';
}

export const MODULES_DATA: Record<string, ModuleConfig> = {
  flow: {
    title: 'CivilFlow',
    metaTitle: 'CivilFlow',
    metaDesc: 'Diseño y cálculo de redes hidráulicas, sanitarias y de gas. Hazen-Williams, Manning, Renouard con exportación KML.',
    accent: '#00dce5',
    logo: '/logos/civilFlowlogo.webp',
    badgeLabel: 'Módulo Principal',
    headline: 'CivilFlow: Redes de Fluidos con Precisión KML',
    description: 'Diseño, análisis y optimización de redes hidráulicas, sanitarias y de gas. Integre flujos de trabajo de ingeniería de alta precisión directamente con modelos de terreno KML.',
    ctaText: 'Iniciar nuevo proyecto',
    features: [
      { icon: 'speed', title: 'Cálculo Hidráulico en Tiempo Real', desc: 'Análisis nodal instantáneo para redes presurizadas. Visualización de pérdida de carga y velocidades críticas durante la fase de diseño iterativo.', badge: 'STATUS: ACTIVE_SIM', badgeColor: '#79ff5b' },
      { icon: 'mode_fan', title: 'Modelado de Gas de Alta Presión', desc: 'Módulos específicos para termodinámica de gases compresibles. Ruteo inteligente de tuberías considerando normativas de distanciamiento.', badge: 'PRESSURE: >100_BAR', badgeColor: '#ffb4ab' },
      { icon: 'public', title: 'Exportación Nativa a Google Earth Pro', desc: 'Generación automática de archivos KML/KMZ con metadatos incrustados, topología de red completa y simbología estandarizada.', badge: null, badgeColor: null }
    ],
    specs: [
      { param: 'Método de Cálculo', hid: 'Hazen-Williams / Darcy', san: 'Manning', gas: 'Weymouth / Panhandle' },
      { param: 'Análisis Transitorio', hid: 'Golpe de Ariete (Soportado)', san: 'N/A', gas: 'Despresurización' },
      { param: 'Integración GIS', hid: 'Shapefile, KML, GeoJSON', san: 'Shapefile, KML', gas: 'KML (Alta Precisión)' }
    ],
    normas: ['ISO 14224 (Confiabilidad)', 'ASTM D2513 (Termoplásticos)', 'AWWA M45 (Fibra de Vidrio)'],
    customLayout: 'flow'
  },
  structure: {
    title: 'Estructuras',
    metaTitle: 'Estructuras',
    metaDesc: 'Diseño estructural avanzado con análisis FEM. Cálculo de cargas sísmicas, viento y cimentaciones según normativa.',
    accent: '#00f5ff',
    logo: '/logos/civilStructurelogo.webp',
    badgeLabel: 'Módulo Estructural',
    headline: 'CivilStructure: Análisis de Elementos Finitos sobre Terreno Real',
    description: 'Diseño estructural avanzado y simulación física integrada. Analiza puentes, edificaciones y obras civiles complejas con interoperabilidad topográfica directa para cimentaciones precisas.',
    ctaText: 'COMENZAR ANÁLISIS',
    features: [
      { icon: 'calculate', title: 'Cálculo de Estructuras Complejas', desc: 'Análisis no lineal, pandeo y grandes deformaciones para geometrías singulares.' },
      { icon: 'air', title: 'Simulación de Cargas Sísmicas y de Viento', desc: 'Generación automática de espectros de respuesta y perfiles de viento según normativa local. Análisis dinámico temporal e historial en el dominio de las frecuencias.', span: 'md:col-span-2' },
      { icon: 'layers', title: 'Interoperabilidad con CivilTerrain', desc: 'Importación directa de mallas de terreno para cálculo de cimentaciones e interacción suelo-estructura.' },
      { icon: 'description', title: 'Reportes de Memoria de Cálculo', desc: 'Generación paramétrica de documentación técnica con ecuaciones paso a paso y gráficas de isovalores.' }
    ],
    customLayout: 'structure'
  },
  terrain: {
    title: 'Terreno',
    metaTitle: 'Terreno',
    metaDesc: 'Modelado digital de elevación con datos LiDAR. Cálculo de volúmenes, curvas de nivel e interoperabilidad topográfica.',
    accent: '#79ff5b',
    logo: '/logos/civilTerrainlogo.webp',
    badgeLabel: 'Módulo CivilTerrain',
    headline: 'Modelado Digital de Elevación de Próxima Generación',
    description: 'Herramientas avanzadas para topografía, cálculo preciso de movimiento de tierras y análisis de alta densidad, integradas en un flujo de trabajo brutalmente eficiente.',
    ctaText: 'Iniciar Prueba Gratuita',
    features: [
      { icon: 'cloud_sync', title: 'Procesamiento de Nubes de Puntos LiDAR', desc: 'Ingesta masiva de datos LiDAR con filtrado automatizado de ruido y clasificación de terreno. Algoritmos optimizados para manejar millones de puntos con latencia mínima.', badge: 'CAPACITY: >50M pts/sec' },
      { icon: 'layers', title: 'Cálculo de Volúmenes de Corte y Relleno', desc: 'Comparación instantánea entre superficies existentes y de diseño. Generación de mallas de diferencias y reportes volumétricos precisos mediante el método de áreas promedio o prismas.', span: 'md:col-span-2' },
      { icon: 'architecture', title: 'Generación de Curvas de Nivel de Alta Densidad', desc: 'Extracción topológica con control absoluto sobre intervalos, suavizado y etiquetado automático. Interpolación TIN adaptativa para representar quiebres críticos del terreno.' },
      { icon: 'route', title: 'Integración con CivilRoads para trazado vial', desc: 'Sincronización bidireccional con el módulo de diseño vial. Las actualizaciones del modelo de terreno se reflejan instantáneamente en los perfiles longitudinales y secciones transversales.', span: 'md:col-span-2' }
    ],
    customLayout: 'terrain'
  },
  bim: {
    title: 'BIM',
    metaTitle: 'BIM',
    metaDesc: 'Modelado BIM para infraestructura civil. Integración IFC, Revit, detección de colisiones y coordinación multidisciplinar.',
    accent: '#d946ef',
    logo: '/logos/civilBIMlogo.webp',
    badgeLabel: 'Módulo CivilBIM',
    headline: 'CivilBIM: El Nexo Digital de la Construcción',
    description: 'Integración total de modelos inteligentes en flujos de trabajo es. Conecte diseño, análisis y gestión en un entorno unificado de alta precisión para proyectos de infraestructura civil.',
    ctaText: 'Iniciar Terminal BIM',
    features: [
      { icon: 'hub', title: 'Interoperabilidad IFC y Revit', desc: 'Importación y exportación bidireccional sin pérdida de metadatos constructivos.', tags: ['.IFC', '.RVT', '.DWG'], span: 'col-span-1 md:col-span-2 lg:col-span-2' },
      { icon: 'timeline', title: 'Coordinación 4D/5D', desc: 'Cronogramas de obra y estimación de costos integrados en tiempo real al modelo.' },
      { icon: 'warning', title: 'Detección de Colisiones', desc: 'Análisis automatizado de interferencias MEP vs Estructura.', highlight: true }
    ],
    syncRows: [
      { id: 'P-104A', cat: 'Pilote Cimentación', estado: 'Excavado', desv: '+2.4', desvColor: '#79ff5b', valid: 'OK', validColor: '#79ff5b' },
      { id: 'V-201B', cat: 'Viga Riostra', estado: 'Armado', desv: '-15.2', desvColor: '#ffb4ab', valid: 'REVISIÓN', validColor: '#ffb4ab' },
      { id: 'M-005C', cat: 'Muro Contención', estado: 'Encofrado', desv: '+0.8', desvColor: '#79ff5b', valid: 'OK', validColor: '#79ff5b' }
    ],
    customLayout: 'bim'
  },
  manage: {
    title: 'Gestión',
    metaTitle: 'Gestión',
    metaDesc: 'Gestión de proyectos de ingeniería civil: presupuestos, cronogramas, control de costos y reportes automatizados.',
    accent: '#f59e0b',
    logo: '/logos/civilManagelogo.webp',
    badgeLabel: 'Módulo de Gestión',
    headline: 'CivilManage: Control Total sobre el Ciclo de Vida del Proyecto',
    description: 'Gestión financiera y operativa optimizada para infraestructura crítica. Integra presupuestos, cronogramas y análisis de riesgos en un dashboard táctico.',
    ctaText: 'INICIAR DEPLOYMENT',
    features: [
      { icon: 'account_balance_wallet', title: 'Control de Costos en Tiempo Real', desc: 'Monitoreo de desviaciones presupuestales con alertas tempranas. Análisis de valor ganado (EVM) integrado con modelos BIM.', span: 'md:col-span-2' },
      { icon: 'calendar_month', title: 'Gestión de Cronogramas', desc: 'Gantt dinámico con dependencias complejas y análisis de ruta crítica.' },
      { icon: 'lab_profile', title: 'Reportes Automatizados', desc: 'Generación de informes gerenciales con un clic, exportables a múltiples formatos.' },
      { icon: 'api', title: 'Integración ERP y Sistemas', desc: 'Conectores nativos para SAP, Oracle y sistemas financieros legacy. Sincronización bidireccional segura y auditable.', span: 'md:col-span-2', tags: ['REST API', 'GraphQL', 'Webhooks'] }
    ],
    customLayout: 'manage'
  },
  mep: {
    title: 'MEP',
    metaTitle: 'MEP',
    metaDesc: 'Modelado MEP de sistemas mecánicos, eléctricos e hidrosanitarios. Ruteo inteligente y dimensionamiento normativo.',
    accent: '#00dce5',
    logo: '/logos/civilMEPlogo.webp',
    badgeLabel: 'Module: CivilMEP',
    headline: 'Diseño Inteligente de Instalaciones Especiales',
    description: 'Modelado avanzado de sistemas mecánicos, eléctricos e hidrosanitarios. Diseñado para workflows de alta densidad y precisión.',
    ctaText: 'INICIAR MODELADO',
    features: [
      { icon: 'account_tree', title: 'Ruteo Inteligente de Tuberías y Ductos', desc: 'Algoritmos de pathfinding para el trazado automático evitando colisiones estructurales. Optimización de material basada en parámetros de fricción y caída de presión.', span: 'lg:col-span-2 lg:row-span-2', badge: 'STATUS: OPTIMAL' },
      { icon: 'bolt', title: 'Análisis de Cargas', desc: 'Simulación térmica y eléctrica en tiempo real.', terminal: ['LOAD_ELEC: ACTIVE', 'LOAD_THERM: CALC...'] },
      { icon: 'settings_overscan', title: 'Dimensionamiento', desc: 'Selección automática de equipos según normativa.', autoSize: true },
      { icon: 'architecture', title: 'Documentación de Planos de Taller', desc: 'Extracción automatizada de isométricos, listados de materiales (BOM) y detalles constructivos directamente del modelo federado.', span: 'md:col-span-2 lg:col-span-2' }
    ],
    customLayout: 'mep'
  },
  roads: {
    title: 'Vías',
    metaTitle: 'Vías',
    metaDesc: 'Diseño geométrico de carreteras, urbanismo, peraltes y alineamientos. Simulación de tráfico e impacto vial integrada.',
    accent: '#FFC107',
    logo: '/logos/civilRoadslogo.webp',
    badgeLabel: 'CivilRoads Module',
    headline: 'Infraestructura Vial de Alta Precisión.',
    description: 'Diseño geométrico de carreteras y urbanismo sobre gemelos digitales.',
    ctaText: 'Iniciar Diseño',
    features: [
      { icon: 'design_services', title: 'Diseño Geométrico de Alineamientos', desc: 'Trazado avanzado de plantas, perfiles longitudinales y secciones transversales con actualizaciones dinámicas en el modelo 3D. Cumplimiento normativo automatizado.', span: 'md:col-span-8' },
      { icon: 'traffic', title: 'Simulación de Tráfico e Impacto Vial', desc: 'Analice flujos vehiculares, capacidad de intersecciones y tiempos de semaforización integrados en el diseño.', span: 'md:col-span-4' },
      { icon: 'layers', title: 'Generación Automática de Perfiles', desc: 'Creación instantánea de secciones típicas y cálculo de volúmenes de corte y relleno con alta precisión.', span: 'md:col-span-4' },
      { icon: 'emoji_objects', title: 'Integración con Señalización e Iluminación Inteligente', desc: 'Posicione elementos de seguridad vial, señalética y redes de iluminación con análisis de luminancia y cobertura en tiempo real.', span: 'md:col-span-8' }
    ],
    metrics: [
      { label: 'Alineamiento Horizontal', value: 'OK / 100%' },
      { label: 'Cálculo de Volúmenes', value: 'Procesando...' },
      { label: 'Impacto Ambiental (CO2)', value: '-14.2%', isAccent: true }
    ],
    customLayout: 'roads'
  }
};
