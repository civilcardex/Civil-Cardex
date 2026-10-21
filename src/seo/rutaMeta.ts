/** Fuente ÚNICA de metas de las rutas públicas prerenderizables: la consume el prerender
 *  (scripts/prerender.mjs vía dist-ssr) y sirve de referencia para los usePageMeta de cada
 *  página — servidor y cliente no divergen. Las rutas privadas NO van aquí. */
export interface RouteMeta {
  path: string;
  title: string;
  description: string;
  changefreq: 'monthly' | 'weekly' | 'yearly';
  priority: string;
}

export const SITE_URL = 'https://civilcardex.com';

export const ROUTE_META: RouteMeta[] = [
  {
    path: '/',
    title: 'Inicio',
    description: 'Plataforma de ingeniería civil para diseño hidráulico, sanitario y estructural',
    changefreq: 'monthly',
    priority: '1.0',
  },
  {
    path: '/pricing',
    title: 'Precios',
    description:
      'Compre CivilCardex por módulo: CivilFlow y CivilManager, mensual, semestral o anual, con descuentos acumulativos. Pago seguro con tarjeta (Lemon Squeezy).',
    changefreq: 'weekly',
    priority: '0.7',
  },
  {
    path: '/docs',
    title: 'Documentación',
    description:
      'Guía completa de CivilCardex. Normas NTC 1500, RAS 2000, NTC 3728. Tutoriales de diseño hidrosanitario y estructural.',
    changefreq: 'weekly',
    priority: '0.7',
  },
  {
    path: '/civilflow',
    title: 'Civil Flow',
    description:
      'Diseño y cálculo de redes hidrosanitarias (AF, AC, sanitaria, lluvias, gas, RCI) con verificación normativa IPC/UPC, ASCE, NFPA 54 y NFPA 13 y memorias de cálculo exportables.',
    changefreq: 'monthly',
    priority: '0.8',
  },
  {
    path: '/civilstructure',
    title: 'Estructuras',
    description:
      'Diseño estructural avanzado con análisis FEM. Cálculo de cargas sísmicas, viento y cimentaciones según normativa.',
    changefreq: 'monthly',
    priority: '0.8',
  },
  {
    path: '/civilterrain',
    title: 'Terreno',
    description:
      'Modelado digital de elevación con datos LiDAR. Cálculo de volúmenes, curvas de nivel e interoperabilidad topográfica.',
    changefreq: 'monthly',
    priority: '0.8',
  },
  {
    path: '/civilbim',
    title: 'BIM',
    description:
      'Modelado BIM para infraestructura civil. Integración IFC, Revit, detección de colisiones y coordinación multidisciplinar.',
    changefreq: 'monthly',
    priority: '0.8',
  },
  {
    path: '/civilmanager',
    title: 'Civil Manager',
    description:
      'Presupuestos de obra civil: APU (análisis de precios unitarios) con mano de obra, insumos, equipo y transporte, catálogos de proveedores y configuración de perfil país y factor prestacional.',
    changefreq: 'monthly',
    priority: '0.8',
  },
  {
    path: '/civilmep',
    title: 'MEP',
    description:
      'Modelado MEP de sistemas mecánicos, eléctricos e hidrosanitarios. Ruteo inteligente y dimensionamiento normativo.',
    changefreq: 'monthly',
    priority: '0.8',
  },
  {
    path: '/civilroads',
    title: 'Vías',
    description:
      'Diseño geométrico de carreteras, urbanismo, peraltes y alineamientos. Simulación de tráfico e impacto vial integrada.',
    changefreq: 'monthly',
    priority: '0.8',
  },
  {
    path: '/terminos',
    title: 'Términos y Condiciones',
    description:
      'Términos y condiciones de uso de CivilCardex: cuenta de usuario, suscripciones por módulo con renovación manual, propiedad intelectual, datos personales y ley aplicable colombiana.',
    changefreq: 'yearly',
    priority: '0.3',
  },
  {
    path: '/privacidad',
    title: 'Política de Privacidad',
    description:
      'Política de tratamiento de datos personales de CivilCardex conforme a la Ley 1581 de 2012: datos tratados, finalidades, derechos del titular y procedimientos.',
    changefreq: 'yearly',
    priority: '0.3',
  },
  {
    path: '/cookies',
    title: 'Política de Cookies',
    description:
      'Política de cookies y almacenamiento local de CivilCardex: qué se guarda, para qué, y cómo gestionar el consentimiento.',
    changefreq: 'yearly',
    priority: '0.3',
  },
];

/**
 * Metas de una ruta (título y descripción), leídas de la fuente ÚNICA.
 *
 * Las páginas la usan en vez de reescribir el texto a mano: antes cada `usePageMeta` repetía
 * su propio título y el prerender usaba el de ROUTE_META — dos copias que podían divergir
 * (el crawler veía una cosa y el navegador otra).
 * @param path - la ruta (con o sin barra inicial).
 * @returns título y descripción, o null si la ruta no está en el catálogo.
 */
export function metaDeRuta(path: string): { title: string; description: string } | null {
  const limpio = path.replace(/\/+$/, '') || '/';
  const meta = ROUTE_META.find((m) => m.path === limpio);
  if (!meta) return null;
  return { title: meta.title, description: meta.description };
}
