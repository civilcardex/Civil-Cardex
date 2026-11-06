/** Fuente ÚNICA de metas de las rutas públicas prerenderizables: la consume el prerender
 *  (scripts/prerender.mjs vía dist-ssr) y sirve de referencia para los usePageMeta de cada
 *  página — servidor y cliente no divergen. Las rutas privadas NO van aquí. */
import { MODULES_DATA } from '../pages/moduleData.ts';

export interface RouteMeta {
  path: string;
  title: string;
  description: string;
  changefreq: 'monthly' | 'weekly' | 'yearly';
  priority: string;
  /** Última fecha en que cambió el CONTENIDO de la ruta (YYYY-MM-DD). No es la fecha de
   *  build: un lastmod que se mueve en cada deploy sin cambio real hace que el crawler
   *  deje de confiar en él. Actualizar a mano SOLO al cambiar contenido. Ej: '2026-10-20'. */
  lastmod: string;
}

/** Dominio canónico del sitio: arma canonical/og:url del prerender y del sitemap. */
export const SITE_URL = 'https://civilcardex.com';

/** Las 11 rutas públicas con su title/description y señales de sitemap (changefreq/priority). Ej: la ruta '/' prioridad 1.0. */
export const ROUTE_META: RouteMeta[] = [
  {
    path: '/',
    title: 'Inicio',
    description: 'Plataforma de ingeniería civil para diseño hidráulico, sanitario y estructural',
    changefreq: 'monthly',
    priority: '1.0',
    lastmod: '2026-10-20',
  },
  {
    path: '/pricing',
    title: 'Precios',
    description:
      'Compre CivilCardex por módulo: CivilFlow y CivilManager, mensual, semestral o anual, con descuentos acumulativos. Pago seguro con tarjeta (Lemon Squeezy).',
    changefreq: 'weekly',
    priority: '0.7',
    lastmod: '2026-10-20',
  },
  {
    path: '/docs',
    title: 'Documentación',
    description:
      'Guía completa de CivilCardex. Normas NTC 1500, RAS 2000, NTC 3728. Tutoriales de diseño hidrosanitario y estructural.',
    changefreq: 'weekly',
    priority: '0.7',
    lastmod: '2026-10-20',
  },
  {
    path: '/civilflow',
    title: 'Civil Flow',
    description: MODULES_DATA.flow.description,
    changefreq: 'monthly',
    priority: '0.8',
    lastmod: '2026-10-20',
  },
  {
    path: '/civilstructure',
    title: 'Civil Structure',
    description: MODULES_DATA.structure.description,
    changefreq: 'monthly',
    priority: '0.8',
    lastmod: '2026-10-20',
  },
  {
    path: '/civilterrain',
    title: 'Civil Terrain',
    description: MODULES_DATA.terrain.description,
    changefreq: 'monthly',
    priority: '0.8',
    lastmod: '2026-10-20',
  },
  {
    path: '/civilmanager',
    title: 'Civil Manager',
    description: MODULES_DATA.manage.description,
    changefreq: 'monthly',
    priority: '0.8',
    lastmod: '2026-10-20',
  },
  {
    path: '/civilroads',
    title: 'Civil Roads',
    description: MODULES_DATA.roads.description,
    changefreq: 'monthly',
    priority: '0.8',
    lastmod: '2026-10-20',
  },
  {
    path: '/terminos',
    title: 'Términos y Condiciones',
    description:
      'Términos y condiciones de uso de CivilCardex: cuenta de usuario, suscripciones por módulo con renovación manual, propiedad intelectual, datos personales y ley aplicable colombiana.',
    changefreq: 'yearly',
    priority: '0.3',
    lastmod: '2026-10-20',
  },
  {
    path: '/privacidad',
    title: 'Política de Privacidad',
    description:
      'Política de tratamiento de datos personales de CivilCardex conforme a la Ley 1581 de 2012: datos tratados, finalidades, derechos del titular y procedimientos.',
    changefreq: 'yearly',
    priority: '0.3',
    lastmod: '2026-10-20',
  },
  {
    path: '/cookies',
    title: 'Política de Cookies',
    description:
      'Política de cookies y almacenamiento local de CivilCardex: qué se guarda, para qué, y cómo gestionar el consentimiento.',
    changefreq: 'yearly',
    priority: '0.3',
    lastmod: '2026-10-20',
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
