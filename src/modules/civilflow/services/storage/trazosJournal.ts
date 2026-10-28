/** Diario de escrituras del doc de trazos (solo DEV): quién escribió, cuándo y con cuántos
 *  elementos. Es la caja negra del "los elementos no se guardan": el dump `__cfSave` del
 *  2026-10-28 mostró la CUBIERTA con 0 ramales en local Y en BD con el MISMO ts fresco — o
 *  sea que alguien ESCRIBIÓ el vacío y lo subió; sin el nombre del escritor no se puede
 *  arreglar (había 5 candidatos y todos parecían inocentes). Se lee con `__cfJournal()`.
 *
 *  La clave vive FUERA del namespace `civilflow_` a propósito: el reset del workspace borra
 *  todo lo que empieza por `civilflow_` y la caja negra tiene que sobrevivir justo a eso.
 *  En producción no se escribe nada (gate DEV).
 *  Ej: `journalTrazos('local', 1792625272195678, doc)` deja una línea con ram/baj/gho + stack.
 */
const JOURNAL_KEY = 'cardex_trazos_journal_v1';
const MAX_ENTRADAS = 120;

export interface TrazosJournalEntry {
  /** Hora UTC legible (hh:mm:ss.mmm): comparable con los ts de `__cfSave`. */
  t: string;
  plan: string;
  /** local | db | db-block | persist-block | wipe */
  op: string;
  ram?: number;
  baj?: number;
  gho?: number;
  ts?: number | null;
  detalle?: string;
  /** 5 marcos del stack: quién llamó (el escritor real, no el wrapper). */
  stack?: string;
}

/** Cuenta las colecciones del doc (las mismas que mira trazosDocHasContent) + su ts. */
function conteos(doc: unknown): { ram?: number; baj?: number; gho?: number; ts?: number | null } {
  if (!doc || typeof doc !== 'object') return {};
  const d = doc as Record<string, unknown>;
  const n = (k: string): number | undefined =>
    Array.isArray(d[k]) ? (d[k] as unknown[]).length : undefined;
  return {
    ram: n('ramales'),
    baj: n('bajantes'),
    gho: n('crossFloorGhosts'),
    ts: typeof d.ts === 'number' ? d.ts : null,
  };
}

/** Anota una escritura/lectura destructiva del doc de trazos. Best-effort: nunca lanza ni
 *  bloquea el guardado real (si el storage está lleno, el diario se pierde y ya). */
export function journalTrazos(
  op: TrazosJournalEntry['op'],
  plan: string | number,
  doc?: unknown,
  detalle?: string,
): void {
  try {
    if (!import.meta.env.DEV) return;
    const prev = JSON.parse(localStorage.getItem(JOURNAL_KEY) || '[]') as TrazosJournalEntry[];
    const stack = (new Error().stack || '')
      .split('\n')
      .slice(2, 8)
      .map((l) => l.trim().replace(/^at\s+/, ''))
      .join(' < ')
      .slice(0, 500);
    prev.push({
      t: new Date().toISOString().slice(11, 23),
      plan: String(plan),
      op,
      ...conteos(doc),
      detalle,
      stack,
    });
    localStorage.setItem(JOURNAL_KEY, JSON.stringify(prev.slice(-MAX_ENTRADAS)));
  } catch {
    /* diagnóstico best-effort */
  }
}

/** Devuelve el diario (más viejo primero) para volcarlo en consola. */
export function leerJournalTrazos(): TrazosJournalEntry[] {
  try {
    return JSON.parse(localStorage.getItem(JOURNAL_KEY) || '[]') as TrazosJournalEntry[];
  } catch {
    return [];
  }
}

/** Borra el diario (empezar una reproducción limpia). */
export function limpiarJournalTrazos(): void {
  try {
    localStorage.removeItem(JOURNAL_KEY);
  } catch {
    /* ignore */
  }
}
