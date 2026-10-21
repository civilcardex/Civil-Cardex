/** Tutoriales por sección del modal de ayuda (YouTube/Vimeo embebido). Cómo agregar un video: 1. */
export interface Tutorial {
  titulo: string;
  /** ID de YouTube (se embebe vía youtube-nocookie). */
  yt?: string;
  /** ID de Vimeo (se embebe vía player.vimeo.com). */
  vimeo?: string;
}

/** DEMO solo en desarrollo (ped. usuario: "video cualquiera en todas las secciones, es para ver cómo se ve") — import.meta.env.DEV es
 * false en el build de producción, así que nunca llega a prod. */
const DEMO: Tutorial | null = import.meta.env.DEV
  ? { titulo: 'Video de prueba', yt: 'dQw4w9WgXcQ' }
  : null;

/** Tutorial de una clave de ayuda (hoy siempre el DEMO en dev, null en prod). */
export function tutorialDe(_key: string): Tutorial | null {
  return DEMO;
}
