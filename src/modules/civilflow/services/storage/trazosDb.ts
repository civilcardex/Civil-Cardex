// Sync de trazos con Supabase: cola por plano, merge con disco, usuario cacheado y carga.
// Extraído verbatim de storageService.
import { devError } from '../../../../utils/devError';
import { supabase } from '../../../../lib/supabase';
import {
  TRAZOS_PREFIX,
  APARATOS_BY_TRAMO_KEY,
  HYDRO_DATA_STORAGE_KEY,
  GAS_ACC_KEY,
} from '../../constants/storage-keys';
import type { PlanoWorkData } from '../../lib/PlanoEngine/PlanoPersistence';
import { dedupPorId, mergeBajanteDedup } from '../../lib/PlanoEngine/PlanoPersistence';
import {
  getActiveProyectoId,
  loadFromStorage,
  saveToStorage,
  type PlanTrazos,
} from './localStorage';
import type { CrossFloorGhost } from '../../lib/shared/crossFloorGhostTypes';
import type { SupabaseRow } from './planoRowMappers';
import type {
  PlanoRamal,
  PlanoBajante,
  PlanoArea,
  PlanoDimension,
  PlanoTextAnnotation,
  PlanoGuideLine,
} from '../../lib/PlanoEngine/PlanoState';
import {
  ramalToRow,
  rowToRamal,
  bajanteToRow,
  rowToBajante,
  areaToRow,
  rowToArea,
  dimToRow,
  rowToDim,
  textAnnotToRow,
  rowToTextAnnot,
  guideLineToRow,
  rowToGuideLine,
  ghostToRow,
  rowToGhost,
} from './planoRowMappers';
export function emitBdSaveError(reason: string, message: string): void {
  try {
    window.dispatchEvent(
      new CustomEvent('civilflow_bd_save_error', { detail: { reason, message } }),
    );
  } catch {
    /* sin window (tests) */
  }
}

/** Guardado a BD OK — apaga la alerta roja del visor (franja vuelve al estado normal). */
function emitBdSaveOk(): void {
  try {
    window.dispatchEvent(new CustomEvent('civilflow_bd_save_ok'));
  } catch {
    /* sin window (tests) */
  }
}

/** ¿El documento de trazos tiene contenido real (alguna colección con elementos)? La usan la
 *  tumba anti-vacío del guardado y el árbitro de carga: un documento sin contenido (todas las
 *  colecciones ausentes o en 0) NUNCA debe reemplazar a uno con contenido — el RPC de guardado
 *  es destructivo (borra y re-inserta todo) y el árbitro prefiere el mayor ts, así que un vacío
 *  con ts fresco borraba el piso (orig. usuario: "todo se borró excepto un piso"). */
export function trazosDocHasContent(doc: unknown): boolean {
  if (!doc || typeof doc !== 'object') return false;
  const d = doc as Record<string, unknown>;
  return [
    'ramales',
    'bajantes',
    'areas',
    'dims',
    'textAnnots',
    'guideLines',
    'crossFloorGhosts',
  ].some((k) => Array.isArray(d[k]) && (d[k] as unknown[]).length > 0);
}

/** Regla anti-vaciado del árbitro de carga: la caché local gana sobre una fila BD SIN contenido
 *  aunque el ts de la BD sea mayor — un vaciado accidental estampa ts=ahora y el mayor-ts
 *  mandaba, borrando el piso. Devuelve true si la local debe ganar por contenido. */
export function trazosLocalGanaABdVacia(local: unknown, db: unknown): boolean {
  return trazosDocHasContent(local) && !trazosDocHasContent(db);
}

// Cola por plano: el RPC es destructivo (borra y reinserta colecciones) y hay decenas de
// llamadores fire-and-forget (autosave, escritores cross-floor, copiar plano). Dos pushes
// en vuelo para el mismo plano podían aterrizar en orden arbitrario y dejar el doc viejo
// último en BD. Los pushes de planos DISTINTOS siguen en paralelo.
const trazosSaveQueue = new Map<string, Promise<void>>();

/** Guarda los trazos de un plano en BD (BD local? no — Supabase vía RPC). Serializa por
 *  plano: una nueva llamada espera a que termine la anterior del MISMO plano. */
export function saveTrazosToDB(planoId: string, data: unknown): Promise<void> {
  const key = String(planoId);
  const prev = trazosSaveQueue.get(key) ?? Promise.resolve();
  const job = prev.catch(() => {}).then(() => doSaveTrazosToDB(planoId, data));
  trazosSaveQueue.set(
    key,
    job.finally(() => {
      if (trazosSaveQueue.get(key) === job) trazosSaveQueue.delete(key);
    }),
  );
  return job;
}

async function doSaveTrazosToDB(planoId: string, data: unknown): Promise<void> {
  try {
    // Los ids de plano son numéricos (Date.now*1000+rand). Un uuid aquí es un plano fantasma
    // (estado de sesión contaminado): bloquear antes del RPC — el RPC espera bigint.
    if (!/^\d+$/.test(planoId)) {
      devError('storageService saveTrazosToDB: planoId no numérico descartado', planoId);
      return;
    }
    // Tumba anti-vacío (antes del check de sesión: abort barato): el RPC borra y re-inserta
    // TODAS las colecciones del piso. Un payload sin contenido (engine a medio hidratar,
    // guardado en la ventana de cambio de piso, escritor cross-floor sobre caché ausente...)
    // con ts fresco borraba el piso en BD y el árbitro de carga lo consolidaba. Si la caché
    // local aún tiene contenido, un push vacío es un defecto de origen: se aborta y se avisa.
    // (El borrado legítimo converge: el autosave ya vació la caché local, así que el push
    // vacío siguiente sí pasa.)
    if (!trazosDocHasContent(data)) {
      const local = loadFromStorage<unknown>(TRAZOS_PREFIX + planoId, null);
      if (trazosDocHasContent(local)) {
        devError(
          'storageService saveTrazosToDB: push vacío bloqueado sobre caché con contenido',
          planoId,
        );
        emitBdSaveError(
          'vacio',
          'Guardado a BD abortado: el trabajo está vacío pero el plano tiene datos guardados.',
        );
        return;
      }
    }

    const user = await cachedSupabaseUser();
    if (!user) {
      emitBdSaveError('sin-sesion', 'No hay sesión activa en Supabase.');
      return;
    }

    const proyectoId = getActiveProyectoId();
    if (!proyectoId) {
      emitBdSaveError(
        'sin-proyecto',
        'No hay proyecto activo seleccionado (clave ' + 'de proyecto ausente).',
      );
      return;
    }

    const id = Number(planoId);
    if (!Number.isFinite(id)) {
      emitBdSaveError('plano-invalido', `Id de plano no numérico: ${planoId}`);
      return;
    }

    const d = (data ?? {}) as Partial<PlanoWorkData>;

    // Los conteos de Aparato/UD y los accesorios hidro/gas solo viven en localStorage
    // (FixturesPanel.tsx / GasDesign.tsx, clave compuesta `${net}_${ramalId}_${planId}`) —
    // adjuntamos el mapa propio de cada ramal antes de sincronizar para que llegue a la BD
    // vía planos_ramales.fixtures / hydro_accesorios / gas_accesorios, en vez de perderse
    // fuera de este equipo.
    const aparatosMap = loadFromStorage<Record<string, Record<string, number>>>(
      APARATOS_BY_TRAMO_KEY,
      {},
    );
    const hidroMap = loadFromStorage<
      Record<string, { accesorios: Record<string, number>; Lh: number; nSalidas: number }>
    >(HYDRO_DATA_STORAGE_KEY, {});
    const gasMap = loadFromStorage<Record<string, Record<string, number>>>(GAS_ACC_KEY, {});
    // Dedup por id: un documento viejo con el mismo bajante/ramal DOS veces hacía que el RPC
    // fallara entero ("ON CONFLICT DO UPDATE cannot affect row a second time", 500) y ningún
    // dato del piso llegaba a la BD.
    const ramales = dedupPorId(
      ((d.ramales ?? []) as PlanoRamal[]).map((r) => {
        const apKey = `${r.net}_${r.id}_${planoId}`;
        const fixtures = aparatosMap[apKey];
        const hydroEntry = hidroMap[apKey];
        const hydroAcc =
          hydroEntry &&
          (Object.keys(hydroEntry.accesorios ?? {}).length > 0 ||
            (hydroEntry.Lh ?? 0) > 0 ||
            (hydroEntry.nSalidas ?? 0) > 0)
            ? hydroEntry
            : undefined;
        const gasEntry = gasMap[apKey];
        const gasAcc = gasEntry && Object.keys(gasEntry).length > 0 ? gasEntry : undefined;
        return fixtures || hydroAcc || gasAcc ? { ...r, fixtures, hydroAcc, gasAcc } : r;
      }),
    );
    // Los aparatos propios del calentador (asignados directo a la bajante CALENTn, clave
    // `ac_<calId>_<planoId>` o `af_<calId>_<planoId>`) no tienen un ramal real donde viajar —
    // el stub sintético AC-01-{calId} solo existe en la memoria de buildTramos. Se persiste aquí
    // para que los conteos sobrevivan a recarga/otro dispositivo; loadTrazosFromDB lo mapea de
    // vuelta a la clave del calentador.
    const ramalIds = new Set(ramales.map((r) => r.id));
    for (const cal of (d.bajantes ?? []) as PlanoBajante[]) {
      if (cal.tipo !== 'calentador') continue;
      const calId = cal.code || cal.id;
      const stubId = `AC-01-${calId}`;
      if (ramalIds.has(stubId)) continue;
      const fixtures =
        aparatosMap[`ac_${calId}_${planoId}`] || aparatosMap[`af_${calId}_${planoId}`];
      if (!fixtures || Object.keys(fixtures).length === 0) continue;
      const hydroEntry = hidroMap[`ac_${calId}_${planoId}`] || hidroMap[`af_${calId}_${planoId}`];
      const hydroAcc =
        hydroEntry &&
        (Object.keys(hydroEntry.accesorios ?? {}).length > 0 ||
          (hydroEntry.Lh ?? 0) > 0 ||
          (hydroEntry.nSalidas ?? 0) > 0)
          ? hydroEntry
          : undefined;
      ramales.push({
        id: stubId,
        net: 'ac',
        tipo: 'ramal',
        padre: null,
        pts: [],
        totalL: 0,
        label: stubId,
        ini: 'AF',
        fin: calId,
        piso: String(cal.pisoBase ?? cal.piso ?? 0),
        dz: '',
        uc: 0,
        labelX: 0,
        labelY: 0,
        labelAngle: 0,
        material: '',
        diametro: '',
        pendiente: 0,
        bloqueado: true,
        fixtures,
        hydroAcc,
      } as unknown as PlanoRamal);
    }
    const areas = (d.areas ?? []) as PlanoArea[];
    const dims = (d.dims ?? []) as PlanoDimension[];
    const textAnnots = (d.textAnnots ?? []) as PlanoTextAnnotation[];
    const guideLines = (d.guideLines ?? []) as PlanoGuideLine[];
    const crossFloorGhosts = (d.crossFloorGhosts ?? []) as CrossFloorGhost[];
    const bajantes = dedupPorId((d.bajantes ?? []) as PlanoBajante[], mergeBajanteDedup);

    // Un solo payload jsonb → el RPC SECURITY DEFINER valida propiedad/estructura/caps y hace
    // upsert de cabecera + reemplazo de colecciones + rebuild de bajante_conexiones en una
    // transacción atómica (antes eran ~12 llamadas directas: fallos parciales dejaban estados
    // corruptos). recibe_de_ids/alimenta_ids viajan como arrays por bajante (el server los
    // resuelve contra los ids sustitutos; descarga_en_id ya va en el row de la bajante).
    const payload = {
      header: {
        proyecto_id: proyectoId,
        v: d.v ?? 6,
        scaleM: d.scaleM ?? 0.5,
        definedScaleM: d.definedScaleM ?? 0,
        activeNet: d.activeNet ?? 'af',
        zoom: d.zoom ?? 1,
        offX: d.offX ?? 0,
        offY: d.offY ?? 0,
        lineWidth: d.lineWidth ?? 1,
        ts: d.ts ? new Date(d.ts).toISOString() : new Date().toISOString(),
      },
      ramales: ramales.map((r) => ramalToRow(id, user.id, r)),
      bajantes: bajantes.map((b) => {
        // BOMBAS/BAJANTES también llevan sus UDs a la BD (claves net_<id>_<plano>) — antes
        // solo los ramales persistían fixtures y sus claves no se podían recuperar jamás
        // (orig. usuario: aparatos a 0 tras reentrar).
        const bkKey = `${(b as unknown as { net?: string }).net || ''}_${b.id}_${planoId}`;
        const bFix = aparatosMap[bkKey];
        const row = bajanteToRow(id, user.id, b);
        return {
          ...row,
          fixtures: bFix && Object.keys(bFix).length ? bFix : row.fixtures,
          recibe_de_ids: b.recibeDeIds ?? [],
          alimenta_ids: b.alimentaIds ?? [],
        };
      }),
      areas: areas.map((a) => areaToRow(id, user.id, a)),
      dimensiones: dims.map((x) => dimToRow(id, user.id, x)),
      anotaciones_texto: textAnnots.map((t) => textAnnotToRow(id, user.id, t)),
      lineas_guia: guideLines.map((g) => guideLineToRow(id, user.id, g)),
      fantasmas_entrepisos: crossFloorGhosts.map((g) => ghostToRow(id, user.id, g)),
    };

    const { error } = await supabase.rpc('save_plano_data', {
      p_plano_id: id,
      p_data: payload,
    });
    if (error) {
      devError('storageService saveTrazosToDB rpc:', error.message);
      emitBdSaveError('rpc', error.message);
    } else {
      emitBdSaveOk();
    }
  } catch (e) {
    devError('storageService saveTrazosToDB exception:', e);
    emitBdSaveError('excepcion', e instanceof Error ? e.message : String(e));
  }
}

/**
 * Carga el estado completo de dibujo de un plano desde Supabase en una sola ida y vuelta vía
 * el RPC get_plano_data (cabecera + ramales + bajantes + conexiones + areas + dims +
 * anotaciones + líneas guía + cross-floor ghosts), en lugar de 8 selects secuenciales.
 */
// ponytail: cache Supabase user to avoid a network auth.getUser() round-trip on every plan load.
// La caché se invalida en CUALQUIER cambio de estado de auth (logout, refresh de token, cambio
// de usuario) — sin eso, un null capturado antes de restaurar la sesión dejaba todos los
// guardados en sin-sesion hasta recargar (y un logout/login escribía con el user_id viejo).
let _cachedUserPromise: Promise<{ id: string } | null> | null = null;
function cachedSupabaseUser(): Promise<{ id: string } | null> {
  if (!_cachedUserPromise) {
    _cachedUserPromise = supabase.auth
      .getUser()
      .then(({ data: { user } }) => user || null)
      .catch((e) => {
        _cachedUserPromise = null; // un fallo transitorio no queda cacheado
        throw e;
      });
  }
  return _cachedUserPromise;
}
// optional chaining: los mocks de test construyen auth mínimo sin este listener
supabase.auth.onAuthStateChange?.(() => {
  _cachedUserPromise = null;
});

export async function loadTrazosFromDB(planoId: string): Promise<PlanTrazos | null> {
  try {
    const user = await cachedSupabaseUser();
    if (!user) return null;

    const id = Number(planoId);
    if (!Number.isFinite(id)) return null;

    const { data, error } = await supabase.rpc('get_plano_data', { p_plano_id: id });
    if (error) {
      devError('storageService loadTrazosFromDB:', error.message);
      return null;
    }
    if (!data || !data.plano) return null;

    const result = data as {
      plano?: {
        version?: number;
        ts?: string;
        scale_m?: number;
        defined_scale_m?: number;
        active_net?: string;
        zoom?: number;
        off_x?: number;
        off_y?: number;
        line_width?: number;
      };
      bajantes?: SupabaseRow[];
      ramales?: SupabaseRow[];
      bajante_conexiones?: {
        origen_client_id: string;
        destino_client_id: string;
        tipo: 'recibe' | 'alimenta' | 'descarga';
      }[];
      areas?: SupabaseRow[];
      dimensiones?: SupabaseRow[];
      anotaciones_texto?: SupabaseRow[];
      lineas_guia?: SupabaseRow[];
      fantasmas_entrepisos?: SupabaseRow[];
    };
    const plano = result.plano || {};

    const bajantes = (result.bajantes ?? []).map(rowToBajante);
    const conexiones = (result.bajante_conexiones ?? []) as {
      origen_client_id: string;
      destino_client_id: string;
      tipo: 'recibe' | 'alimenta' | 'descarga';
    }[];
    const byClientId = new Map<string, PlanoBajante>(
      bajantes.map((b: PlanoBajante): [string, PlanoBajante] => [b.id, b]),
    );
    for (const c of conexiones) {
      const origen = byClientId.get(c.origen_client_id);
      if (!origen) continue;
      if (c.tipo === 'recibe') origen.recibeDeIds.push(c.destino_client_id);
      else if (c.tipo === 'alimenta') origen.alimentaIds.push(c.destino_client_id);
      else if (c.tipo === 'descarga') origen.descargaEnId = c.destino_client_id;
    }

    const work: PlanTrazos = {
      v: plano.version,
      ts: plano.ts ? new Date(plano.ts).getTime() : undefined,
      scaleM: plano.scale_m,
      definedScaleM: plano.defined_scale_m,
      activeNet: plano.active_net,
      zoom: plano.zoom,
      offX: plano.off_x,
      offY: plano.off_y,
      lineWidth: plano.line_width,
      ramales: (result.ramales ?? []).map(rowToRamal),
      bajantes,
      areas: (result.areas ?? []).map(rowToArea),
      dims: (result.dimensiones ?? []).map(rowToDim),
      textAnnots: (result.anotaciones_texto ?? []).map(rowToTextAnnot),
      guideLines: (result.lineas_guia ?? []).map(rowToGuideLine),
      crossFloorGhosts: (result.fantasmas_entrepisos ?? []).map(rowToGhost),
      nptLevels: [],
      nets: [],
    };
    // Devolvemos los fixtures y accesorios hidro/gas que viajan en la BD por cada ramal a los
    // mapas de localStorage que FixturesPanel.tsx / GasDesign.tsx realmente leen
    // (APARATOS_BY_TRAMO_KEY / HYDRO_DATA_STORAGE_KEY / GAS_ACC_KEY) — si no, un plano cargado
    // fresco en otro dispositivo/sesión mostraría el panel Aparatos vacío pese a que la BD
    // tiene los datos.
    const existingAparatos = loadFromStorage<Record<string, Record<string, number>>>(
      APARATOS_BY_TRAMO_KEY,
      {},
    );
    let aparatosChanged = false;
    const mergedAparatos = { ...existingAparatos };
    const existingHidro = loadFromStorage<
      Record<string, { accesorios: Record<string, number>; Lh: number; nSalidas: number }>
    >(HYDRO_DATA_STORAGE_KEY, {});
    let hidroChanged = false;
    const mergedHidro = { ...existingHidro };
    const existingGas = loadFromStorage<Record<string, Record<string, number>>>(GAS_ACC_KEY, {});
    let gasChanged = false;
    const mergedGas = { ...existingGas };
    for (const b of bajantes as PlanoBajante[]) {
      if (!b.fixtures || Object.keys(b.fixtures).length === 0) continue;
      const apKey = `${b.net}_${b.id}_${planoId}`;
      if (!mergedAparatos[apKey]) {
        mergedAparatos[apKey] = b.fixtures;
        aparatosChanged = true;
      }
    }
    for (const r of (work.ramales ?? []) as PlanoRamal[]) {
      // Los stubs sintéticos de calentador (AC-01-{calId}, persistidos por saveTrazosToDB
      // para que los fixtures de la bajante CALENTn sobrevivan) deben volver bajo la clave que
      // el builder de stubs/FixturesPanel realmente leen: `ac_<calId>_<planoId>` — no
      // `ac_AC-01-<calId>_<planoId>`.
      const apKey =
        r.id.startsWith('AC-01-') && r.net === 'ac'
          ? `ac_${r.id.slice('AC-01-'.length)}_${planoId}`
          : `${r.net}_${r.id}_${planoId}`;
      if (r.fixtures && Object.keys(r.fixtures).length > 0 && !mergedAparatos[apKey]) {
        mergedAparatos[apKey] = r.fixtures;
        aparatosChanged = true;
      }
      if (
        r.hydroAcc &&
        (Object.keys(r.hydroAcc.accesorios ?? {}).length > 0 ||
          (r.hydroAcc.Lh ?? 0) > 0 ||
          (r.hydroAcc.nSalidas ?? 0) > 0) &&
        !mergedHidro[apKey]
      ) {
        mergedHidro[apKey] = r.hydroAcc;
        hidroChanged = true;
      }
      if (r.gasAcc && Object.keys(r.gasAcc).length > 0 && !mergedGas[apKey]) {
        mergedGas[apKey] = r.gasAcc;
        gasChanged = true;
      }
    }
    if (aparatosChanged) saveToStorage(APARATOS_BY_TRAMO_KEY, mergedAparatos);
    if (hidroChanged) saveToStorage(HYDRO_DATA_STORAGE_KEY, mergedHidro);
    if (gasChanged) saveToStorage(GAS_ACC_KEY, mergedGas);
    // Los mapas recién fusionados se escriben con saveToStorage (que no dispara eventos) — si la
    // app ya montó sus tramos/UC leyendo un mapa vacío o viejo (dispositivo con caché limpia o
    // desactualizada), las tablas de diseño quedan con los conteos en cero hasta que algo vuelva
    // a disparar 'storage'/sync. Se notifica aquí mismo para reconstruirlos con los datos de la
    // BD sin esperar a una edición manual. Mismo patrón de eventos que networkSanitary.ts.
    if (aparatosChanged || hidroChanged || gasChanged) {
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new CustomEvent('civilflow_san_sync_changed'));
      window.dispatchEvent(new CustomEvent('civilflow_hidro_sync_changed'));
    }
    return work;
  } catch (e) {
    devError('storageService loadTrazosFromDB exception:', e);
    return null;
  }
}
