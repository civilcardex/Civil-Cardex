// Pestaña activa del workarea flow SINCRONIZADA CON LA URL (ped. usuario: subrutas
// /civilflowareatrabajo/<proyecto>/<pestaña>): la verdad es el segmento de ruta (validado
// contra NAV_TABS); sessionStorage queda como fallback para redirects de recarga completa
// (el switch de proyecto usa window.location.replace) y OPEN_TAB_KEY como legado.

/** Ids internos de las pestañas del workarea flow aceptados en la URL (la verdad de qué pestaña
 *  está activa es el segmento de ruta, validado aquí). Ej: 'info', 'planos', 'visor'. */
const TABS_VALIDOS: readonly string[] = [
  'info',
  'planos',
  'datos',
  'visor',
  'redes',
  'iso',
  'inf',
  'crit',
];

/** Slug de URL EXPLÍCITO por pestaña (ped. usuario: la URL debe decir qué hay): los ids
 *  internos (state/keys de tour/ayuda/sessionStorage) NO cambian — solo el segmento de ruta.
 *  Ej: 'planos' -> 'cargaPlanos' (ruta /civilflowareatrabajo/<proyecto>/cargaPlanos). */
export const TAB_SLUGS: Record<string, string> = {
  info: 'informacionGeneral',
  planos: 'cargaPlanos',
  datos: 'parametrosDiseno',
  visor: 'dibujoRedes',
  redes: 'disenoRedes',
  iso: 'isometria',
  inf: 'informes',
  crit: 'normativa',
};
const TAB_DE_SLUG: Record<string, string> = Object.fromEntries(
  Object.entries(TAB_SLUGS).map(([id, slug]) => [slug, id]),
);

/** Lee la pestaña de un splat de ruta (por SLUG explícito): primera válida gana. */
function tabDeSplat(splat: string | undefined): string | null {
  if (!splat) return null;
  for (const seg of splat.split('/')) {
    const id = TAB_DE_SLUG[seg];
    if (id) return id;
  }
  return null;
}

/** Construye la ruta del workarea preservando proyecto + pestaña. */
export function rutaFlow(proyectoId: string | undefined, tab: string | undefined | null): string {
  const partes: string[] = [];
  if (proyectoId) partes.push(proyectoId);
  if (tab && TABS_VALIDOS.includes(tab)) partes.push(TAB_SLUGS[tab] ?? tab);
  return `/civilflowareatrabajo${partes.length ? '/' + partes.join('/') : ''}`;
}

const ES_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Parsea el splat del workarea flow: uuid → proyecto; id no-uuid → enlace legacy; pestaña
 *  válida → tab. Ej: '<uuid>/planos' → { proyectoId, tab }; '123' → { legacyId: '123' }. */
export function parseFlowSplat(splat: string | undefined): {
  proyectoId?: string;
  tab?: string;
  legacyId?: string;
} {
  const segs = (splat ?? '').split('/').filter(Boolean);
  if (segs.length === 0) return {};
  if (ES_UUID.test(segs[0])) {
    const resto = segs.slice(1).join('/');
    return {
      proyectoId: segs[0],
      tab: tabDeSplat(resto) ?? undefined,
    };
  }
  // id no-uuid: puede ser un enlace legacy O un deep-link de pestaña sin proyecto.
  const tabSolo = tabDeSplat(segs[0]);
  if (tabSolo) return { tab: tabSolo };
  return { legacyId: segs[0] };
}

// ── CivilManager ──
/** Secciones válidas del workarea CivilManager en la URL: catalogos, apus (Análisis de
 *  Precios Unitarios) y presupuestos. */
export const CM_SECCIONES: readonly string[] = ['catalogos', 'apus', 'presupuestos'];
/** Pestañas válidas dentro de la sección 'catalogos' de CivilManager (configuracion,
 *  colaboradores, cuadrillas, equipos, insumos, proveedores). */
export const CM_CATALOGOS: readonly string[] = [
  'configuracion',
  'colaboradores',
  'cuadrillas',
  'equipos',
  'insumos',
  'proveedores',
];

/** Parsea el splat de CivilManager: uuid → proyecto; luego sección/sub válidas. */
export function parseManagerSplat(splat: string | undefined): {
  proyectoId?: string;
  seccion?: string;
  catalogoTab?: string;
  legacyId?: string;
} {
  const segs = (splat ?? '').split('/').filter(Boolean);
  if (segs.length === 0) return {};
  if (ES_UUID.test(segs[0])) {
    const seccion = CM_SECCIONES.includes(segs[1] ?? '') ? segs[1] : undefined;
    const catalogoTab =
      seccion === 'catalogos' && CM_CATALOGOS.includes(segs[2] ?? '') ? segs[2] : undefined;
    return { proyectoId: segs[0], seccion, catalogoTab };
  }
  if (CM_SECCIONES.includes(segs[0])) {
    const seccion = segs[0];
    const catalogoTab =
      seccion === 'catalogos' && CM_CATALOGOS.includes(segs[1] ?? '') ? segs[1] : undefined;
    return { seccion, catalogoTab };
  }
  return { legacyId: segs[0] };
}

/** Ruta de CivilManager preservando proyecto + sección + catálogo. */
export function rutaManager(
  proyectoId: string | undefined,
  seccion: string | undefined,
  catalogoTab?: string | undefined,
): string {
  const partes: string[] = [];
  if (proyectoId) partes.push(proyectoId);
  if (seccion && CM_SECCIONES.includes(seccion)) {
    partes.push(seccion);
    if (seccion === 'catalogos' && catalogoTab && CM_CATALOGOS.includes(catalogoTab))
      partes.push(catalogoTab);
  }
  return `/civilmanagerareatrabajo${partes.length ? '/' + partes.join('/') : ''}`;
}
