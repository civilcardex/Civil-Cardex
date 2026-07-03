import { Link } from 'react-router-dom';
import ModulePageLayout from '../components/ModulePageLayout';
import { usePageMeta } from '../hooks/usePageMeta';

interface Feature {
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

interface Spec {
  param: string;
  hid: string;
  san: string;
  gas: string;
}

interface ModuleConfig {
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

const MODULES_DATA: Record<string, ModuleConfig> = {
  flow: {
    title: 'CivilFlow',
    metaTitle: 'CivilFlow',
    metaDesc: 'Diseño y cálculo de redes hidráulicas, sanitarias y de gas. Hazen-Williams, Manning, Renouard con exportación KML.',
    accent: '#00dce5',
    logo: '/logos/civilFlowlogo.svg',
    badgeLabel: 'Módulo Principal',
    headline: 'CivilFlow: Redes de Fluidos con Precisión KML',
    description: 'Diseño, análisis y optimización de redes hidráulicas, sanitarias y de gas. Integre flujos de trabajo de ingeniería de alta precisión directamente con modelos de terreno KML.',
    ctaText: 'Explorar Funciones',
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
    logo: '/logos/civilStructurelogo.svg',
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
    logo: '/logos/civilTerrainlogo.svg',
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
    logo: '/logos/civilBIMlogo.svg',
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
    logo: '/logos/civilManagelogo.svg',
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
    logo: '/logos/civilMEPlogo.svg',
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
    logo: '/logos/civilRoadslogo.svg',
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

interface ModulePageProps {
  moduleId: 'flow' | 'structure' | 'terrain' | 'bim' | 'manage' | 'mep' | 'roads';
}

export default function ModulePage({ moduleId }: ModulePageProps) {
  const cfg = MODULES_DATA[moduleId];
  usePageMeta(cfg?.metaTitle ?? '', cfg?.metaDesc ?? '');
  if (!cfg) return null;

  return (
    <ModulePageLayout title={cfg.title} mainClassName={cfg.customLayout === 'terrain' ? 'pt-20 px-6 lg:px-8 pb-12 relative overflow-hidden' : (cfg.customLayout === 'roads' ? 'flex flex-col relative z-0' : 'flex flex-col w-full')}>
      {/* Hero Section */}
      {cfg.customLayout === 'terrain' && (
        <div className="absolute inset-0 pointer-events-none z-0" style={{ opacity: 0.1, backgroundImage: 'linear-gradient(to right, #3a494a 1px, transparent 1px), linear-gradient(to bottom, #3a494a 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
      )}

      {cfg.customLayout === 'flow' ? (
        <section className="relative w-full overflow-hidden border-b border-outline-variant" style={{ minHeight: 500, background: '#1a1c20' }}>
          <div className="absolute inset-0" style={{ background: 'linear-gradient(0deg, #111317 0%, rgba(17,19,23,0) 100%)' }} />
          <div className="relative z-10 px-6 lg:px-8 py-20 max-w-5xl mx-auto flex flex-col gap-6">
            <div className="flex items-center gap-3">
              <img src={cfg.logo} alt={cfg.title} className="h-8 w-8 object-contain" width={32} height={32} loading="lazy" />
              <span className="text-[11px] tracking-[0.08em] font-bold uppercase" style={{ fontFamily: 'Geist, monospace', color: cfg.accent }}>{cfg.badgeLabel}</span>
            </div>
            <h1 className="text-2xl md:text-4xl lg:text-[44px] leading-tight font-bold text-primary" style={{ fontFamily: 'Hanken Grotesk, sans-serif' }}>
              {cfg.headline}
            </h1>
            <p className="text-base text-on-surface-variant max-w-xl leading-relaxed">
              {cfg.description}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 mt-4">
              <Link to="/civilflowareatrabajo" className="inline-block px-6 py-3 uppercase text-[11px] tracking-[0.08em] font-bold text-on-primary transition-all" style={{ fontFamily: 'Geist, monospace', background: cfg.accent, boxShadow: `0 0 15px ${cfg.accent}4d` }}>
                {cfg.ctaText}
              </Link>
              <Link to="/docs" className="border border-outline-variant text-on-surface px-6 py-3 uppercase text-[11px] tracking-[0.08em] font-bold hover:border-primary transition-all" style={{ fontFamily: 'Geist, monospace', background: 'rgba(17,19,23,0.5)' }}>
                Ver Documentación
              </Link>
            </div>
          </div>
        </section>
      ) : cfg.customLayout === 'structure' ? (
        <section className="relative flex items-center border-b border-outline-variant overflow-hidden" style={{ minHeight: 600, background: '#0c0e12' }}>
          <div className="absolute inset-0 pointer-events-none" style={{ opacity: 0.1, backgroundImage: 'linear-gradient(to right, #3a494a 1px, transparent 1px), linear-gradient(to bottom, #3a494a 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
          <div className="absolute top-1/4 left-8 text-[13px] text-outline opacity-50 hidden lg:block" style={{ fontFamily: 'Geist, monospace' }}>
            SYS.INIT: OK<br />LOAD_FACTOR: 1.4<br />MESH_DENSITY: HIGH<br />SOLVER_ITER: 2540
          </div>
          <div className="container mx-auto px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-3 relative z-10">
            <div className="flex flex-col justify-center gap-6 max-w-2xl py-12">
              <div className="inline-flex items-center gap-2 px-3 py-1 border border-primary text-primary w-fit" style={{ background: 'rgba(0,245,255,0.1)', borderColor: cfg.accent, color: cfg.accent }}>
                <img src={cfg.logo} alt={cfg.title} className="h-4 w-4 object-contain" width={16} height={16} loading="lazy" />
                <span className="text-[11px] tracking-[0.08em] font-bold uppercase" style={{ fontFamily: 'Geist, monospace' }}>{cfg.badgeLabel}</span>
              </div>
              <h2 className="text-xl md:text-3xl lg:text-[36px] text-on-surface" style={{ fontFamily: 'Hanken Grotesk, sans-serif', fontWeight: 700 }}>
                {cfg.headline}
              </h2>
              <p className="text-base text-on-surface-variant">
                {cfg.description}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <Link to="/civilflowareatrabajo" className="inline-block bg-primary text-on-primary px-6 py-3 uppercase text-[11px] tracking-[0.08em] font-bold hover:bg-primary-fixed transition-all" style={{ fontFamily: 'Geist, monospace', background: cfg.accent }}>
                  {cfg.ctaText}
                </Link>
                <button className="border text-primary px-6 py-3 uppercase text-[11px] tracking-[0.08em] font-bold hover:bg-surface-container transition-all flex items-center gap-2" style={{ fontFamily: 'Geist, monospace', borderColor: cfg.accent, color: cfg.accent }}>
                  <span className="material-symbols-outlined text-base">download</span> DESCARGAR SDK
                </button>
              </div>
            </div>
            <div className="relative h-[400px] lg:h-auto w-full flex items-center justify-center">
              <div className="w-full h-full border border-outline-variant overflow-hidden relative" style={{ background: '#1e2024' }}>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="material-symbols-outlined text-outline-variant" style={{ fontSize: 120, opacity: 0.15 }}>architecture</span>
                </div>
                <div className="absolute top-4 right-4 border border-outline-variant p-2 text-[13px] text-on-surface flex items-center gap-2" style={{ background: '#282a2e', fontFamily: 'Geist, monospace' }}>
                  <div className="w-2 h-2 bg-secondary rounded-full animate-pulse" style={{ background: 'var(--ok)' }} /> NODE_STRESS_MAX
                </div>
                <div className="absolute bottom-4 left-4 border border-outline-variant p-2 text-[13px]" style={{ background: '#282a2e', fontFamily: 'Geist, monospace' }}>
                  <span style={{ color: cfg.accent }}>Fz:</span> 450kN
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : cfg.customLayout === 'terrain' ? (
        <section className="relative z-10 flex flex-col md:flex-row items-center gap-12 mb-24 max-w-7xl mx-auto">
          <div className="md:w-1/2 flex flex-col gap-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 border border-outline-variant w-fit" style={{ background: '#282a2e' }}>
              <img src={cfg.logo} alt={cfg.title} className="h-4 w-4 object-contain" width={16} height={16} loading="lazy" />
              <span className="text-[11px] tracking-[0.08em] font-bold uppercase" style={{ fontFamily: 'Geist, monospace', color: cfg.accent }}>{cfg.badgeLabel}</span>
            </div>
            <h2 className="text-xl md:text-3xl lg:text-[36px] font-bold text-primary" style={{ fontFamily: 'Hanken Grotesk, sans-serif' }}>
              {cfg.headline}
            </h2>
            <p className="text-base text-on-surface-variant max-w-xl">
              {cfg.description}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 mt-4">
              <Link to="/civilflowareatrabajo" className="inline-block bg-primary text-on-primary px-6 py-3 uppercase text-[11px] tracking-[0.08em] font-bold hover:bg-primary-fixed transition-colors border border-primary" style={{ fontFamily: 'Geist, monospace' }}>
                {cfg.ctaText}
              </Link>
              <Link to="/docs" className="bg-transparent text-primary px-6 py-3 uppercase text-[11px] tracking-[0.08em] font-bold hover:bg-surface-container-highest transition-colors border border-primary" style={{ fontFamily: 'Geist, monospace', borderColor: 'var(--acc)', color: 'var(--acc)' }}>
                Ver Documentación Técnica
              </Link>
            </div>
          </div>
          <div className="md:w-1/2 w-full h-[400px] border border-outline-variant relative overflow-hidden group" style={{ background: '#1e2024' }}>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="material-symbols-outlined text-outline-variant" style={{ fontSize: 120, opacity: 0.15 }}>terrain</span>
            </div>
            <div className="absolute top-4 left-4 flex flex-col gap-1">
              <span className="text-[13px] text-primary px-2 py-1 backdrop-blur-sm border border-outline-variant" style={{ fontFamily: 'Geist, monospace', background: 'rgba(17,19,23,0.8)' }}>ELEV: +1452.34m</span>
              <span className="text-[13px] text-secondary px-2 py-1 backdrop-blur-sm border border-outline-variant" style={{ fontFamily: 'Geist, monospace', background: 'rgba(17,19,23,0.8)', color: 'var(--ok)' }}>SLOPE: 12.4%</span>
            </div>
            <div className="absolute bottom-4 right-4">
              <span className="text-[13px] text-on-surface-variant" style={{ fontFamily: 'Geist, monospace' }}>RENDER ENGINE v2.4.1</span>
            </div>
          </div>
        </section>
      ) : cfg.customLayout === 'bim' ? (
        <section className="relative w-full flex items-center border-b border-outline-variant overflow-hidden" style={{ minHeight: 600 }}>
          <div className="absolute inset-0 z-0" style={{ opacity: 0.1, backgroundImage: 'radial-gradient(circle at 2px 2px, #849495 1px, transparent 0)', backgroundSize: '32px 32px' }} />
          <div className="w-full max-w-7xl px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-12 z-10 items-center py-20">
            <div className="flex flex-col gap-6">
              <div className="inline-flex items-center gap-2 border border-outline-variant px-3 py-1 w-fit" style={{ background: '#1a1c20' }}>
                <img src={cfg.logo} alt={cfg.title} className="h-4 w-4 object-contain" width={16} height={16} loading="lazy" />
                <span className="text-[13px] text-on-surface-variant uppercase tracking-widest" style={{ fontFamily: 'Geist, monospace' }}>{cfg.badgeLabel}</span>
              </div>
              <h2 className="text-2xl md:text-4xl lg:text-[48px] leading-[56px] font-bold text-on-surface tracking-tight" style={{ fontFamily: 'Hanken Grotesk, sans-serif' }}>
                {cfg.headline}
              </h2>
              <p className="text-base text-on-surface-variant max-w-xl">
                {cfg.description}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 mt-4">
                <Link to="/civilflowareatrabajo" className="inline-flex border border-outline-variant text-on-surface px-6 py-3 uppercase text-[11px] tracking-[0.08em] font-bold items-center gap-2 hover:border-[#d946ef] transition-colors" style={{ fontFamily: 'Geist, monospace', background: '#333539' }}>
                  <span className="material-symbols-outlined text-lg">terminal</span> {cfg.ctaText}
                </Link>
                <Link to="/docs" className="border border-outline-variant text-on-surface-variant px-6 py-3 uppercase text-[11px] tracking-[0.08em] font-bold flex items-center gap-2 hover:text-on-surface transition-colors" style={{ fontFamily: 'Geist, monospace' }}>
                  <span className="material-symbols-outlined text-lg">description</span> Documentación API
                </Link>
              </div>
              <div className="grid grid-cols-3 gap-2 md:gap-4 mt-8 border-t border-outline-variant pt-6">
                <div className="flex flex-col">
                  <span className="text-2xl text-on-surface font-bold" style={{ fontFamily: 'Geist, monospace' }}>99.9%</span>
                  <span className="text-[10px] text-on-surface-variant uppercase" style={{ fontFamily: 'Geist, monospace' }}>Precisión Geométrica</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-2xl text-on-surface font-bold" style={{ fontFamily: 'Geist, monospace' }}>&lt;10ms</span>
                  <span className="text-[10px] text-on-surface-variant uppercase" style={{ fontFamily: 'Geist, monospace' }}>Latencia Sincronización</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-2xl text-on-surface font-bold" style={{ fontFamily: 'Geist, monospace' }}>IFC4</span>
                  <span className="text-[10px] text-on-surface-variant uppercase" style={{ fontFamily: 'Geist, monospace' }}>Soporte Nativo</span>
                </div>
              </div>
            </div>
            <div className="relative h-[300px] lg:h-[500px] w-full flex items-center justify-center">
              <div className="absolute inset-0 border border-outline-variant flex items-center justify-center overflow-hidden" style={{ background: '#1a1c20', boxShadow: `0 0 20px -5px ${cfg.accent}` }}>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="material-symbols-outlined opacity-10" style={{ fontSize: 120, color: cfg.accent, fontVariationSettings: "'FILL' 0, 'wght' 200" }}>architecture</span>
                </div>
                <div className="absolute top-4 left-4 text-[10px] text-on-surface-variant flex flex-col gap-1" style={{ fontFamily: 'Geist, monospace' }}>
                  <span>COORD: 34.0522° N, 118.2437° W</span>
                  <span>ELEV: +142.5m ASL</span>
                  <span style={{ color: cfg.accent }}>STATUS: SYNCED</span>
                </div>
                <div className="absolute bottom-4 right-4 flex gap-2">
                  <div className="w-2 h-2 animate-pulse" style={{ background: '#2ff801' }} />
                  <span className="text-[10px]" style={{ fontFamily: 'Geist, monospace', color: '#2ff801' }}>LIVE DATA</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : cfg.customLayout === 'manage' ? (
        <section className="relative pt-24 pb-16 px-6 lg:px-8 overflow-hidden flex flex-col items-center justify-center text-center" style={{ minHeight: 600, backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px)', backgroundSize: '24px 24px' }}>
          <div className="absolute inset-0 pointer-events-none" style={{ background: `linear-gradient(to bottom, ${cfg.accent}0D, #111317)` }} />
          <div className="relative z-10 max-w-4xl mx-auto flex flex-col items-center gap-6">
            <div className="flex items-center justify-center w-16 h-16 border mb-4" style={{ background: '#282a2e', borderColor: '#3a494a', boxShadow: `0 0 15px ${cfg.accent}33` }}>
              <img src={cfg.logo} alt={cfg.title} className="h-10 w-10 object-contain" width={40} height={40} loading="lazy" />
            </div>
            <h2 className="text-4xl md:text-6xl text-primary font-bold tracking-tight leading-tight" style={{ fontFamily: 'Hanken Grotesk, sans-serif' }}>
              CivilManage: <br />
              <span className="text-transparent bg-clip-text" style={{ backgroundImage: `linear-gradient(to right, ${cfg.accent}, #fef08a)` }}>Control Total</span> sobre el Ciclo de Vida del Proyecto
            </h2>
            <p className="text-base text-on-surface-variant max-w-2xl">
              {cfg.description}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 mt-8">
              <Link to="/civilflowareatrabajo" className="inline-flex px-8 py-4 uppercase text-[11px] tracking-[0.08em] font-bold items-center gap-2" style={{ fontFamily: 'Geist, monospace', background: cfg.accent, color: '#111317' }}>
                <span className="material-symbols-outlined text-sm">rocket_launch</span> {cfg.ctaText}
              </Link>
              <Link to="/docs" className="border border-outline-variant text-on-surface px-8 py-4 uppercase text-[11px] tracking-[0.08em] font-bold flex items-center gap-2 hover:border-primary transition-colors" style={{ fontFamily: 'Geist, monospace' }}>
                <span className="material-symbols-outlined text-sm">terminal</span> VER DOCUMENTACIÓN API
              </Link>
            </div>
          </div>
        </section>
      ) : cfg.customLayout === 'mep' ? (
        <section className="relative w-full flex flex-col lg:flex-row items-center px-6 lg:px-8 py-16 gap-12 overflow-hidden border-b border-outline-variant" style={{ background: '#1a1c20', minHeight: 600 }}>
          <div className="absolute inset-0 pointer-events-none" style={{ opacity: 0.1, backgroundImage: 'linear-gradient(to right, #3a494a 1px, transparent 1px), linear-gradient(to bottom, #3a494a 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
          <div className="relative z-10 w-full lg:w-1/2 flex flex-col gap-6">
            <div className="inline-flex items-center gap-2 border border-outline-variant px-3 py-1 w-max" style={{ background: '#111317' }}>
              <span className="w-2 h-2 bg-primary-fixed-dim animate-pulse" style={{ background: '#00dce5' }} />
              <img src={cfg.logo} alt={cfg.title} className="h-4 w-4 object-contain" width={16} height={16} loading="lazy" />
              <span className="text-[13px] uppercase" style={{ fontFamily: 'Geist, monospace', color: '#00dce5' }}>{cfg.badgeLabel}</span>
            </div>
            <h2 className="text-2xl md:text-4xl lg:text-[48px] leading-[1.1] font-bold text-on-background tracking-tight" style={{ fontFamily: 'Hanken Grotesk, sans-serif' }}>
              Diseño Inteligente de <br />
              <span className="text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(to right, #00dce5, #79ff5b)' }}>Instalaciones Especiales</span>
            </h2>
            <p className="text-base text-on-surface-variant max-w-xl">
              {cfg.description}
            </p>
            <div className="flex flex-wrap items-center gap-3 md:gap-4 mt-4">
              <Link to="/civilflowareatrabajo" className="inline-flex text-on-primary px-8 py-3 uppercase text-[11px] tracking-[0.08em] font-bold items-center gap-2" style={{ fontFamily: 'Geist, monospace', background: '#00dce5' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>precision_manufacturing</span> {cfg.ctaText}
              </Link>
              <Link to="/docs" className="border border-outline-variant text-on-surface px-8 py-3 uppercase text-[11px] tracking-[0.08em] font-bold flex items-center gap-2 hover:border-primary transition-colors" style={{ fontFamily: 'Geist, monospace' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>data_object</span> VER DOCS API
              </Link>
            </div>
            <div className="mt-8 border border-outline-variant w-full max-w-md" style={{ background: '#0c0e12' }}>
              <div className="flex justify-between border-b border-outline-variant px-4 py-2">
                <span className="text-[11px] tracking-[0.08em] font-bold text-outline uppercase" style={{ fontFamily: 'Geist, monospace' }}>ENGINE</span>
                <span className="text-[13px]" style={{ fontFamily: 'Geist, monospace', color: '#00dce5' }}>CIVIL-X v4.2</span>
              </div>
              <div className="flex justify-between px-4 py-2" style={{ background: 'rgba(26,28,32,0.5)' }}>
                <span className="text-[11px] tracking-[0.08em] font-bold text-outline uppercase" style={{ fontFamily: 'Geist, monospace' }}>LOD SUPPORT</span>
                <span className="text-[13px] text-on-surface" style={{ fontFamily: 'Geist, monospace' }}>LOD 100 - LOD 500</span>
              </div>
            </div>
          </div>
          <div className="relative w-full lg:w-1/2 h-[400px] lg:h-[600px] flex items-center justify-center">
            <div className="absolute top-10 right-10 z-20 border border-outline-variant p-3 flex flex-col gap-1" style={{ background: 'rgba(51,53,57,0.8)', backdropFilter: 'blur(8px)', boxShadow: '0 0 15px rgba(0,220,229,0.15)' }}>
              <span className="text-[11px] tracking-[0.08em] font-bold text-outline uppercase" style={{ fontFamily: 'Geist, monospace' }}>SYSTEM PRESSURE</span>
              <span className="text-lg font-bold" style={{ fontFamily: 'Geist, monospace', color: '#79ff5b' }}>124.5 PSI</span>
            </div>
            <div className="absolute bottom-20 left-0 z-20 border border-outline-variant p-3 flex flex-col gap-1" style={{ background: 'rgba(51,53,57,0.8)', backdropFilter: 'blur(8px)' }}>
              <span className="text-[11px] tracking-[0.08em] font-bold text-outline uppercase" style={{ fontFamily: 'Geist, monospace' }}>FLOW RATE</span>
              <span className="text-lg font-bold" style={{ fontFamily: 'Geist, monospace', color: '#00dce5' }}>450 GPM</span>
            </div>
            <div className="relative z-10 w-full h-full border border-outline-variant overflow-hidden group" style={{ background: '#111317' }}>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="material-symbols-outlined text-outline-variant" style={{ fontSize: 120, opacity: 0.15 }}>valve</span>
              </div>
              <div className="absolute inset-0 pointer-events-none" style={{ background: 'rgba(0,220,229,0.1)', mixBlendMode: 'overlay' }} />
            </div>
          </div>
        </section>
      ) : (
        <section className="relative w-full flex items-center overflow-hidden border-b border-outline-variant" style={{ minHeight: 700 }}>
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to right, #0F1115, rgba(15,17,21,0.8), transparent)' }} />
          <div className="relative z-10 w-full px-6 lg:px-8 grid grid-cols-12 gap-3 mt-16 md:mt-0">
            <div className="col-span-12 md:col-span-6 lg:col-span-5 flex flex-col justify-center space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 w-fit border" style={{ background: '#1A1D23', borderColor: cfg.accent }}>
                <img src={cfg.logo} alt={cfg.title} className="h-4 w-4 object-contain" width={16} height={16} loading="lazy" />
                <span className="text-[13px] uppercase" style={{ fontFamily: 'Geist, monospace', color: cfg.accent }}>{cfg.badgeLabel}</span>
              </div>
              <h2 className="text-2xl md:text-4xl lg:text-[48px] leading-[1.1] font-bold text-on-background tracking-tight" style={{ fontFamily: 'Hanken Grotesk, sans-serif' }}>
                Infraestructura Vial de <span style={{ color: cfg.accent }}>Alta Precisión</span>.
              </h2>
              <p className="text-base text-on-surface-variant max-w-md">
                {cfg.description}
              </p>
              <div className="pt-8 flex flex-col sm:flex-row gap-4">
                <Link to="/civilflowareatrabajo" className="inline-flex bg-primary text-on-primary px-6 py-3 uppercase text-[11px] tracking-[0.08em] font-bold items-center gap-2 hover:bg-primary/90 transition-colors" style={{ fontFamily: 'Geist, monospace' }}>
                  {cfg.ctaText} <span className="material-symbols-outlined text-base">arrow_forward</span>
                </Link>
                <Link to="/docs" className="border border-outline text-on-background px-6 py-3 uppercase text-[11px] tracking-[0.08em] font-bold hover:bg-surface-container-highest transition-colors" style={{ fontFamily: 'Geist, monospace' }}>
                  Ver Documentación
                </Link>
              </div>
              <div className="mt-12 flex gap-8 border-t border-outline-variant pt-4">
                <div>
                  <p className="text-[11px] tracking-[0.08em] font-bold text-outline uppercase mb-1" style={{ fontFamily: 'Geist, monospace' }}>Precisión</p>
                  <p className="text-[13px]" style={{ fontFamily: 'Geist, monospace', color: '#00dce5' }}>Sub-milimétrica</p>
                </div>
                <div>
                  <p className="text-[11px] tracking-[0.08em] font-bold text-outline uppercase mb-1" style={{ fontFamily: 'Geist, monospace' }}>Simulación</p>
                  <p className="text-[13px]" style={{ fontFamily: 'Geist, monospace', color: '#00dce5' }}>Tiempo Real</p>
                </div>
              </div>
            </div>
            <div className="col-span-12 md:col-span-6 lg:col-span-6 lg:col-start-7 hidden md:flex items-center justify-center">
              <div className="p-8 w-full max-w-lg relative border" style={{ background: 'linear-gradient(135deg, rgba(26,29,35,0.8), rgba(26,29,35,0.4))', backdropFilter: 'blur(12px)', borderColor: 'rgba(51,56,66,0.5)' }}>
                <div className="absolute top-0 left-0 w-full h-1 opacity-50" style={{ background: `linear-gradient(to right, transparent, ${cfg.accent}, transparent)` }} />
                <div className="flex justify-between items-start mb-6">
                  <div className="text-xl font-bold text-on-background" style={{ fontFamily: 'Hanken Grotesk, sans-serif' }}>Live Metrics View</div>
                  <span className="material-symbols-outlined text-outline">data_usage</span>
                </div>
                <div className="space-y-4">
                  {cfg.metrics?.map((m, i) => (
                    <div key={i} className="flex justify-between items-center border-b border-outline-variant pb-2">
                      <span className="text-[13px] text-on-surface-variant" style={{ fontFamily: 'Geist, monospace' }}>{m.label}</span>
                      <span className="text-[13px]" style={{ fontFamily: 'Geist, monospace', color: m.isAccent ? cfg.accent : '#00dce5' }}>{m.value}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-6 h-32 w-full border border-outline-variant relative overflow-hidden" style={{ background: '#0c0e12' }}>
                  <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(#3a494a 1px, transparent 1px)', backgroundSize: '8px 8px', opacity: 0.3 }} />
                  <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
                    <path d="M0,80 Q25,20 50,50 T100,20" fill="none" stroke={cfg.accent} strokeWidth="2" vectorEffect="non-scaling-stroke" />
                    <circle cx="50" cy="50" fill="#00dce5" r="3" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Features / Details Section */}
      <section className={cfg.customLayout === 'terrain' ? 'relative z-10 max-w-7xl mx-auto' : (cfg.customLayout === 'roads' ? 'py-20 px-6 lg:px-8' : (cfg.customLayout === 'manage' ? 'py-20 px-6 lg:px-8' : 'w-full px-6 lg:px-8 py-20 border-b border-outline-variant'))} style={cfg.customLayout === 'roads' ? { background: '#0F1115' } : (cfg.customLayout === 'manage' ? { background: '#1a1c20' } : (cfg.customLayout === 'terrain' ? {} : { background: '#111317' }))}>
        {cfg.customLayout === 'terrain' ? (
          <h2 className="text-xl font-bold text-primary mb-8 border-b border-outline-variant pb-4" style={{ fontFamily: 'Hanken Grotesk, sans-serif' }}>Capacidades Técnicas</h2>
        ) : cfg.customLayout === 'roads' ? (
          <>
            <h2 className="text-2xl md:text-4xl lg:text-[32px] font-bold text-on-background mb-2" style={{ fontFamily: 'Hanken Grotesk, sans-serif' }}>Capacidades del Módulo</h2>
            <p className="text-base text-on-surface-variant mt-2 max-w-2xl mb-12">Herramientas especializadas para el diseño integral de infraestructuras viales y espacios urbanos.</p>
          </>
        ) : (
          <div className="flex flex-col gap-2 mb-12">
            <h2 className="text-xl font-semibold text-on-surface" style={{ fontFamily: 'Hanken Grotesk, sans-serif' }}>{cfg.customLayout === 'mep' ? 'Capacidades del Módulo' : 'Capacidades del Sistema'}</h2>
            <p className="text-[13px] text-outline uppercase" style={{ fontFamily: 'Geist, monospace' }}>{cfg.customLayout === 'mep' ? 'SYS.MEP.FEATURES // ANALYTICS' : 'Módulos de Integración Activos'}</p>
          </div>
        )}

        <div className={cfg.customLayout === 'mep' ? 'grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3 auto-rows-[250px]' : (cfg.customLayout === 'roads' ? 'grid grid-cols-1 md:grid-cols-12 gap-3' : (cfg.customLayout === 'manage' ? 'grid grid-cols-1 md:grid-cols-3 gap-3 auto-rows-[250px]' : 'grid grid-cols-1 md:grid-cols-3 gap-3'))}>
          {cfg.features.map((f, i) => {
            const isSpan = cfg.customLayout === 'roads' ? f.span : (f.span ? (cfg.customLayout === 'mep' ? f.span : (cfg.customLayout === 'manage' ? 'md:col-span-2' : 'col-span-1 md:col-span-2 lg:col-span-2')) : '');
            return (
              <div
                key={i}
                className={`border p-6 flex flex-col justify-between group transition-all relative overflow-hidden ${isSpan} ${f.highlight ? '' : ''}`}
                style={{
                  background: cfg.customLayout === 'mep' ? (f.span ? '#1e2024' : '#1a1c20') : '#1a1c20',
                  borderColor: f.highlight ? cfg.accent : '#3a494a',
                  boxShadow: f.highlight ? `0 0 15px -3px ${cfg.accent}` : 'none'
                }}
              >
                <div className="z-10 flex flex-col gap-4">
                  <div
                    className="w-12 h-12 flex items-center justify-center border group-hover:border-primary transition-colors"
                    style={{
                      background: '#111317',
                      borderColor: '#3a494a',
                      color: cfg.accent
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>{f.icon}</span>
                  </div>
                  <h3 className="text-lg font-semibold text-on-surface" style={{ fontFamily: 'Hanken Grotesk, sans-serif' }}>{f.title}</h3>
                  <p className="text-sm text-on-surface-variant max-w-sm">{f.desc}</p>
                  
                  {f.tags && (
                    <div className="flex gap-2 mt-2">
                      {f.tags.map(t => (
                        <span key={t} className="text-[10px] px-2 py-1 border border-outline-variant text-on-surface-variant" style={{ background: '#111317', fontFamily: 'Geist, monospace' }}>{t}</span>
                      ))}
                    </div>
                  )}
                  {f.highlight && (
                    <span className="text-[10px] flex items-center gap-1 mt-1" style={{ fontFamily: 'Geist, monospace', color: '#ffb4ab' }}>
                      <span className="w-1.5 h-1.5 bg-error rounded-full animate-pulse" /> AUTO-SCAN ACTIVE
                    </span>
                  )}
                </div>

                {f.badge && (
                  <div className="z-10 mt-4 border-t border-outline-variant pt-4">
                    <span className="text-[13px] flex items-center gap-2" style={{ fontFamily: 'Geist, monospace', color: f.badgeColor || 'inherit' }}>
                      {f.badgeColor && <span className="w-1.5 h-1.5" style={{ background: f.badgeColor }} />} {f.badge}
                    </span>
                  </div>
                )}
                {f.terminal && (
                  <div className="mt-auto text-[13px] text-outline bg-surface p-2 border border-outline-variant" style={{ fontFamily: 'Geist, monospace', color: '#8AB4D6' }}>
                    {f.terminal.map((line, j) => (
                      <div key={j}>&gt; {line}</div>
                    ))}
                  </div>
                )}
                {f.autoSize && (
                  <div className="mt-auto flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm" style={{ color: '#79ff5b' }}>check_box</span>
                    <span className="text-[11px] tracking-[0.08em] font-bold text-on-surface uppercase" style={{ fontFamily: 'Geist, monospace' }}>AUTO-SIZE ON</span>
                  </div>
                )}

                {/* Custom feature-specific widgets */}
                {cfg.customLayout === 'terrain' && f.title.includes('Volúmenes') && (
                  <div className="mt-4 border border-outline-variant p-4 grid grid-cols-2 gap-4" style={{ background: '#111317' }}>
                    <div>
                      <div className="text-[11px] tracking-[0.08em] font-bold text-on-surface-variant mb-1 uppercase" style={{ fontFamily: 'Geist, monospace' }}>Volumen de Corte</div>
                      <div className="text-[13px]" style={{ fontFamily: 'Geist, monospace', color: '#ffb4ab' }}>45,230.5 m³</div>
                    </div>
                    <div>
                      <div className="text-[11px] tracking-[0.08em] font-bold text-on-surface-variant mb-1 uppercase" style={{ fontFamily: 'Geist, monospace' }}>Volumen de Relleno</div>
                      <div className="text-[13px] text-primary" style={{ fontFamily: 'Geist, monospace', color: 'var(--acc)' }}>38,105.2 m³</div>
                    </div>
                  </div>
                )}
                {cfg.customLayout === 'terrain' && f.title.includes('CivilRoads') && (
                  <div className="mt-auto pt-4 flex items-center gap-2">
                    <span className="w-2 h-2 bg-secondary rounded-full" />
                    <span className="text-[11px] tracking-[0.08em] font-bold text-on-surface uppercase" style={{ fontFamily: 'Geist, monospace' }}>Seamless Sync Active</span>
                  </div>
                )}
                {cfg.customLayout === 'manage' && f.title.includes('Costos') && (
                  <div className="flex items-end gap-2 font-bold text-[13px]" style={{ fontFamily: 'Geist, monospace', color: cfg.accent }}>
                    <span className="material-symbols-outlined text-sm animate-pulse">sensors</span> Live Data Feed Active
                  </div>
                )}
                {cfg.customLayout === 'manage' && f.title.includes('Cronogramas') && (
                  <div className="w-full h-2 mt-4 flex overflow-hidden" style={{ background: '#111317' }}>
                    <div className="w-1/3" style={{ background: '#3a494a' }} />
                    <div className="w-1/2" style={{ background: cfg.accent }} />
                    <div className="w-1/6" style={{ background: '#37393e' }} />
                  </div>
                )}
                {cfg.customLayout === 'roads' && f.title.includes('Diseño Geométrico') && (
                  <div className="mt-8 flex items-center gap-2 uppercase cursor-pointer hover:underline" style={{ fontFamily: 'Geist, monospace', fontSize: 11, fontWeight: 700, color: '#00dce5' }}>
                    Explorar Herramientas <span className="material-symbols-outlined text-sm">arrow_outward</span>
                  </div>
                )}
              </div>
            );
          })}

          {/* Extra block for layouts */}
          {cfg.customLayout === 'structure' && (
            <div className="border border-outline-variant flex flex-col hidden lg:flex" style={{ background: '#1a1c20' }}>
              <div className="border-b border-outline-variant p-2 flex justify-between items-center" style={{ background: '#1e2024' }}>
                <span className="text-[13px] text-on-surface-variant" style={{ fontFamily: 'Geist, monospace' }}>NODE_MONITOR</span>
                <span className="w-2 h-2 bg-secondary rounded-full animate-pulse" style={{ background: 'var(--ok)' }} />
              </div>
              <div className="p-4 flex-grow text-[10px] text-outline leading-tight space-y-1" style={{ fontFamily: 'Geist, monospace', color: 'var(--txt3)' }}>
                <div>&gt; INIT SOLVER ENGINE v4.2.1</div>
                <div>&gt; MESHING GEOMETRY... [DONE]</div>
                <div>&gt; APPLYING BOUNDARY COND...</div>
                <div className="text-primary" style={{ color: 'var(--acc)' }}>&gt; RUNNING EIGENVALUE ANALYSIS</div>
                <div className="flex justify-between border-t border-outline-variant mt-2 pt-2">
                  <span>MODE_1</span><span>2.45 Hz</span>
                </div>
                <div className="flex justify-between">
                  <span>MODE_2</span><span>5.12 Hz</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sync table inside features container for BIM */}
        {cfg.syncRows && (
          <div className="mt-6 border border-outline-variant flex flex-col overflow-hidden w-full" style={{ background: '#1a1c20' }}>
            <div className="flex items-center justify-between px-4 py-2 border-b border-outline-variant" style={{ background: '#0c0e12' }}>
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-on-surface-variant text-base">table_rows</span>
                <h3 className="text-[13px] text-on-surface-variant uppercase" style={{ fontFamily: 'Geist, monospace' }}>Sincronización Datos de Campo</h3>
              </div>
              <span className="text-[10px] px-2 py-0.5 border" style={{ fontFamily: 'Geist, monospace', color: '#79ff5b', borderColor: '#2ff80133', background: 'rgba(47,248,1,0.1)' }}>LIVE CONNECTION</span>
            </div>
            <div className="flex-grow p-4 flex gap-4 overflow-x-auto">
              <div className="min-w-[600px] w-full flex flex-col gap-1 text-[12px]" style={{ fontFamily: 'Geist, monospace' }}>
                <div className="grid grid-cols-5 text-on-surface-variant border-b border-outline-variant pb-1 mb-1 uppercase text-[10px]">
                  <span>ID Elemento</span><span>Categoría</span><span>Estado Terreno</span><span>Desviación (mm)</span><span>Validación</span>
                </div>
                {cfg.syncRows.map(r => (
                  <div key={r.id} className="grid grid-cols-5 text-on-surface py-1 hover:bg-surface-container transition-colors">
                    <span style={{ color: '#00dce5' }}>{r.id}</span>
                    <span>{r.cat}</span>
                    <span>{r.estado}</span>
                    <span style={{ color: r.desvColor }}>{r.desv}</span>
                    <span style={{ color: r.validColor }}>{r.valid}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Normas inside features container for Flow */}
        {cfg.normas && (
          <div className="mt-6 border-t border-outline-variant pt-6">
            <h4 className="text-[11px] tracking-[0.08em] font-bold text-on-surface mb-3 uppercase" style={{ fontFamily: 'Geist, monospace' }}>Cumplimiento Normativo</h4>
            <ul className="flex flex-col gap-2">
              {cfg.normas.map((n, i) => (
                <li key={i} className="flex items-center gap-2 text-[13px] text-on-surface-variant" style={{ fontFamily: 'Geist, monospace' }}>
                  <span className="material-symbols-outlined text-primary text-sm" style={{ color: cfg.accent }}>check_circle</span> {n}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Specifications table section (Only for Flow) */}
      {cfg.specs && (
        <section className="py-12 px-6 lg:px-8 max-w-6xl mx-auto">
          <h2 className="text-xl font-semibold text-on-surface border-b border-outline-variant pb-4 mb-6" style={{ fontFamily: 'Hanken Grotesk, sans-serif' }}>ESPECIFICACIONES DEL MÓDULO</h2>
          <div className="border border-outline-variant overflow-auto" style={{ background: '#1e2024' }}>
            <table className="w-full text-left text-sm min-w-[600px]">
              <caption style={{position:'absolute',width:'1px',height:'1px',padding:0,margin:'-1px',overflow:'hidden',clip:'rect(0,0,0,0)',whiteSpace:'nowrap',border:0}}>Especificaciones del módulo</caption>
              <thead className="border-b border-outline-variant" style={{ background: '#282a2e' }}>
                <tr>
                  <th scope="col" className="p-4 w-1/4 text-[11px] tracking-[0.08em] font-bold text-on-surface uppercase" style={{ fontFamily: 'Geist, monospace' }}>Parámetro</th>
                  <th scope="col" className="p-4 w-1/4 text-[11px] tracking-[0.08em] font-bold text-on-surface uppercase" style={{ fontFamily: 'Geist, monospace' }}>Red Hidráulica</th>
                  <th scope="col" className="p-4 w-1/4 text-[11px] tracking-[0.08em] font-bold text-on-surface uppercase" style={{ fontFamily: 'Geist, monospace' }}>Saneamiento</th>
                  <th scope="col" className="p-4 w-1/4 text-[11px] tracking-[0.08em] font-bold text-on-surface uppercase" style={{ fontFamily: 'Geist, monospace' }}>Red de Gas</th>
                </tr>
              </thead>
              <tbody className="text-on-surface-variant">
                {cfg.specs.map((s, i) => (
                  <tr key={i} className="border-b border-outline-variant/50 hover:bg-surface-container-highest transition-colors">
                    <td className="p-4 text-[13px]" style={{ fontFamily: 'Geist, monospace' }}>{s.param}</td>
                    <td className="p-4">{s.hid}</td>
                    <td className="p-4">{s.san}</td>
                    <td className="p-4">{s.gas}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Call To Action bottom block */}
      {cfg.customLayout === 'flow' ? (
        <section className="py-16 px-6 lg:px-8">
          <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 border border-outline-variant p-6 md:p-8" style={{ background: '#282a2e' }}>
            <div className="flex flex-col gap-6">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#00f5ff' }} />
                <span className="text-[13px]" style={{ fontFamily: 'Geist, monospace', color: '#00f5ff' }}>SISTEMA ONLINE</span>
              </div>
              <h2 className="text-2xl font-bold text-on-surface" style={{ fontFamily: 'Hanken Grotesk, sans-serif' }}>Validación de Datos en su Propio Terreno</h2>
              <p className="text-sm text-on-surface-variant">Solicite acceso a nuestro entorno de pruebas sandbox. Suba un KML de muestra y experimente el ruteo automático y cálculo de presiones en tiempo real.</p>
              <div className="flex gap-4 mt-2">
                <input aria-label="Correo electrónico corporativo" className="px-4 py-3 flex-grow outline-none text-on-surface border-b border-outline-variant focus:border-primary transition-colors" style={{ fontFamily: 'Geist, monospace', fontSize: 13, background: '#0A0C0E' }} placeholder="INGRESAR_CORREO_CORPORATIVO" type="email" />
                <button className="px-6 py-3 uppercase text-[11px] tracking-[0.08em] font-bold text-on-primary flex items-center gap-2" style={{ fontFamily: 'Geist, monospace', background: '#00f5ff' }}>
                  Solicitar Demo <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </button>
              </div>
            </div>
            <div className="hidden md:flex justify-end opacity-50">
              <div className="w-64 h-64 border border-outline-variant rounded-full flex items-center justify-center relative">
                <div className="w-48 h-48 border border-primary/30 rounded-full animate-[spin_10s_linear_infinite]" style={{ borderColor: 'rgba(0,220,229,0.3)' }} />
                <div className="absolute w-32 h-32 border border-secondary/20 rounded-full" />
                <span className="material-symbols-outlined text-4xl text-outline-variant absolute">hub</span>
              </div>
            </div>
          </div>
        </section>
      ) : cfg.customLayout === 'structure' ? (
        <section className="py-20 px-6 lg:px-8 relative overflow-hidden" style={{ background: '#0c0e12' }}>
          <div className="max-w-4xl mx-auto text-center relative z-10">
            <h2 className="text-2xl font-bold text-on-surface mb-6" style={{ fontFamily: 'Hanken Grotesk, sans-serif' }}>Precisión Analítica para Infraestructura Crítica</h2>
            <p className="text-base text-on-surface-variant mb-8 max-w-2xl mx-auto">
              Únase a los equipos de ingeniería que confían en CivilStructure para validar la seguridad estructural de sus proyectos más exigentes.
            </p>
            <button className="bg-primary text-on-primary px-8 py-4 uppercase text-[11px] tracking-[0.08em] font-bold hover:bg-primary-fixed transition-all" style={{ fontFamily: 'Geist, monospace', background: cfg.accent, boxShadow: `0 0 15px ${cfg.accent}4d`, color: '#000' }}>
              SOLICITAR LICENCIA DE PRUEBA
            </button>
          </div>
        </section>
      ) : null}
    </ModulePageLayout>
  );
}
