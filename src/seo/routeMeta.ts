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
  /** Solo rutas de CONTENIDO editorial (artículos /aprende): el prerender inyecta JSON-LD
   *  schema.org/Article con estos datos. Ej: { autor: 'Equipo CivilCardex', fechaPublicacion: '2026-11-11', descripcion: 'Resumen del artículo…' }. */
  articulo?: ArticuloMeta;
}

/** Datos del artículo que viajan al JSON-LD schema.org/Article (los inyecta scripts/prerender.mjs).
 *  Ej: { autor: 'Equipo CivilCardex', fechaPublicacion: '2026-11-11', descripcion: 'Cómo la curva de Hunter convierte UC en caudal.' }. */
export interface ArticuloMeta {
  /** Nombre del autor que va en schema.org/author. Ej: 'Equipo CivilCardex'. */
  autor: string;
  /** Fecha de publicación original del artículo (YYYY-MM-DD). Ej: '2026-11-11'. */
  fechaPublicacion: string;
  /** Resumen del artículo para el JSON-LD (puede ser más largo que la description de la ruta). Ej: 'Cómo dimensionar caudales con la curva de Hunter según NTC 1500.'. */
  descripcion: string;
}

/** Dominio canónico del sitio: arma canonical/og:url del prerender y del sitemap. */
export const SITE_URL = 'https://civilcardex.com';

/** Las 14 rutas públicas con su title/description y señales de sitemap (changefreq/priority). Ej: la ruta '/' prioridad 1.0. */
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
  {
    path: '/aprende',
    title: 'Aprende — artículos técnicos de diseño hidrosanitario',
    description:
      'Índice de artículos técnicos de diseño hidrosanitario colombiano: método Hunter y NTC 1500, fuerza tractiva y RAS 2000, con ejemplos numéricos.',
    changefreq: 'monthly',
    priority: '0.5',
    lastmod: '2026-11-11',
  },
  {
    path: '/aprende/hunter-ntc-1500',
    title: 'Método Hunter en la NTC 1500: el quiebre de 240 UC',
    description:
      'Cómo la curva de Hunter convierte UC (Unidades de Consumo) en caudal de diseño: la fórmula 0.1163·UC^0.6875 cambia a 0.074·UC^0.7504 a partir de 240 UC. Ejemplo numérico completo y errores comunes.',
    changefreq: 'monthly',
    priority: '0.6',
    lastmod: '2026-11-11',
    articulo: {
      autor: 'Equipo CivilCardex',
      fechaPublicacion: '2026-11-11',
      descripcion:
        'Qué es la probabilidad de uso simultáneo, cómo se asignan UC a cada aparato según NTC 1500, por qué la fórmula de Hunter cambia en 240 UC y cómo calcular el caudal de diseño paso a paso con un baño completo de ejemplo.',
    },
  },
  {
    path: '/aprende/fuerza-tractiva-sanitaria',
    title: 'Fuerza tractiva en redes sanitarias: autolimpieza y RAS 2000',
    description:
      'Qué es la fuerza tractiva (τ = ρ·g·Rh·S), por qué decide la autolimpieza de una red sanitaria, el error de subir el diámetro "por si acaso" y los criterios de verificación de RAS 2000 y NTC 1500, con ejemplo numérico.',
    changefreq: 'monthly',
    priority: '0.6',
    lastmod: '2026-11-11',
    articulo: {
      autor: 'Equipo CivilCardex',
      fechaPublicacion: '2026-11-11',
      descripcion:
        'Qué es la tensión tractiva, cómo se calcula con τ = ρ·g·Rh·S, qué criterios de autolimpieza aplican en Colombia (RAS 2000 y NTC 1500) y cómo influyen diámetro y pendiente, con un ejemplo numérico completo.',
    },
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
