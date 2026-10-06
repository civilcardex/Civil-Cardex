import { loadFromStorage, saveToStorage, saveTrazosToDB } from '../services/storageService';
import {
  TRAZOS_PREFIX,
  TRAZOS_PLAN_PREFIX,
  APARATOS_BY_TRAMO_KEY,
  HYDRO_DATA_STORAGE_KEY,
} from '../constants/storage-keys';

interface HealBajante {
  id?: string;
  origenId?: string | null;
  bombaEnId?: string | null;
  ucAplicado?: Record<string, Record<string, number>>;
  ucAplicadoHidro?: Record<string, Record<string, number>>;
}

/** Sanador del trinquete de herencia invertida (orig. usuario: 12 UD abajo → 16 al reentrar).
 *  Mientras el guard de dirección de la propagación en vivo estuvo muerto (leía `p.npt`, campo
 *  inexistente), el efecto con el piso INFERIOR cargado trató al bajante inferior como fuente:
 *  sumó sus UD locales a la herencia y escribió el resultado en el piso SUPERIOR (claves de
 *  ramales + libro falso + espejo LD falso). Revierte EXACTO restando el libro (misma resta que
 *  clearBajanteAssociation), borra el libro y sus espejos LD. Libro falso = titular SIN
 *  `origenId` y SIN `bombaEnId` (no recibe de nadie), u `origenId` a plan CONOCIDO estrictamente
 *  abajo; origen desconocido o empate → legítimo, no se toca. Storage-only, idempotente. */
export function healHerenciaInvertida(
  plans: Array<{ id: string | number; nivel: number | string | null }>,
): boolean {
  const nivelDe = new Map<string, number>();
  for (const p of plans) {
    const n = p.nivel == null ? NaN : Number(p.nivel);
    if (Number.isFinite(n)) nivelDe.set(String(p.id), n);
  }
  if (nivelDe.size === 0) return false;
  let aposDirty = false;
  let changed = false;
  const apos = loadFromStorage<Record<string, Record<string, number>>>(APARATOS_BY_TRAMO_KEY, {});
  const hydro = loadFromStorage<
    Record<string, { accesorios?: Record<string, number>; Lh?: number; nSalidas?: number }>
  >(HYDRO_DATA_STORAGE_KEY, {});
  let hydroDirty = false;
  const bogusIds = new Map<string, number>(); // id → nivel del piso donde vivía el libro falso

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(TRAZOS_PLAN_PREFIX)) continue;
    const raw = localStorage.getItem(key) || '';
    if (!raw.includes('"ucAplicado"')) continue;
    const pid = key.slice(TRAZOS_PLAN_PREFIX.length);
    const nivPid = nivelDe.get(pid);
    if (nivPid == null) continue; // piso sin nivel conocido: no juzgar
    let doc: { bajantes?: HealBajante[]; ts?: number };
    try {
      doc = JSON.parse(raw);
    } catch {
      continue;
    }
    let docDirty = false;
    for (const b of doc.bajantes || []) {
      const libro = b.ucAplicado;
      if (!libro || Object.keys(libro).length === 0) continue;
      const o = (b.origenId || '').split('|')[0];
      const nivO = o ? nivelDe.get(o) : undefined;
      // Regla ESTRUCTURAL (no de niveles): un titular solo recibe herencia vía `origenId`
      // (bajante↔bajante) o `bombaEnId` (bomba) — sin punteros, cualquier libro es del
      // trinquete invertido. Con origenId es falso SOLO si el plan origen es CONOCIDO y está
      // estrictamente ABAJO; nivel desconocido (lista de planes parcial) o empate (regla del
      // apply) → legítimo, no se toca (orig. usuario: el sanador borraba libros legítimos).
      if (b.bombaEnId) continue;
      if (!o) {
        // sin punteros: libro falso estructural → sanar
      } else if (nivO === undefined || nivO >= nivPid) {
        continue;
      }
      for (const [tk, m] of Object.entries(libro)) {
        const cur = apos[tk];
        if (cur) {
          for (const [k, v] of Object.entries(m)) {
            const nv = (cur[k] || 0) - (Number(v) || 0);
            if (nv > 0) cur[k] = nv;
            else delete cur[k];
          }
          if (Object.keys(cur).length === 0) delete apos[tk];
          aposDirty = true;
        }
        const h = hydro[tk];
        const mh = b.ucAplicadoHidro?.[tk];
        if (h && mh) {
          const acc = { ...(h.accesorios || {}) };
          for (const [k, v] of Object.entries(mh)) {
            const nv = (acc[k] || 0) - (Number(v) || 0);
            if (nv > 0) acc[k] = nv;
            else delete acc[k];
          }
          h.accesorios = acc;
          if (Object.keys(acc).length === 0) delete h.accesorios;
          if (!h.accesorios && !((h.Lh ?? 0) > 0) && !((h.nSalidas ?? 0) > 0)) delete hydro[tk];
          hydroDirty = true;
        }
      }
      if (b.id) bogusIds.set(b.id, nivPid);
      delete b.ucAplicado;
      delete b.ucAplicadoHidro;
      docDirty = true;
    }
    if (docDirty) {
      doc.ts = Date.now();
      saveToStorage(TRAZOS_PREFIX + pid, doc);
      saveTrazosToDB(pid, doc);
      changed = true;
    }
  }

  // Espejos LD falsos del titular falso: el LD legítimo del titular vive en el piso de ABAJO
  // (descarga hacia abajo) — solo se borra el espejo situado EN su piso o ARRIBA (el trinquete
  // escribía hacia arriba). El guion final del prefijo evita colisión (BAN1 vs BAN10).
  for (const [X, homeNiv] of bogusIds) {
    // MONTANTES entre pisos (orig. usuario): el sanado de espejos invertidos cubre también
    // las redes de suministro donde viven.
    for (const net of ['san', 'll', 'af', 'ac', 'gas', 'vent']) {
      const pref = `${net}_LD_${X}_`;
      for (const k of Object.keys(apos)) {
        if (!k.startsWith(pref)) continue;
        const nivQ = nivelDe.get(k.slice(pref.length));
        if (nivQ == null || nivQ < homeNiv) continue; // espejo legítimo (piso de abajo)
        delete apos[k];
        aposDirty = true;
      }
      for (const k of Object.keys(hydro)) {
        if (!k.startsWith(pref)) continue;
        const nivQ = nivelDe.get(k.slice(pref.length));
        if (nivQ == null || nivQ < homeNiv) continue;
        delete hydro[k];
        hydroDirty = true;
      }
    }
  }

  if (aposDirty) saveToStorage(APARATOS_BY_TRAMO_KEY, apos);
  if (hydroDirty) saveToStorage(HYDRO_DATA_STORAGE_KEY, hydro);
  return changed || aposDirty || hydroDirty;
}
