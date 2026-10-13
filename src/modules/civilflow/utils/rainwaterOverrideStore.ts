import { LL_OVERRIDES_MIRROR_KEY } from '../constants/storage-keys';
import { loadFromStorage, saveToStorage, getActiveProyectoId } from '../services/storageService';
import type { BajanteLL, CanalLL } from '../context/RainwaterContext';

/** Espejo local de overrides ll (puente entre instancias del provider). */
export interface OverridesMirror {
  proyectoId?: string | null;
  bajantes?: BajanteLL[];
  canales?: CanalLL[];
  /** Claves borradas (bajante||id / sector||id) que no deben resucitar. */
  tumbas?: string[];
}

/** Clave estable de un override de bajante: código o id. */
export function claveBajante(t: { id: string; bajante?: string }): string {
  return t.bajante || t.id;
}

/** Clave estable de un override de canal: sector o id. */
export function claveCanal(t: { id: string; sector?: string }): string {
  return t.sector || t.id;
}

/** Base de un chip "CODE-PISO" (BALL11-P1 → BALL11, nunca caza BALL1). */
export function baseDeChip(chip: string): string {
  return chip.split('-')[0];
}

/** Agrega una clave a las tumbas (sin duplicados). */
export function agregarTumba(tumbas: string[], clave: string): string[] {
  return tumbas.includes(clave) ? tumbas : [...tumbas, clave];
}

/** Levanta la tumba de una clave (idempotente). */
export function quitarTumba(tumbas: string[], clave: string): string[] {
  return tumbas.includes(clave) ? tumbas.filter((t) => t !== clave) : tumbas;
}

/** Clave del espejo de un proyecto (por proyecto, sin colisiones). */
export function claveEspejo(proyectoId: string): string {
  return `${LL_OVERRIDES_MIRROR_KEY}${proyectoId}`;
}

/** Lee el espejo local del proyecto activo (puente entre instancias). */
export function leerEspejo(): OverridesMirror | null {
  const pid = getActiveProyectoId();
  if (!pid) return null;
  const m = loadFromStorage<OverridesMirror | null>(claveEspejo(pid), null);
  if (!m || m.proyectoId !== pid) return null;
  return m;
}

/** Guarda el espejo local (filtra filas efímeras sin clave). */
export function guardarEspejo(
  proyectoId: string,
  bajantes: BajanteLL[],
  canales: CanalLL[],
  tumbas?: string[],
): void {
  saveToStorage(claveEspejo(proyectoId), {
    proyectoId,
    bajantes: bajantes.filter((b) => (b.bajante ?? '').trim().length > 0),
    canales: canales.filter((c) => (c.sector ?? '').trim().length > 0),
    tumbas: tumbas ?? [],
  });
}

/** Une listas por clave (local manda; tumbas bloquean remotos). */
export function unirOverrides<T extends { id: string }>(
  locales: T[],
  clave: (t: T) => string,
  remotos: T[],
  tumbas?: string[] | Set<string> | null,
): T[] {
  const vivos = tumbas
    ? remotos.filter((r) => {
        const k = clave(r);
        return Array.isArray(tumbas) ? !tumbas.includes(k) : !tumbas.has(k);
      })
    : remotos;
  if (locales.length === 0) return vivos;
  if (vivos.length === 0) return locales;
  const vistas = new Set(locales.map(clave));
  return [...locales, ...vivos.filter((r) => !vistas.has(clave(r)))];
}
