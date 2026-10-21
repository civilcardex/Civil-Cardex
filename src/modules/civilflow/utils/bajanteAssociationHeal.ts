import {
  loadFromStorage,
  saveToStorage,
  saveTrazosLocales,
  saveTrazosToDB,
} from '../services/storageService.ts';
import {
  TRAZOS_PREFIX,
  TRAZOS_PLAN_PREFIX,
  APARATOS_BY_TRAMO_KEY,
  HYDRO_DATA_STORAGE_KEY,
} from '../constants/storage-keys.ts';

interface HealBajante {
  id?: string;
  net?: string;
  origenId?: string | null;
  bombaEnId?: string | null;
  recibeDeIds?: string[];
  ucAplicado?: Record<string, Record<string, number>>;
  ucAplicadoHidro?: Record<string, Record<string, number>>;
}

/** Revierte herencia invertida (UD (Unidades de Desague) sumada al piso equivocado): resta el libro falso. */
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
    // COPIA DE SEGURIDAD del doc tal como estaba ANTES de sanar (objeto aparte: sanar
    // muta `doc`): el sanado es heurístico y antes no tenía reversa — el borrado quedaba
    // en la BD y no se podía recuperar.
    const docPrevio = JSON.parse(raw) as typeof doc;
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
      // La entrada de la CLAVE PROPIA (`net_id_plan`) NO es una herencia falsa: es la carga
      // que el propio bajante recibe de sus ramales (la escribe 5bis y la lee el panel).
      // Se preserva intacta — antes se restaba del conteo del usuario y se borraba su
      // libro entero (pérdida de datos que además se subía a la BD).
      const propiaKey = b.id ? `${b.net ?? ''}_${b.id}_${pid}` : null;
      if (!o) {
        // Sin punteros: el libro se considera falso estructural (salvo la clave propia).
      } else if (nivO === undefined || nivO >= nivPid) {
        continue;
      }
      for (const [tk, m] of Object.entries(libro)) {
        // La clave propia NO se resta: es la carga real del bajante, no una herencia falsa.
        if (propiaKey && tk === propiaKey) continue;
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
      // Se borra el libro falso pero SE CONSERVA la entrada de la clave propia (si existe).
      if (b.ucAplicado) {
        if (propiaKey && b.ucAplicado[propiaKey]) {
          const soloPropia = { [propiaKey]: b.ucAplicado[propiaKey] };
          b.ucAplicado = soloPropia;
        } else {
          delete b.ucAplicado;
        }
      }
      if (b.ucAplicadoHidro) {
        if (propiaKey && b.ucAplicadoHidro[propiaKey]) {
          b.ucAplicadoHidro = { [propiaKey]: b.ucAplicadoHidro[propiaKey] };
        } else {
          delete b.ucAplicadoHidro;
        }
      }
      docDirty = true;
    }
    if (docDirty) {
      // Copia de seguridad ANTES de reescribir (el sanado no tiene reversa).
      try {
        saveToStorage(`${TRAZOS_PREFIX}${pid}_bak`, docPrevio);
      } catch {
        /* best-effort: sin quota no hay copia */
      }
      doc.ts = Date.now();
      // saveTrazosLocales (no saveToStorage): preserva la marca `assocLayout`, que el
      // guardado crudo perdía -> la migración de layout se re-corria en cada carga.
      saveTrazosLocales(pid, doc as unknown as Record<string, unknown>);
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
