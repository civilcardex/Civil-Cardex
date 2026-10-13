/** Tutoriales por sección del modal de ayuda (YouTube/Vimeo embebido).
 *
 *  Cómo agregar un video:
 *  1. Sube el video a YouTube (no listado) o Vimeo y copia su ID
 *     (YouTube: el `v=` o el tramo final del link; Vimeo: el número del link).
 *  2. Añade una entrada con la MISMA clave que reporta el panel de ayuda
 *     (cf:info · cf:planos · cf:datos · cf:visor · cf:redes:<red> · cf:iso:<1-5> ·
 *      cm:catalogos:<tab> · cm:apus · cm:presupuestos).
 *  3. Las claves sin entrada no muestran la sección; una clave específica puede caer a su
 *     prefijo (cf:redes:san → cf:redes) si no tiene video propio.
 *
 *  Ejemplo:
 *  'cf:visor': { titulo: 'Dibujar redes sobre el plano', yt: 'dQw4w9WgXcQ' },
 *  'cm:apus': { titulo: 'Análisis de precios unitarios', vimeo: '76979871' },
 */
export interface Tutorial {
  titulo: string;
  /** ID de YouTube (se embebe vía youtube-nocookie). */
  yt?: string;
  /** ID de Vimeo (se embebe vía player.vimeo.com). */
  vimeo?: string;
}

/** DEMO solo en desarrollo (ped. usuario: "video cualquiera en todas las secciones, es para
 *  ver cómo se ve") — import.meta.env.DEV es false en el build de producción, así que nunca
 *  llega a prod. Al cargar videos reales: crear el mapa TUTORIALES (ver doc arriba) y
 *  resolver exacto → prefijo → DEMO. */
const DEMO: Tutorial | null = import.meta.env.DEV
  ? { titulo: 'Video de prueba', yt: 'dQw4w9WgXcQ' }
  : null;

/** Tutorial de una clave de ayuda (hoy siempre el DEMO en dev, null en prod). */
export function tutorialDe(_key: string): Tutorial | null {
  return DEMO;
}
