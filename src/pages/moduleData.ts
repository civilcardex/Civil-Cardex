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
  /** Solo flow/manage renderizan features: los demás módulos caen en «En construcción» (early-return de ModulePage). */
  features?: Feature[];
  specs?: Spec[];
  customLayout?: 'flow' | 'manage';
}

export const NEW_PROJECT_CTA_TEXT = 'Iniciar nuevo proyecto';

export interface ModuleHeroProps {
  cfg: ModuleConfig;
  onCtaClick: () => void;
  ctaDisabled: boolean;
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
    customLayout: 'flow',
  },
  structure: {
    title: 'Civil Structure',
    ruta: '/civilstructure',
    accent: '#00f5ff',
    logo: '/logos/civilStructurelogo.webp',
    badgeLabel: 'Módulo Estructural',
    headline: 'CivilStructure: Análisis de Elementos Finitos sobre Terreno Real',
    description:
      'Diseño estructural avanzado y simulación física integrada. Analiza puentes, edificaciones y obras civiles complejas con interoperabilidad topográfica directa para cimentaciones precisas.',
  },
  terrain: {
    title: 'Civil Terrain',
    ruta: '/civilterrain',
    accent: '#79ff5b',
    logo: '/logos/civilTerrainlogo.webp',
    badgeLabel: 'Módulo CivilTerrain',
    headline: 'Modelado Digital de Elevación de Próxima Generación',
    description:
      'Herramientas avanzadas para topografía, cálculo preciso de movimiento de tierras y análisis de alta densidad, integradas en un flujo de trabajo brutalmente eficiente.',
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
    customLayout: 'manage',
  },
  roads: {
    title: 'Civil Roads',
    ruta: '/civilroads',
    accent: '#FFC107',
    logo: '/logos/civilRoadslogo.webp',
    badgeLabel: 'CivilRoads Module',
    headline: 'Infraestructura Vial de Alta Precisión.',
    description: 'Diseño geométrico de carreteras y urbanismo sobre gemelos digitales.',
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
  },
};
