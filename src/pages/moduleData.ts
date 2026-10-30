/** Tarjeta de funcionalidad del módulo (icono + título + descripción) que pinta ModulePage. */
export interface Feature {
  icon: string;
  title: string;
  desc: string;
  span?: string;
  badge?: string | null;
  badgeColor?: string | null;
}

/** Fila de la tabla de especificaciones del módulo (una norma por columna de red). */
export interface Spec {
  param: string;
  hid: string;
  san: string;
  gas: string;
  vent?: string;
  rci?: string;
}

/** Config de una página de módulo: textos del hero, acento, features, specs y layout propio. Ej: flow usa customLayout 'flow'. */
export interface ModuleConfig {
  /** Ruta pública del módulo (la usan ROUTE_META y el prerender). */
  ruta: string;
  title: string;
  accent: string;
  logo: string;
  badgeLabel: string;
  headline: string;
  description: string;
  ctaText?: string;
  features: Feature[];
  specs?: Spec[];
  normas?: string[];
  metrics?: { label: string; value: string; isAccent?: boolean }[];
  customLayout?: 'flow' | 'structure' | 'terrain' | 'manage' | 'roads';
}

/** Los 6 módulos indexados por id ('flow', 'manage', …): fuente de los heroes, precios y ROUTE_META. */
export const MODULES_DATA: Record<string, ModuleConfig> = {
  flow: {
    title: 'Civil Flow',
    ruta: '/civilflow',
    accent: '#00dce5',
    logo: '/logos/civilFlowlogo.webp',
    badgeLabel: 'Módulo Principal',
    headline: 'Diseño hidrosanitario con Verificación Normativa',
    description:
      'Diseñe redes de agua fría, caliente, sanitaria, lluvias, gas y contra incendio sobre planos reales. Cálculo de unidades de consumo y descarga, pérdida de presión por Renouard, verificación contra IPC/UPC, ASCE, NFPA 54 y NFPA 13, y exportación de memorias de cálculo completas.',
    ctaText: 'Iniciar nuevo proyecto',
    features: [
      {
        icon: 'design_services',
        title: 'Dibujo de redes sobre plano',
        desc: 'Cargue planos en PDF o imagen y trace ramales, bajantes, áreas, dimensiones, anotaciones y líneas guía por nivel (sótano, piso, cubierta). Visualización isométrica y autosave por plano.',
      },
      {
        icon: 'speed',
        title: 'Cálculo hidráulico en tiempo real',
        desc: 'Unidades de consumo (Hunter) y descarga por aparato, caudales y pérdidas de carga actuales mientras diseña. Indicador verde/rojo de cumplimiento de ΔP de gas según NFPA 54.',
      },
      {
        icon: 'description',
        title: 'Memorias de cálculo exportables',
        desc: 'Generación automática de la memoria con datos del proyecto, materiales por red, aparatos, cálculo de cubierta (método racional ASCE), diseño de gas (Renouard), selección de calentadores y validación normativa.',
      },
    ],
    specs: [
      {
        param: 'Método de cálculo',
        hid: 'Hunter',
        san: 'Manning (ASCE)',
        gas: 'Renouard (NFPA 54)',
        vent: 'IPC/UPC (ventilación)',
        rci: 'NFPA 13 (Densidad/Área)',
      },
      {
        param: 'Redes soportadas',
        hid: 'Agua fría, agua caliente',
        san: 'Sanitaria, aguas lluvias',
        gas: 'Gas',
        vent: 'Ventilación',
        rci: 'Contra incendio',
      },
      {
        param: 'Verificación normativa',
        hid: 'IPC / UPC',
        san: 'ASCE / Manning',
        gas: 'NFPA 54 (ΔP)',
        vent: 'IPC/UPC (vent)',
        rci: 'NFPA 13 / 14',
      },
    ],
    normas: [
      'IPC/UPC (Plomería americana)',
      'ASCE (Saneamiento y drenaje)',
      'NFPA 54 / ANSI Z223.1 (Gas)',
      'NFPA 13 (Rociadores)',
      'NFPA 14 (Standpipes)',
    ],
    customLayout: 'flow',
  },
  structure: {
    title: 'Estructuras',
    ruta: '/civilstructure',
    accent: '#00f5ff',
    logo: '/logos/civilStructurelogo.webp',
    badgeLabel: 'Módulo Estructural',
    headline: 'CivilStructure: Análisis de Elementos Finitos sobre Terreno Real',
    description:
      'Diseño estructural avanzado y simulación física integrada. Analiza puentes, edificaciones y obras civiles complejas con interoperabilidad topográfica directa para cimentaciones precisas.',
    ctaText: 'COMENZAR ANÁLISIS',
    features: [
      {
        icon: 'calculate',
        title: 'Cálculo de estructuras complejas',
        desc: 'Análisis no lineal, pandeo y grandes deformaciones para geometrías singulares.',
      },
      {
        icon: 'air',
        title: 'Simulación de cargas sísmicas y de viento',
        desc: 'Generación automática de espectros de respuesta y perfiles de viento según normativa local. Análisis dinámico temporal e historial en el dominio de las frecuencias.',
        span: 'md:col-span-2',
      },
      {
        icon: 'layers',
        title: 'Interoperabilidad con CivilTerrain',
        desc: 'Importación directa de mallas de terreno para cálculo de cimentaciones e interacción suelo-estructura.',
      },
      {
        icon: 'description',
        title: 'Reportes de memoria de cálculo',
        desc: 'Generación paramétrica de documentación técnica con ecuaciones paso a paso y gráficas de isovalores.',
      },
    ],
    customLayout: 'structure',
  },
  terrain: {
    title: 'Terreno',
    ruta: '/civilterrain',
    accent: '#79ff5b',
    logo: '/logos/civilTerrainlogo.webp',
    badgeLabel: 'Módulo CivilTerrain',
    headline: 'Modelado Digital de Elevación de Próxima Generación',
    description:
      'Herramientas avanzadas para topografía, cálculo preciso de movimiento de tierras y análisis de alta densidad, integradas en un flujo de trabajo brutalmente eficiente.',
    ctaText: 'Iniciar Prueba Gratuita',
    features: [
      {
        icon: 'cloud_sync',
        title: 'Procesamiento de Nubes de Puntos LiDAR',
        desc: 'Ingesta masiva de datos LiDAR con filtrado automatizado de ruido y clasificación de terreno. Algoritmos optimizados para manejar millones de puntos con latencia mínima.',
        badge: 'CAPACITY: >50M pts/sec',
      },
      {
        icon: 'layers',
        title: 'Cálculo de Volúmenes de Corte y Relleno',
        desc: 'Comparación instantánea entre superficies existentes y de diseño. Generación de mallas de diferencias y reportes volumétricos precisos mediante el método de áreas promedio o prismas.',
        span: 'md:col-span-2',
      },
      {
        icon: 'architecture',
        title: 'Generación de Curvas de Nivel de Alta Densidad',
        desc: 'Extracción topológica con control absoluto sobre intervalos, suavizado y etiquetado automático. Interpolación TIN adaptativa para representar quiebres críticos del terreno.',
      },
      {
        icon: 'route',
        title: 'Integración con CivilRoads para trazado vial',
        desc: 'Sincronización bidireccional con el módulo de diseño vial. Las actualizaciones del modelo de terreno se reflejan instantáneamente en los perfiles longitudinales y secciones transversales.',
        span: 'md:col-span-2',
      },
    ],
    customLayout: 'terrain',
  },
  manage: {
    title: 'Civil Manager',
    ruta: '/civilmanager',
    accent: '#f59e0b',
    logo: '/logos/civilManagelogo.webp',
    badgeLabel: 'Módulo de Gestión',
    headline: 'Presupuestos y APU de Obra Civil',
    description:
      'Construya análisis de precios unitarios con mano de obra, insumos, equipo y transporte. Gestione catálogos de proveedores, insumos, equipos, cuadrillas y colaboradores, con configuración de perfil país, factor prestacional e importación desde Excel.',
    ctaText: 'INICIAR NUEVO PROYECTO',
    features: [
      {
        icon: 'account_balance_wallet',
        title: 'Análisis de precios unitarios (APU)',
        desc: 'Editor completo de APU con secciones de mano de obra, insumos, equipo y transporte. Rendimientos, precios e integración con catálogos del proyecto. Cálculo de resumen, ítems y entregables del presupuesto.',
      },
      {
        icon: 'tune',
        title: 'Configuración de costos',
        desc: 'Perfil país, factor prestacional, unidades, orígenes, categorías de APU e insumos, tipos de equipo y parámetros de APU. Base paramétrica para todos los presupuestos.',
      },
      {
        icon: 'inventory_2',
        title: 'Catálogos integrados',
        desc: 'Insumos, equipos, cuadrillas, colaboradores y proveedores con importación y exportación a Excel.',
      },
      {
        icon: 'file_upload',
        title: 'Importación masiva desde Excel',
        desc: 'Formulario de importación de insumos, equipos, colaboradores y cuadrillas desde archivos .xlsx. Sincroniza catálogos completos en minutos.',
      },
    ],
    customLayout: 'manage',
  },
  roads: {
    title: 'Vías',
    ruta: '/civilroads',
    accent: '#FFC107',
    logo: '/logos/civilRoadslogo.webp',
    badgeLabel: 'CivilRoads Module',
    headline: 'Infraestructura Vial de Alta Precisión.',
    description: 'Diseño geométrico de carreteras y urbanismo sobre gemelos digitales.',
    ctaText: 'Iniciar Diseño',
    features: [
      {
        icon: 'design_services',
        title: 'Diseño Geométrico de Alineamientos',
        desc: 'Trazado avanzado de plantas, perfiles longitudinales y secciones transversales con actualizaciones dinámicas en el modelo 3D. Cumplimiento normativo automatizado.',
        span: 'md:col-span-8',
      },
      {
        icon: 'traffic',
        title: 'Simulación de Tráfico e Impacto Vial',
        desc: 'Analice flujos vehiculares, capacidad de intersecciones y tiempos de semaforización integrados en el diseño.',
        span: 'md:col-span-4',
      },
      {
        icon: 'layers',
        title: 'Generación Automática de Perfiles',
        desc: 'Creación instantánea de secciones típicas y cálculo de volúmenes de corte y relleno con alta precisión.',
        span: 'md:col-span-4',
      },
      {
        icon: 'emoji_objects',
        title: 'Integración con Señalización e Iluminación Inteligente',
        desc: 'Posicione elementos de seguridad vial, señalética y redes de iluminación con análisis de luminancia y cobertura en tiempo real.',
        span: 'md:col-span-8',
      },
    ],
    metrics: [
      { label: 'Alineamiento Horizontal', value: 'OK / 100%' },
      { label: 'Cálculo de Volúmenes', value: 'Procesando...' },
      { label: 'Impacto Ambiental (CO2)', value: '-14.2%', isAccent: true },
    ],
    customLayout: 'roads',
  },
};
