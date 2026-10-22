import { loadFromStorage, saveToStorage } from '../../services/storageService.ts';
import { despacharStorage } from './books';
import { TRAZOS_PREFIX, BAJADAS_RECEPTORAS_KEY } from '../../constants/storage-keys.ts';
import {
  cntVacio,
  mezclarMax,
  sumaCnt,
  type Cnt,
  type RawBaj,
  type RawRam,
  type RamalP,
  type BajanteP,
} from './counting.ts';

/** Pisos que tienen dibujo guardado (ids leídos de las claves civilflow_trazos_*).
 *  EXCLUYE respaldos: los `_bak` (era del sanador de herencia) son documentos completos bajo
 *  el mismo prefijo — tratarlos como piso inyectaba sus piezas DOS veces en la propagación
 *  y doblaba los aparatos de los elementos enlazados (dump 2026-10-22). */
function idsDePlanos(): string[] {
  const out: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(`civilflow_${TRAZOS_PREFIX}`)) {
        const pid = k.slice(`civilflow_${TRAZOS_PREFIX}`.length);
        if (pid.endsWith('_bak')) continue;
        out.push(pid);
      }
    }
  } catch {
    return [];
  }
  return out;
}

/** Avisa a tablas y panel que los conteos cambiaron (tolerante si no hay window). */

/**
 * Fases 1 y 2: recolecta las piezas de la red en TODOS los planos y calcula la carga de cada
 * bajante/montante (clave propia + libro de herencia, con MÁXIMO).
 * @returns null si la red no tiene piezas (no hay nada que propagar).
 */
export function leerPiezas(
  net: 'af' | 'ac' | 'gas',
  disk: Record<string, Cnt>,
  libros: Record<string, Cnt>,
  bajadasLibro: Record<string, number>,
  diag: Record<string, unknown>,
): { ramales: RamalP[]; bajes: BajanteP[] } | null {
  // 1) Recolectar ramales + bajantes de la red en TODOS los planos con trazos. Cada
  //    pieza viaja con su pid: los ids se repiten entre pisos y NADA puede llavearse por
  //    id pelado (orig. auditoría: herencia fantasma cross-piso).
  const ramales: Array<RawRam & { key: string; pid: string }> = [];
  const bajes: Array<RawBaj & { pid: string }> = [];
  for (const pid of idsDePlanos()) {
    const raw = loadFromStorage<{ ramales?: RawRam[]; bajantes?: RawBaj[] } | string | null>(
      `${TRAZOS_PREFIX}${pid}`,
      null,
    );
    if (!raw) continue;
    let d = raw as { ramales?: RawRam[]; bajantes?: RawBaj[] };
    if (typeof raw === 'string') {
      try {
        d = JSON.parse(raw);
      } catch {
        continue;
      }
    }
    for (const r of d.ramales || []) {
      if (r.net !== net) continue;
      ramales.push({ ...r, key: `${net}_${r.id}_${pid}`, pid });
    }
    for (const b of d.bajantes || []) {
      if (b.net === net) bajes.push({ ...b, pid });
    }
    diag.piezas = ramales.map((r) => ({
      id: r.id,
      key: r.key,
      tipo: r.tipo || '',
      padre: r.padre || '',
      rev: !!r._tribReversed,
      ini: r.ini || '',
      fin: r.fin || '',
      apI: r.aparatoInicio || '',
      apF: r.aparatoFin || '',
      pts: r.pts || [],
      disk: disk[r.key] || {},
      her: libros[r.key] || {},
    }));
    diag.bajLibro = { ...bajadasLibro };
  }
  if (ramales.length === 0) {
    // Sin piezas de la red: marcadores de ESTA red son fósiles (tramos borrados) — fuera.
    // Las otras redes conservan sus marcas (libro compartido cross-net: podarlo alternaba
    // bug/reparación en la 1ª selección tras reingresar — orig. usuario RAC3/RAC2).
    const fosiles = Object.keys(bajadasLibro).filter((k) => k.startsWith(`${net}_`));
    if (fosiles.length > 0) {
      for (const k of fosiles) delete bajadasLibro[k];
      saveToStorage(BAJADAS_RECEPTORAS_KEY, bajadasLibro);
    }
    despacharStorage();
    return null;
  }
  const vivas = new Set(ramales.map((r) => r.key));
  // Poda de marcadores fósiles SOLO de la red actual. El libro es COMPARTIDO entre redes
  // — podar con `vivas` de una sola red borraba las marcas de las demás y la doctrina de
  // bajadas alternaba bug/reparación en cada secuencia (orig. usuario RAC3/RAC2).
  {
    const prefijo = `${net}_`;
    let podadas = false;
    for (const k of Object.keys(bajadasLibro)) {
      if (k.startsWith(prefijo) && !vivas.has(k)) {
        delete bajadasLibro[k];
        podadas = true;
      }
    }
    if (podadas) saveToStorage(BAJADAS_RECEPTORAS_KEY, bajadasLibro);
  }

  return { ramales, bajes };
}

export function calcularCargaBajantes(
  net: 'af' | 'ac' | 'gas',
  disk: Record<string, Cnt>,
  bajes: BajanteP[],
): Map<string, Cnt> {
  // 2) Carga de cada bajante/montante (por plano): clave exacta propia + libro ucAplicado
  //    (herencia del piso inferior). Sin scan por prefijo: contaba la semilla dos veces y
  //    mezclaba pisos. Solo fallback a la clave legacy sin sufijo cuando la exacta está vacía.
  const cargaBaj = new Map<string, Cnt>(); // `${id}|${pid}`
  for (const b of bajes) {
    // Lo PROPIO del bajante (sus aparatos directos) + lo HEREDADO (el libro). El libro se toma
    // con MÁXIMO por aparato, no sumando: la asociación entre pisos deja la MISMA carga en
    // cada pieza que la recibió (el Ldesvio + los ramales del destino) y sumarlas entregaba
    // esa carga repetida (4 piezas x 3 UC = 12 UC en vez de 3). El panel ya lo hacía con
    // máximo (libroHeredado) — aquí se replica para que lo que baja aguas abajo sea lo mismo
    // que muestra el panel.
    const propio: Cnt = { ...(disk[`${net}_${b.id}_${b.pid}`] || {}) };
    if (cntVacio(propio)) Object.assign(propio, disk[`${net}_${b.id}_P`] || {});
    let libro: Cnt = {};
    for (const m of Object.values(b.ucAplicado || {})) libro = mezclarMax(libro, m);
    const c = sumaCnt(propio, libro);
    cargaBaj.set(`${b.id}|${b.pid}`, cntVacio(c) ? {} : c);
  }
  return cargaBaj;
}
