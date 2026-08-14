import { devError } from '../../../utils/devError';

const PREFIX = 'civilflow_';

/**
 * Lee y parsea un valor JSON desde localStorage.
 * @param key - Clave de storage (con prefijo `civilflow_`).
 * @param fallback - Valor por defecto cuando la clave no existe o el parseo falla.
 * @returns Valor parseado de tipo T, o fallback ante error.
 */
export function loadFromStorage<T>(key: string, fallback: T): T {
  const fullKey = PREFIX + key;
  try {
    const raw = localStorage.getItem(fullKey);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch (e) {
    devError('storageService load:', key, e);
    return fallback;
  }
}

/**
 * Serializa un valor a JSON y lo escribe en localStorage.
 * @param key - Clave de storage (con prefijo `civilflow_`).
 * @param data - Cualquier valor serializable a JSON.
 */
export function saveToStorage(key: string, data: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(data));
  } catch (e) {
    devError('storageService save:', key, e);
  }
}

/**
 * Elimina una clave de localStorage.
 * @param key - Clave de storage (con prefijo `civilflow_`).
 */
export function removeFromStorage(key: string): void {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch (e) {
    devError('storageService remove:', key, e);
  }
}

import { supabase } from '../../../lib/supabase';
import {
  TRAZOS_PREFIX,
  ACTIVE_PROYECTO_ID_KEY,
  APARATOS_BY_TRAMO_KEY,
  HYDRO_DATA_STORAGE_KEY,
  GAS_ACC_KEY,
} from '../constants/storage-keys';
import type { PlanoWorkData } from '../lib/PlanoEngine/PlanoPersistence';
import type {
  PlanoRamal,
  PlanoBajante,
  PlanoArea,
  PlanoDimension,
  PlanoTextAnnotation,
  PlanoGuideLine,
} from '../lib/PlanoEngine/PlanoState';
import type { CrossFloorGhost } from '../lib/shared/crossFloorGhostTypes';

export function getActiveProyectoId(): number | null {
  const raw = localStorage.getItem(ACTIVE_PROYECTO_ID_KEY);
  return raw ? Number(raw) : null;
}

export type PlanTrazos = Partial<PlanoWorkData>;

/**
 * Carga datos de trazado de plano cacheados en localStorage para un plano dado.
 * @param planId - Identificador del plano (va después del prefijo de trazos).
 * @returns Objeto PlanTrazos parseado, o null si no existe.
 */
export function loadPlanTrazos(planId: string): PlanTrazos | null {
  return loadFromStorage<PlanTrazos | null>(TRAZOS_PREFIX + planId, null);
}

/**
 * Persiste datos de trazado de plano en la caché de localStorage.
 * @param planId - Identificador del plano (va después del prefijo de trazos).
 * @param data - Payload de trazos a cachear.
 */
export function savePlanTrazos(planId: string, data: unknown): void {
  saveToStorage(TRAZOS_PREFIX + planId, data);
}

// ─────────────────────────────────────────────────────────────────────────
// Mapeo entre la forma en memoria del motor (PlanoWorkData, camelCase,
// ids string locales de la app) y las tablas normalizadas de Supabase (snake_case,
// PK bigint sustitutas + `client_id` que guarda el id local original de la app).
// Ver supabase/migrations/20260730000001_civilflow_schema.sql.
// ─────────────────────────────────────────────────────────────────────────

function ramalToRow(planoId: number, userId: string, r: PlanoRamal) {
  return {
    plano_id: planoId,
    user_id: userId,
    client_id: r.id,
    net: r.net,
    tipo: r.tipo,
    padre: r.padre,
    pts: r.pts ?? [],
    total_l: r.totalL,
    label: r.label,
    ini: r.ini,
    fin: r.fin,
    piso: r.piso,
    dz: r.dz,
    uc: r.uc,
    label_x: r.labelX,
    label_y: r.labelY,
    label_angle: r.labelAngle,
    material: r.material,
    diametro: r.diametro,
    pendiente: r.pendiente,
    bloqueado: r.bloqueado ?? false,
    accesorio_inicio: r.accesorioInicio ?? null,
    accesorio_fin: r.accesorioFin ?? null,
    diametro_inicio: r.diametroInicio ?? null,
    diametro_fin: r.diametroFin ?? null,
    aparato_inicio: r.aparatoInicio ?? null,
    aparato_fin: r.aparatoFin ?? null,
    n_salidas: r.nSalidas ?? null,
    diam_pulg: r.diamPulg ?? null,
    trib_reversed: r._tribReversed ?? null,
    acc_med: r.accMed ?? null,
    caudal: r.caudal ?? null,
    lvert: r.lvert ?? null,
    merges_from: r.mergesFrom ?? null,
    sifon_label_ini: r.sifonLabelIni ?? null,
    sifon_label_fin: r.sifonLabelFin ?? null,
    fixtures: r.fixtures ?? {},
    // NOT NULL en planos_ramales (JSONB) — un ramal nuevo sin accesorios asignados tendría
    // `undefined`/null y tumbaría el INSERT completo de replaceCollection con 400
    // ("null value in column ... violates not-null constraint"). `{}` es el valor vacío válido.
    hydro_accesorios: r.hydroAcc ?? {},
    gas_accesorios: r.gasAcc ?? {},
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToRamal(row: any): PlanoRamal {
  return {
    id: row.client_id,
    net: row.net,
    tipo: row.tipo,
    padre: row.padre,
    pts: row.pts ?? [],
    totalL: row.total_l,
    label: row.label,
    ini: row.ini,
    fin: row.fin,
    piso: row.piso,
    dz: row.dz,
    uc: row.uc,
    labelX: row.label_x,
    labelY: row.label_y,
    labelAngle: row.label_angle,
    material: row.material,
    diametro: row.diametro,
    pendiente: row.pendiente,
    bloqueado: row.bloqueado,
    accesorioInicio: row.accesorio_inicio ?? undefined,
    accesorioFin: row.accesorio_fin ?? undefined,
    diametroInicio: row.diametro_inicio ?? undefined,
    diametroFin: row.diametro_fin ?? undefined,
    aparatoInicio: row.aparato_inicio ?? undefined,
    aparatoFin: row.aparato_fin ?? undefined,
    nSalidas: row.n_salidas ?? undefined,
    diamPulg: row.diam_pulg ?? undefined,
    _tribReversed: row.trib_reversed ?? undefined,
    accMed: row.acc_med ?? undefined,
    caudal: row.caudal ?? undefined,
    lvert: row.lvert ?? undefined,
    mergesFrom: row.merges_from ?? undefined,
    sifonLabelIni: row.sifon_label_ini ?? undefined,
    sifonLabelFin: row.sifon_label_fin ?? undefined,
    fixtures: row.fixtures ?? undefined,
    hydroAcc: row.hydro_accesorios ?? undefined,
    gasAcc: row.gas_accesorios ?? undefined,
  };
}

function bajanteToRow(planoId: number, userId: string, b: PlanoBajante) {
  return {
    plano_id: planoId,
    user_id: userId,
    client_id: b.id,
    net: b.net,
    tipo: b.tipo,
    code: b.code,
    x: b.x,
    y: b.y,
    piso_base: b.pisoBase,
    piso_cima: b.pisoCima,
    npt_base: b.nptBase,
    npt_cima: b.nptCima,
    h_vert: b.hVert,
    d_nominal: b.dNominal,
    uc_acum: b.ucAcum,
    uc_extra: b.ucExtra,
    area_m2: b.area_m2,
    desplazamientos: b.desplazamientos ?? {},
    lbl_off_x: b.lblOffX,
    lbl_off_y: b.lblOffY,
    label_angle: b.labelAngle,
    label_x: b.labelX,
    label_y: b.labelY,
    direccion: b.direccion ?? null,
    aparato: b.aparato ?? null,
    total_l: b.totalL ?? null,
    pendiente: b.pendiente ?? null,
    piso: b.piso ?? null,
    baj_r: b.bajR ?? null,
    ghost_data: b.ghostData ?? null,
    is_fantasma: b.isFantasma ?? false,
    diam_pulg: b.diamPulg ?? null,
    diametro: b.diametro ?? null,
    aco_diam: b.acoDiam ?? null,
    capacidad: b.capacidad ?? null,
    factor_sim: b.factorSim ?? null,
    base: b.base ?? null,
    altura: b.altura ?? null,
    canal_id: b.canalId ?? null,
    descarga_en_id: b.descargaEnId ?? null,
    origen_id: b.origenId ?? null,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToBajante(row: any): PlanoBajante {
  return {
    id: row.client_id,
    net: row.net,
    tipo: row.tipo,
    code: row.code,
    x: row.x,
    y: row.y,
    pisoBase: row.piso_base,
    pisoCima: row.piso_cima,
    nptBase: row.npt_base,
    nptCima: row.npt_cima,
    hVert: row.h_vert,
    dNominal: row.d_nominal,
    recibeDeIds: [],
    alimentaIds: [],
    descargaEnId: row.descarga_en_id ?? null,
    origenId: row.origen_id ?? undefined,
    ucAcum: row.uc_acum,
    ucExtra: row.uc_extra,
    area_m2: row.area_m2,
    desplazamientos: row.desplazamientos ?? {},
    lblOffX: row.lbl_off_x,
    lblOffY: row.lbl_off_y,
    labelAngle: row.label_angle,
    labelX: row.label_x,
    labelY: row.label_y,
    direccion: row.direccion ?? undefined,
    aparato: row.aparato ?? undefined,
    totalL: row.total_l ?? undefined,
    pendiente: row.pendiente ?? undefined,
    piso: row.piso ?? undefined,
    bajR: row.baj_r ?? undefined,
    ghostData: row.ghost_data ?? undefined,
    isFantasma: row.is_fantasma ?? undefined,
    diamPulg: row.diam_pulg ?? undefined,
    diametro: row.diametro ?? undefined,
    acoDiam: row.aco_diam ?? undefined,
    capacidad: row.capacidad ?? undefined,
    factorSim: row.factor_sim ?? undefined,
    base: row.base ?? undefined,
    altura: row.altura ?? undefined,
    canalId: row.canal_id ?? undefined,
  };
}

function areaToRow(planoId: number, userId: string, a: PlanoArea) {
  return {
    plano_id: planoId,
    user_id: userId,
    client_id: a.id,
    pts: a.pts ?? [],
    color: a.color,
    label: a.label,
    label_x: a.labelX,
    label_y: a.labelY,
    label_angle: a.labelAngle,
    area_m2: a.areaM2,
    net: a.net ?? null,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToArea(row: any): PlanoArea {
  return {
    id: row.client_id,
    pts: row.pts ?? [],
    color: row.color,
    label: row.label,
    labelX: row.label_x,
    labelY: row.label_y,
    labelAngle: row.label_angle,
    areaM2: row.area_m2,
    net: row.net ?? undefined,
  };
}

function dimToRow(planoId: number, userId: string, d: PlanoDimension) {
  return {
    plano_id: planoId,
    user_id: userId,
    client_id: d.id,
    x1: d.x1,
    y1: d.y1,
    x2: d.x2,
    y2: d.y2,
    l: d.L,
    lbl_x: d.lblX ?? null,
    lbl_y: d.lblY ?? null,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToDim(row: any): PlanoDimension {
  return {
    id: row.client_id,
    x1: row.x1,
    y1: row.y1,
    x2: row.x2,
    y2: row.y2,
    L: row.l,
    lblX: row.lbl_x ?? undefined,
    lblY: row.lbl_y ?? undefined,
  };
}

function textAnnotToRow(planoId: number, userId: string, t: PlanoTextAnnotation) {
  return {
    plano_id: planoId,
    user_id: userId,
    client_id: t.id,
    x: t.x,
    y: t.y,
    text: t.text,
    font_mm: t.fontMm,
    box_w: t.boxW,
    lbl_off_x: t.lblOffX,
    lbl_off_y: t.lblOffY,
    text_angle: t.textAngle,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToTextAnnot(row: any): PlanoTextAnnotation {
  return {
    id: row.client_id,
    x: row.x,
    y: row.y,
    text: row.text,
    fontMm: row.font_mm,
    boxW: row.box_w,
    lblOffX: row.lbl_off_x,
    lblOffY: row.lbl_off_y,
    textAngle: row.text_angle,
  };
}

function guideLineToRow(planoId: number, userId: string, g: PlanoGuideLine) {
  return {
    plano_id: planoId,
    user_id: userId,
    client_id: g.id,
    net: g.net,
    pts: g.pts ?? [],
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToGuideLine(row: any): PlanoGuideLine {
  return { id: row.client_id, net: row.net, pts: row.pts ?? [] };
}

function ghostToRow(planoId: number, userId: string, g: CrossFloorGhost) {
  return {
    plano_id: planoId,
    user_id: userId,
    id_cliente: g.id,
    red: g.net,
    codigo: g.code,
    x: g.x,
    y: g.y,
    d_nominal: g.dNominal,
    direccion: g.direccion,
    direccion_padre: g.parentDireccion ?? null,
    piso: g.piso,
    plano_origen_id: g.sourcePlanId ? Number(g.sourcePlanId) : null,
    bajante_origen_id: g.sourceBajanteId,
    bajante_destino_id: g.targetBajanteId ?? null,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToGhost(row: any): CrossFloorGhost {
  return {
    id: row.id_cliente,
    net: row.red,
    code: row.codigo,
    x: row.x,
    y: row.y,
    dNominal: row.d_nominal,
    direccion: row.direccion,
    parentDireccion: row.direccion_padre ?? undefined,
    piso: row.piso,
    sourcePlanId: row.plano_origen_id != null ? String(row.plano_origen_id) : '',
    sourceBajanteId: row.bajante_origen_id,
    targetBajanteId: row.bajante_destino_id ?? undefined,
  };
}

/**
 * Hace upsert del estado completo de dibujo de un plano (cabecera + todas las colecciones de
 * elementos) vía el RPC SECURITY DEFINER `save_plano_data` — una sola transacción validada
 * server-side (propiedad, estructura, caps) que reemplaza las ~12 llamadas directas a tablas
 * que había antes. Ver supabase/migrations/20260813000002_rls_security_definer_writes.sql.
 * La firma externa no cambia, así todos los llamadores existentes (PdfViewer, PlanosTab,
 * associateBajanteAcrossFloors, writeDiameterToDrawing, etc.) siguen funcionando sin
 * modificaciones.
 */
export async function saveTrazosToDB(planoId: string, data: unknown): Promise<void> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const proyectoId = getActiveProyectoId();
    if (!proyectoId) return;

    const id = Number(planoId);
    if (!Number.isFinite(id)) return;

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
    const ramales = ((d.ramales ?? []) as PlanoRamal[]).map((r) => {
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
    });
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
    const bajantes = (d.bajantes ?? []) as PlanoBajante[];

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
        ts: d.ts ? new Date(d.ts).toISOString() : new Date().toISOString(),
      },
      ramales: ramales.map((r) => ramalToRow(id, user.id, r)),
      bajantes: bajantes.map((b) => ({
        ...bajanteToRow(id, user.id, b),
        recibe_de_ids: b.recibeDeIds ?? [],
        alimenta_ids: b.alimentaIds ?? [],
      })),
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
    if (error) devError('storageService saveTrazosToDB rpc:', error.message);
  } catch (e) {
    devError('storageService saveTrazosToDB exception:', e);
  }
}

/**
 * Carga el estado completo de dibujo de un plano desde Supabase en una sola ida y vuelta vía
 * el RPC get_plano_data (cabecera + ramales + bajantes + conexiones + areas + dims +
 * anotaciones + líneas guía + cross-floor ghosts), en lugar de 8 selects secuenciales.
 */
export async function loadTrazosFromDB(planoId: string): Promise<PlanTrazos | null> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const id = Number(planoId);
    if (!Number.isFinite(id)) return null;

    const { data, error } = await supabase.rpc('get_plano_data', { p_plano_id: id });
    if (error) {
      devError('storageService loadTrazosFromDB:', error.message);
      return null;
    }
    if (!data || !data.plano) return null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = data as any;
    const plano = result.plano;

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
