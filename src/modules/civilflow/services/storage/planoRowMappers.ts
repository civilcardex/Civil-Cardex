// Mappers plano↔fila Supabase (ramal/bajante/area/dim/texto/guía/ghost), simétricos.
// Extraídos verbatim de storageService.
// (PlanoWorkData no se usa aquí — vive en el bloque localStorage/trazosDb)
import type {
  PlanoRamal,
  PlanoBajante,
  PlanoArea,
  PlanoDimension,
  PlanoTextAnnotation,
  PlanoGuideLine,
} from '../../lib/PlanoEngine/PlanoState.ts';
import type { CrossFloorGhost } from '../../lib/shared/crossFloorGhostTypes.ts';
/** Una fila cruda de Supabase (columnas snake_case tal como llegan del RPC). Los mappers leen
 *  con fallback (`g`) para tolerar filas viejas que aún no traen una columna nueva. */
export type SupabaseRow = Record<string, unknown>;
const g = <T>(row: SupabaseRow, key: string, fb: T): T => (row[key] as T) ?? fb;

// ponytail: header shared — 3 fields repeated in 7 mappers
function baseRow(planoId: number, userId: string, clientId: string) {
  return { plano_id: planoId, user_id: userId, client_id: clientId };
}
/** Ramal del motor (camelCase) → fila de `planos_ramales` (snake_case) para el guardado por RPC.
 *  Aplica vacíos seguros: bloqueado false, banderas de vista true y accesorios `{}` (columna
 *  NOT NULL — un undefined tumbaría el INSERT completo del reemplazo de colección). */
export function ramalToRow(planoId: number, userId: string, r: PlanoRamal) {
  return {
    ...baseRow(planoId, userId, r.id),
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
    show_length: r.showLength ?? true,
    show_name: r.showName ?? true,
    show_guide: r.showGuide ?? true,
    show_flow_dir: (r as unknown as { showFlowDir?: boolean }).showFlowDir ?? true,
    show_mat_diam_pend: (r as unknown as { showMatDiamPend?: boolean }).showMatDiamPend ?? true,
    label_moved: r.labelMoved ?? false,
    fixtures: r.fixtures ?? {},
    // NOT NULL en planos_ramales (JSONB) — un ramal nuevo sin accesorios asignados tendría
    // `undefined`/null y tumbaría el INSERT completo de replaceCollection con 400
    // ("null value in column ... violates not-null constraint"). `{}` es el valor vacío válido.
    hydro_accesorios: r.hydroAcc ?? {},
    gas_accesorios: r.gasAcc ?? {},
    // Identidad de la yee doble (par de vértices): sin esto el glifo persistido muere en el
    // viaje a la BD y tras recargar el plano el borrado de un brazo lo borraba (orig. usuario).
    yee_doble: r.yeeDobleAt ?? null,
    copia_piso: r.copiaPiso ?? false,
    sin_acc_med_interior: r._sinAccMedInterior ?? false,
    // Ramal DE canal (ítem 2 usuario): sin esto el roundtrip BD lo devolvía como colector
    // normal (filtros de tablas lo recuperan por geometría, pero la marca viaja igual).
    es_canal_id: r.esCanalId ?? null,
  };
}

/** Fila de `planos_ramales` → ramal del motor (la inversa exacta de ramalToRow): cada columna
 *  snake_case vuelve a su propiedad camelCase con el mismo fallback. */
export function rowToRamal(row: SupabaseRow): PlanoRamal {
  return {
    id: g(row, 'client_id', ''),
    net: g(row, 'net', ''),
    tipo: g(row, 'tipo', ''),
    padre: g(row, 'padre', ''),
    pts: g(row, 'pts', []),
    totalL: g(row, 'total_l', 0),
    label: g(row, 'label', ''),
    ini: g(row, 'ini', ''),
    fin: g(row, 'fin', ''),
    piso: g(row, 'piso', ''),
    dz: g(row, 'dz', ''),
    uc: g(row, 'uc', 0),
    labelX: g(row, 'label_x', 0),
    labelY: g(row, 'label_y', 0),
    labelAngle: g(row, 'label_angle', 0),
    material: g(row, 'material', ''),
    diametro: g(row, 'diametro', ''),
    pendiente: g(row, 'pendiente', 0),
    bloqueado: g<boolean | undefined>(row, 'bloqueado', undefined),
    accesorioInicio: g(row, 'accesorio_inicio', undefined),
    accesorioFin: g(row, 'accesorio_fin', undefined),
    diametroInicio: g(row, 'diametro_inicio', undefined),
    diametroFin: g(row, 'diametro_fin', undefined),
    aparatoInicio: g(row, 'aparato_inicio', undefined),
    aparatoFin: g(row, 'aparato_fin', undefined),
    nSalidas: g(row, 'n_salidas', undefined),
    diamPulg: g(row, 'diam_pulg', undefined),
    _tribReversed: g(row, 'trib_reversed', undefined),
    accMed: g(row, 'acc_med', undefined),
    caudal: g(row, 'caudal', undefined),
    lvert: g(row, 'lvert', undefined),
    mergesFrom: g(row, 'merges_from', undefined),
    sifonLabelIni: g(row, 'sifon_label_ini', undefined),
    sifonLabelFin: g(row, 'sifon_label_fin', undefined),
    showLength: g(row, 'show_length', true),
    showName: g(row, 'show_name', true),
    showGuide: g(row, 'show_guide', true),
    showFlowDir: g(row, 'show_flow_dir', true),
    showMatDiamPend: g(row, 'show_mat_diam_pend', true),
    labelMoved: g(row, 'label_moved', false),
    fixtures: g(row, 'fixtures', undefined),
    hydroAcc: g(row, 'hydro_accesorios', undefined),
    gasAcc: g(row, 'gas_accesorios', undefined),
    yeeDobleAt: g(row, 'yee_doble', undefined),
    copiaPiso: g(row, 'copia_piso', undefined),
    _sinAccMedInterior: g(row, 'sin_acc_med_interior', undefined),
    esCanalId: g(row, 'es_canal_id', undefined),
  };
}

/** Bajante/montante del motor → fila de `planos_bajantes`. Además de las columnas directas
 *  lleva `asoc_links` (los ids de RAMAL de recibe/alimenta/manual — el RPC solo resuelve enlaces
 *  bajante→bajante) y `uc_aplicado` (el libro de herencia entre pisos): sin ellas, al recargar
 *  el bajante volvía sin ramales asociados y sin la carga heredada. */
export function bajanteToRow(planoId: number, userId: string, b: PlanoBajante) {
  return {
    ...baseRow(planoId, userId, b.id),
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
    label_moved: b.labelMoved ?? false,
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
    longitud: b.longitud ?? null,
    // Canal en diagonal (ítems 4-5 usuario) + sentido legacy del flujo: sin estas columnas el
    // roundtrip BD aplanaba el canal a AABB (se crean con la migración 20260930; el
    // jsonb_populate del RPC ignora claves extra hasta aplicarla — deploy seguro antes).
    angulo: b.angulo ?? null,
    canal_flow_dir: b._canalFlowDir ?? null,
    copia_piso: b.copiaPiso ?? false,
    copiado_de_plan: b.copiadoDePlan ?? null,
    copiado_de_id: b.copiadoDeId ?? null,
    bajante_externo_id: b.bajanteExternoId ?? null,
    // Enlaces del bajante con las demás piezas del plano (ramales y bajantes). Las columnas
    // recibe_de_ids/alimenta_ids del RPC solo guardan enlaces BAJANTE→BAJANTE (se resuelven
    // contra el mapa de bajantes del plano), así que los ids de RAMAL —la asociación manual
    // de un montante con su ramal— se perdían en el viaje a BD. Este jsonb los lleva completos.
    asoc_links: {
      recibe: b.recibeDeIds ?? [],
      alimenta: b.alimentaIds ?? [],
      manual: b.asocManual ?? [],
    },
    canal_id: b.canalId ?? null,
    descarga_en_id: b.descargaEnId ?? null,
    origen_id: b.origenId ?? null,
    caja_origen_id: b.cajaOrigenId ?? null,
    bomba_en_id: b.bombaEnId ?? null,
    // Libro de herencia entre pisos: sin esto, un round-trip BD (árbitro por ts) borraba el
    // libro de motor y caché y el fantasma/bajante original quedaban en 0 UD (LDesvio bien,
    // porque su clave vive en el mapa global de aparatos).
    uc_aplicado: b.ucAplicado ?? null,
    uc_aplicado_hidro: b.ucAplicadoHidro ?? null,
    fixtures: (b as unknown as { fixtures?: Record<string, number> }).fixtures ?? {},
  };
}

/** Fila de `planos_bajantes` → bajante del motor: restaura los enlaces de `asoc_links`
 *  (recibe/alimenta/manual) que viajan aparte de las columnas bajante→bajante del RPC. */
export function rowToBajante(row: SupabaseRow): PlanoBajante {
  // Enlaces guardados en BD (asoc_links): los ids de ramal que el RPC no puede guardar.
  const links = (row.asoc_links ?? {}) as {
    recibe?: string[];
    alimenta?: string[];
    manual?: string[];
  };
  const recibe = Array.isArray(links.recibe) ? links.recibe : [];
  const alimenta = Array.isArray(links.alimenta) ? links.alimenta : [];
  const manual = Array.isArray(links.manual) ? links.manual : [];
  return {
    id: g(row, 'client_id', ''),
    net: g(row, 'net', ''),
    tipo: g(row, 'tipo', ''),
    code: g(row, 'code', ''),
    x: g(row, 'x', 0),
    y: g(row, 'y', 0),
    pisoBase: g(row, 'piso_base', ''),
    pisoCima: g(row, 'piso_cima', ''),
    nptBase: g(row, 'npt_base', 0),
    nptCima: g(row, 'npt_cima', 0),
    hVert: g(row, 'h_vert', 0),
    dNominal: g(row, 'd_nominal', ''),
    recibeDeIds: [...recibe],
    alimentaIds: [...alimenta],
    asocManual: [...manual],
    descargaEnId: g(row, 'descarga_en_id', null),
    origenId: g(row, 'origen_id', undefined),
    cajaOrigenId: g(row, 'caja_origen_id', undefined),
    bombaEnId: g(row, 'bomba_en_id', undefined),
    ucAplicado: g(row, 'uc_aplicado', undefined),
    ucAplicadoHidro: g(row, 'uc_aplicado_hidro', undefined),
    fixtures: g(row, 'fixtures', undefined),
    ucAcum: g(row, 'uc_acum', 0),
    ucExtra: g(row, 'uc_extra', 0),
    area_m2: g(row, 'area_m2', 0),
    desplazamientos: g(row, 'desplazamientos', {}),
    lblOffX: g(row, 'lbl_off_x', 0),
    lblOffY: g(row, 'lbl_off_y', 0),
    labelAngle: g(row, 'label_angle', 0),
    labelX: g(row, 'label_x', 0),
    labelY: g(row, 'label_y', 0),
    labelMoved: g(row, 'label_moved', false),
    direccion: g(row, 'direccion', undefined),
    aparato: g(row, 'aparato', undefined),
    totalL: g(row, 'total_l', undefined),
    pendiente: g(row, 'pendiente', undefined),
    piso: g(row, 'piso', undefined),
    bajR: g(row, 'baj_r', undefined),
    ghostData: g(row, 'ghost_data', undefined),
    isFantasma: g(row, 'is_fantasma', undefined),
    diamPulg: g(row, 'diam_pulg', undefined),
    diametro: g(row, 'diametro', undefined),
    acoDiam: g(row, 'aco_diam', undefined),
    capacidad: g(row, 'capacidad', undefined),
    factorSim: g(row, 'factor_sim', undefined),
    base: g(row, 'base', undefined),
    altura: g(row, 'altura', undefined),
    longitud: g(row, 'longitud', undefined),
    angulo: g(row, 'angulo', undefined),
    _canalFlowDir: g(row, 'canal_flow_dir', undefined),
    copiaPiso: g(row, 'copia_piso', undefined),
    copiadoDePlan: g(row, 'copiado_de_plan', undefined),
    copiadoDeId: g(row, 'copiado_de_id', undefined),
    bajanteExternoId: g(row, 'bajante_externo_id', undefined),
    canalId: g(row, 'canal_id', undefined),
  };
}

/** Área dibujada del plano (polígono con etiqueta, color y m²) → fila de `planos_areas`. */
export function areaToRow(planoId: number, userId: string, a: PlanoArea) {
  return {
    ...baseRow(planoId, userId, a.id),
    pts: a.pts ?? [],
    color: a.color,
    label: a.label,
    label_x: a.labelX,
    label_y: a.labelY,
    label_angle: a.labelAngle,
    label_moved: a.labelMoved ?? false,
    area_m2: a.areaM2,
    net: a.net ?? null,
    altura_m: a.alturaM ?? null,
  };
}

/** Fila de `planos_areas` → área del motor (inversa de areaToRow). */
export function rowToArea(row: SupabaseRow): PlanoArea {
  return {
    id: g(row, 'client_id', ''),
    pts: g(row, 'pts', []),
    color: g(row, 'color', ''),
    label: g(row, 'label', ''),
    labelX: g(row, 'label_x', 0),
    labelY: g(row, 'label_y', 0),
    labelAngle: g(row, 'label_angle', 0),
    labelMoved: g(row, 'label_moved', false),
    areaM2: g(row, 'area_m2', 0),
    net: g(row, 'net', undefined),
    alturaM: g(row, 'altura_m', undefined),
  };
}

/** Cota (medida entre dos puntos del plano, con su etiqueta movible) → fila de
 *  `planos_dimensiones`. */
export function dimToRow(planoId: number, userId: string, d: PlanoDimension) {
  return {
    ...baseRow(planoId, userId, d.id),
    x1: d.x1,
    y1: d.y1,
    x2: d.x2,
    y2: d.y2,
    l: d.L,
    lbl_x: d.lblX ?? null,
    lbl_y: d.lblY ?? null,
  };
}

/** Fila de `planos_dimensiones` → cota del motor (inversa de dimToRow). */
export function rowToDim(row: SupabaseRow): PlanoDimension {
  return {
    id: g(row, 'client_id', ''),
    x1: g(row, 'x1', 0),
    y1: g(row, 'y1', 0),
    x2: g(row, 'x2', 0),
    y2: g(row, 'y2', 0),
    L: g(row, 'l', 0),
    lblX: g(row, 'lbl_x', undefined),
    lblY: g(row, 'lbl_y', undefined),
  };
}

/** Nota de texto del plano (posición, tamaño de fuente en mm, caja y ángulo) → fila de
 *  `planos_anotaciones_texto`. */
export function textAnnotToRow(planoId: number, userId: string, t: PlanoTextAnnotation) {
  return {
    ...baseRow(planoId, userId, t.id),
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

/** Fila de `planos_anotaciones_texto` → nota de texto del motor (inversa de textAnnotToRow). */
export function rowToTextAnnot(row: SupabaseRow): PlanoTextAnnotation {
  return {
    id: g(row, 'client_id', ''),
    x: g(row, 'x', 0),
    y: g(row, 'y', 0),
    text: g(row, 'text', ''),
    fontMm: g(row, 'font_mm', 0),
    boxW: g(row, 'box_w', 0),
    lblOffX: g(row, 'lbl_off_x', 0),
    lblOffY: g(row, 'lbl_off_y', 0),
    textAngle: g(row, 'text_angle', 0),
  };
}

/** Línea guía (ayuda de dibujo asociada a una red, solo puntos) → fila de
 *  `planos_lineas_guia`. */
export function guideLineToRow(planoId: number, userId: string, g: PlanoGuideLine) {
  return {
    ...baseRow(planoId, userId, g.id),
    net: g.net,
    pts: g.pts ?? [],
  };
}

/** Fila de `planos_lineas_guia` → línea guía del motor (inversa de guideLineToRow). */
export function rowToGuideLine(row: SupabaseRow): PlanoGuideLine {
  return {
    id: g(row, 'client_id', ''),
    net: g(row, 'net', ''),
    pts: g(row, 'pts', [] as unknown as [number, number][]),
  };
}

/** Marcador XFG (fantasma entrepisos) → fila de `planos_cross_floor_ghosts`: quién es el bajante
 *  origen (plano_origen_id + bajante_origen_id), a quién apunta y el `layout` (2 = marcador en
 *  el piso superior) — sin esa columna la migración re-procesaba el fantasma y lo borraba. */
export function ghostToRow(planoId: number, userId: string, g: CrossFloorGhost) {
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
    // Layout del XFG (2 = marcador en el superior): sin esta columna, el roundtrip a BD lo
    // perdía y migrateAssocLayoutOnLoad re-procesaba fantasmas nuevos como legacy (borraba
    // el XFG real + el LD_ vía sweep — incidente 2026-09-25).
    layout: g.layout ?? null,
  };
}

/** Fila de `planos_cross_floor_ghosts` → XFG (fantasma entrepisos) del motor (inversa de
 *  ghostToRow; los ids de origen vuelven como string). */
export function rowToGhost(row: SupabaseRow): CrossFloorGhost {
  return {
    id: g(row, 'id_cliente', ''),
    net: g(row, 'red', ''),
    code: g(row, 'codigo', ''),
    x: g(row, 'x', 0),
    y: g(row, 'y', 0),
    dNominal: g(row, 'd_nominal', ''),
    direccion: g<'sube' | 'baja'>(row, 'direccion', 'baja'),
    parentDireccion: g<'sube' | 'baja' | undefined>(row, 'direccion_padre', undefined),
    piso: g(row, 'piso', ''),
    sourcePlanId:
      g(row, 'plano_origen_id', '') != null ? String(g(row, 'plano_origen_id', '')) : '',
    sourceBajanteId: g(row, 'bajante_origen_id', ''),
    targetBajanteId: g(row, 'bajante_destino_id', undefined),
    layout: g<number | undefined>(row, 'layout', undefined),
  };
}

/**
 * Guarda el estado completo de dibujo de un plano (cabecera + todas las colecciones) vía
 * el RPC seguro `save_plano_data`: una sola transacción validada del lado del servidor.
 * La firma externa no cambió, así que todos los llamadores existentes siguen funcionando
 * sin modificaciones. Ver supabase/migrations/20260813000002_rls_security_definer_writes.sql.
 */
/**
 * Aviso visible de fallo de guardado a BD (orig. usuario: "no se guarda nada y la UI no se
 * entera"): cada salida temprana / error del RPC emite este evento; el visor lo escucha y
 * pinta la franja de estado en rojo con el motivo.
 */
