import type { LabelBoxCorners, CrossFloorGhost } from '../shared/crossFloorGhostTypes.ts';
export type { LabelBoxCorners, CrossFloorGhost } from '../shared/crossFloorGhostTypes.ts';

/** Catálogo de redes que el motor sabe dibujar (NETS): cada una con su color, el prefijo de sus
 *  etiquetas (af (Agua Fría) -> RAF1, san (Sanitaria) -> RS1) y el tipo de tubería vertical que
 *  usa (montante el que SUBE, bajante el que BAJA). Para los nombres/iconos que se muestran en la
 *  interfaz, usar uiConfig.REDES en su lugar. */
export const NETS = [
  {
    id: 'af',
    lbl: 'RAF',
    col: '#4D8FF7',
    ucType: 'uc',
    bmType: 'montante',
    bmPfx: 'MAF',
    bmIco: '⬆',
    emoji: '💧',
    name: 'Agua fría',
  },
  {
    id: 'ac',
    lbl: 'RAC',
    col: '#F04545',
    ucType: 'uc',
    bmType: 'montante',
    bmPfx: 'MAC',
    bmIco: '⬆',
    emoji: '🔥',
    name: 'Agua caliente',
  },
  {
    id: 'san',
    lbl: 'RS',
    col: '#F5A623',
    ucType: 'ud',
    bmType: 'bajante',
    bmPfx: 'BAN',
    bmIco: '⬇',
    emoji: '🚽',
    name: 'Sanitaria',
  },
  {
    id: 'vent',
    lbl: 'REV',
    col: '#808080',
    ucType: null,
    bmType: 'bajante',
    bmPfx: 'BREV',
    bmIco: '⬇',
    emoji: '🌬',
    name: 'Ventilación',
  },
  {
    id: 'll',
    lbl: 'RALL',
    col: '#8B5CF6',
    ucType: 'ud',
    bmType: 'bajante',
    bmPfx: 'BALL',
    bmIco: '⬇',
    emoji: '🌧',
    name: 'Aguas lluvias',
  },
  {
    id: 'recolectora',
    lbl: 'RECOLL',
    col: '#7C3AED',
    ucType: null,
    bmType: 'bajante',
    bmPfx: 'RECOLL',
    bmIco: '⬇',
    emoji: '🏠',
    name: 'Canal recolectora',
  },
  {
    id: 'gas',
    lbl: 'RG',
    col: '#A855F7',
    ucType: null,
    bmType: 'montante',
    bmPfx: 'MG',
    bmIco: '⬆',
    emoji: '⛽',
    name: 'Gas',
  },
  {
    id: 'rejillas',
    lbl: 'REJ',
    col: '#A855F7',
    ucType: null,
    bmType: 'montante',
    bmPfx: 'REJ',
    bmIco: '▦',
    emoji: '🪟',
    name: 'Rejillas de ventilación',
  },
  {
    id: 'rci',
    lbl: 'RRCI',
    col: '#F87171',
    ucType: null,
    bmType: 'montante',
    bmPfx: 'MRCI',
    bmIco: '⬆',
    emoji: '🔴',
    name: 'Contra incendio',
  },
  {
    id: 'rec',
    lbl: 'RREC',
    col: '#22D3EE',
    ucType: null,
    bmType: 'montante',
    bmPfx: 'MREC',
    bmIco: '⬆',
    emoji: '🔄',
    name: 'Recirculación',
  },
  {
    id: 'bom',
    lbl: 'RBOM',
    col: '#8A9BB8',
    ucType: null,
    bmType: 'bajante',
    bmPfx: 'BOM',
    bmIco: '⬇',
    emoji: '⬆️',
    name: 'Bombeo',
  },
];

/** Una red de tubería del catálogo (af, ac, san, ll, gas, vent, rci…): su código, el color con que
 *  se dibuja, sus nombres para los botones y el tipo de aparato que cuenta. */
export interface PlanoNet {
  id: string;
  lbl: string;
  col: string;
  ucType: string | null;
  bmType: string;
  bmPfx: string;
  bmIco: string;
  emoji: string;
  name: string;
}

/** Un rectángulo en píxeles de pantalla, con su esquina superior izquierda: sirve para medir
 *  cuerpos de tubería, cajas de etiqueta y textos (el PDF de fondo ya es una imagen). */
export interface CanvasBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Dice si una red (af = Agua Fría, san = Sanitaria, ll = Lluvias...) está activa en el proyecto.
 *  Si el usuario no definió conjunto, todas valen. Ej: proyecto con solo sanitarias →
 *  checkActiveNet(engine, 'af') es false. */
export function checkActiveNet(engine: IPlanoEngineCore, netId: string): boolean {
  const activeNets = engine.activeNetworks as Set<string> | undefined;
  return activeNets ? activeNets.has(netId) : true;
}

/** Cambia a la red si el proyecto la tiene activa; si no, avisa al usuario y aborta (true = no
 *  seguir). Ej: ensureActiveNet(engine, 'gas') en un proyecto sin gas → alerta "Red inactiva". */
export function ensureActiveNet(engine: IPlanoEngineCore, netId: string): boolean {
  if (netId === engine.activeNet) return false;
  if (!checkActiveNet(engine, netId)) {
    const netObj = NETS.find((n) => n.id === netId);
    engine.triggerAlert(
      'Red inactiva',
      `Debe activar la red de ${netObj ? netObj.name : netId} en la información general`,
    );
    return true;
  }
  engine.setActiveNet(netId);
  return false;
}

/** Puesta a cero de la numeración de cada red: todos los contadores a cero. Se llama al abrir un
 *  plano y al pulsar Limpiar. */
export function initNetCounts(target: { _netCounts: Record<string, PlanoNetCounts> }): void {
  target._netCounts = {};
  NETS.forEach((n) => {
    target._netCounts[n.id] = { ramal: 0, tributario: 0 };
  });
}

/** Siguiente número libre de ramal o tributario en una red (el 1, 2, 3… que ve el usuario).
 *  `isTaken` evita repetir un número que ya existe aunque el contador se haya desfasado.
 *  Ej: tras dibujar RAF1 y RAF2, el siguiente ramal de af (Agua Fría) es 3. */
export function allocNetNumber(
  target: { _netCounts: Record<string, PlanoNetCounts> },
  netId: string,
  tipo: 'ramal' | 'tributario',
  isTaken: (n: number) => boolean,
): number {
  if (!target._netCounts[netId]) target._netCounts[netId] = { ramal: 0, tributario: 0 };
  let n = ++target._netCounts[netId][tipo];
  while (isTaken(n)) n = ++target._netCounts[netId][tipo];
  return n;
}

/** Id unico de ramal (milisegundo mas azar, evita choques en splits).
 *  @returns id nuevo. */
export function uniqRamalId(): string {
  return 'T' + Date.now() + Math.random().toString(36).slice(2, 7);
}

/** Siguiente numero libre T{n} del padre (numeracion por padre desde 1: los ramales que cuelgan de
 *  RS1 se llaman T1RS1, T2RS1...). Ej: con T1RS1 ocupado devuelve 2.
 *  @param suffix etiqueta del ramal raíz (p.ej. 'RS1'); @returns numero libre. */
export function allocTributaryNumber(
  target: { ramales: Array<{ label?: string }> },
  suffix: string,
): number {
  const used = new Set(target.ramales.map((r) => r.label));
  let n = 1;
  while (used.has(`T${n}${suffix}`)) n++;
  return n;
}

/** Primer id libre pfx{n} para volver un tributario a ramal (ignora el propio que se convierte).
 *  Ej: pfx 'RS' con RS1 y RS2 tomados -> 'RS3'.
 *  @param pfx prefijo de la red ('RS', 'RAF'...); @returns id libre. */
export function nextFreeRamalId(
  ramales: Array<{ id: string; label?: string }>,
  pfx: string,
  excludeId?: string,
): string {
  const ids = new Set(ramales.filter((r) => r.id !== excludeId).map((r) => r.id));
  const labels = new Set(ramales.filter((r) => r.id !== excludeId).map((r) => r.label || ''));
  let n = 1;
  while (ids.has(`${pfx}${n}`) || labels.has(`${pfx}${n}`)) n++;
  return `${pfx}${n}`;
}

/** Re-etiqueta en cascada un tributario y todo lo que cuelga de él, para que su etiqueta nombre
 *  al ramal raíz actual (máx 20 niveles de fondo, para no loopear con datos corruptos). */
export function relabelTribChain(
  ramales: Array<{ id: string; label?: string; tipo?: string; padre: string | null }>,
  id: string,
  alloc: (suffix: string) => number,
  depth = 0,
): void {
  if (depth > 20) return;
  const r = ramales.find((x) => x.id === id);
  if (!r || r.tipo !== 'tributario') return;
  // Raíz = caminar la cadena de padres hasta el primer NO tributario (el tronco receptor).
  let root = '';
  let cur: string | null = r.padre;
  let guard = 0;
  while (cur && guard++ < 20) {
    const p_ = ramales.find((x) => x.id === cur);
    if (!p_) break;
    if (p_.tipo !== 'tributario') {
      root = p_.label || p_.id;
      break;
    }
    cur = p_.padre;
  }
  if (root) {
    const endsOk = !!r.label && r.label.endsWith(root);
    if (!endsOk) {
      r.label = `T${alloc(root)}${root}`;
    }
  }
  for (const child of ramales) {
    if (child.padre === id && child.tipo === 'tributario') {
      relabelTribChain(ramales, child.id, alloc, depth + 1);
    }
  }
}

/** Etiqueta del ramal raíz de un tributario (el primer no-tributario subiendo por `padre`, sin
 *  mergesFrom (genealogía del split: anfitrión + entrantes)). Sirve para que T2RS1 sepa a qué
 *  tronco pertenece.
 *  @param ramalId id del tributario; @returns etiqueta del raíz ('' si no existe). */
export function rootTributarioLabel(
  ramales: Array<{
    id: string;
    label?: string;
    tipo?: string;
    padre: string | null;
    mergesFrom?: [string, string];
  }>,
  ramalId: string | null | undefined,
): string {
  if (!ramalId) return '';
  let cur = ramales.find((r) => r.id === ramalId) as
    | {
        id: string;
        label?: string;
        tipo?: string;
        padre: string | null;
        mergesFrom?: [string, string];
      }
    | undefined;
  const seen = new Set<string>();
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    // La raíz es el PRIMER no-tributario de la cadena de padres (el padre inmediato del
    // tributario). NO se sigue mergesFrom hacia el tronco original: un tributario cuyo padre
    // es el downstream autocreado de un split (RS2) debe etiquetarse contra RS2, no contra el
    // tronco original (RS1) — regla usuario: el label nombra al padre inmediato.
    if (cur.tipo === 'tributario' && cur.padre) {
      cur = ramales.find((r) => r.id === cur!.padre) as typeof cur;
    } else {
      break;
    }
  }
  // Cadena corrupta (ciclo): devolver vacío
  if (cur && seen.has(cur.id) && cur.tipo === 'tributario') return '';
  return cur ? cur.label || cur.id || '' : '';
}

/** Dice si dos redes se "pegan" al dibujar: la misma siempre, y sanitarias con ventilación se
 *  imánan entre sí (los codos reventilados unen ambas).
 *  @param a primera red; @param b segunda red; @returns true si se pegan. */
export function netsSnapLinked(a: string, b: string): boolean {
  return a === b || (a === 'vent' && b === 'san') || (a === 'san' && b === 'vent');
}

export function isBajante(el: PlanoElement | null): el is PlanoBajante {
  return el != null && '_circ' in el;
}
export function isRamal(el: PlanoElement | null): el is PlanoRamal {
  return el != null && 'pts' in el;
}
export function isTextAnnotation(el: PlanoElement | null): el is PlanoTextAnnotation {
  return el != null && '_box' in el;
}
export function isDimension(el: PlanoElement | null): el is PlanoDimension {
  return el != null && 'L' in el;
}
export function isArea(el: PlanoElement | null): el is PlanoArea {
  return el != null && '_polyBox' in el;
}

/** Un tramo de tubería (ramal) dibujado en el plano, con sus puntos, etiquetas y datos hidráulicos. */
export interface PlanoRamal {
  id: string;
  net: string;
  tipo: string;
  padre: string | null;
  pts: number[][];
  totalL: number;
  label: string;
  ini: string;
  fin: string;
  piso: string;
  dz: string;
  uc: number;
  labelX: number;
  labelY: number;
  labelAngle: number;
  material: string;
  diametro: string;
  pendiente: number;
  bloqueado?: boolean;
  // Elemento creado por "Copiar elementos en pisos": movimiento bloqueado permanentemente en
  // el piso destino (no se arrastra cuerpo/extremos, ni el símbolo si es bajante); borrar y
  // editar propiedades siguen funcionando.
  copiaPiso?: boolean;
  accesorioInicio?: string;
  accesorioFin?: string;
  diametroInicio?: string;
  diametroFin?: string;
  aparatoInicio?: string;
  aparatoFin?: string;
  nSalidas?: number;
  _labelBox?: LabelBoxCorners;
  _net?: string;
  diamPulg?: number;
  _tribReversed?: boolean;
  // Tributario creado desde LÍNEA GUÍA: sus dobleces internos no reciben glifos de accesorio
  // (detectAccesorioTrigger los salta) — los codos dibujados son parte del trazo de la guía.
  _sinAccMedInterior?: boolean;
  // Ramal de CANAL (orig. usuario): ramal de lluvia que el usuario dibuja saliendo de un canal
  // hacia un bajante. Un extremo nació dentro del rect del canal; el flujo es canal→bajante,
  // pendiente 2% y diámetro espejo del bajante asociado (recibeDeIds). Excluido de las tablas
  // de diseño ll (como lo estaba el conector automático que reemplaza) pero cuenta su
  // codo 90° baja (accesorioInicio) en el resumen de accesorios.
  esCanalId?: string | null;
  accMed?: Record<string, string>;
  caudal?: number;
  lvert?: string;
  // Solo lo lleva un ramal CREADO AUTOMÁTICAMENTE al dividir una unión T/Y
  // (autoSplitJunctionAndSumFlow en PlanoEngineDrawing.ts) — guarda los ids de los dos ramales
  // que se juntan en él. Lo leen waterRedFilas.ts / WaterNetworkDesign.tsx para forzar que el
  // total de UC de ESTE ramal sea la suma de esos dos, sin importar hacia qué lado corra el árbol
  // dirigido general por este punto (ese árbol se orienta hacia la fuente real de toda la red,
  // y en una unión local arbitraria puede correr en cualquier dirección).
  mergesFrom?: [string, string];
  // Solo para el viaje de ida/vuelta a la base de datos: aparato-id -> cantidad, el mismo dato
  // que FixturesPanel.tsx guarda en APARATOS_BY_TRAMO_KEY (localStorage) para este ramal. El
  // motor NO lo lee — se adjunta aquí solo para que storageService.ts lo lleve hacia/desde la
  // columna `fixtures` de la BD; el mapa de localStorage sigue siendo la fuente de verdad que la
  // interfaz lee/escribe durante la sesión.
  fixtures?: Record<string, number>;
  // Igual que `fixtures`: solo para el viaje ida/vuelta a la base de datos. Accesorios
  // hidrosanitarios ({ accesorios, Lh, nSalidas }) y de gas (aparato-id -> cantidad) que
  // FixturesPanel/GasDesign guardan en HYDRO_DATA_STORAGE_KEY / GAS_ACC_KEY (localStorage).
  // El motor NO los lee — storageService.ts los lleva hacia/desde `hydro_accesorios` /
  // `gas_accesorios` de planos_ramales.
  hydroAcc?: { accesorios: Record<string, number>; Lh: number; nSalidas: number };
  gasAcc?: Record<string, number>;
  // Posición en el plano de la etiqueta "S D=..." de un sifón, una vez que el usuario la arrastró
  // fuera de su posición calculada por defecto (renderRamales.ts). Indefinido = usar la posición
  // por defecto.
  sifonLabelIni?: [number, number];
  sifonLabelFin?: [number, number];
  _sifonLabelBoxIni?: LabelBoxCorners;
  _sifonLabelBoxFin?: LabelBoxCorners;
  // Etiqueta: controles de visibilidad (ítem 1)
  showLength?: boolean;
  showName?: boolean;
  showGuide?: boolean;
  showFlowDir?: boolean;
  showMatDiamPend?: boolean;
  // Etiqueta movida a mano por el usuario (lblDrag). El auto-orden de etiquetas solo reubica
  // las que nunca se movieron; las manuales quedan intactas y actúan como obstáculos fijos.
  labelMoved?: boolean;
  // Identidad de una yee doble (ítem 2): posiciones de los dos vértices que forman el par
  // (`[[x1,y1],[x2,y2]]`). Se registra al DETECTAR la yee doble en networkSanitary.ts y se
  // persiste vía el sync, de modo que el símbolo sobrevive al borrado de uno de los brazos
  // laterales — el renderer lo dibuja mientras la identidad exista, aunque un lado quede sin
  // trazo conectado. Se limpia solo cuando se elimina el tronco o el accesorio.
  yeeDobleAt?: number[][];
}

/** Bajante o montante (tubería vertical) que conecta los niveles del edificio. */
export interface PlanoBajante {
  id: string;
  net: string;
  tipo: string;
  code: string;
  // Elemento creado por "Copiar elementos entre pisos": movimiento bloqueado permanentemente
  // (ver comentario en PlanoRamal.copiaPiso).
  copiaPiso?: boolean;
  // Origen de la copia (plano + id de origen): permite reconocer y retirar los fantasmas
  // entre pisos que proyectaban ESTE bajante antes de que la copia lo materializara aquí.
  copiadoDePlan?: string;
  copiadoDeId?: string;
  x: number;
  y: number;
  pisoBase: string;
  pisoCima: string;
  nptBase: number;
  nptCima: number;
  hVert: number;
  dNominal: string;
  recibeDeIds: string[];
  alimentaIds: string[];
  /** Manuales por checkbox (la poda los respeta sin respaldo geometrico). */
  asocManual?: string[];
  descargaEnId: string | null;
  /** Bomba: id de la caja que la originó (una bomba por caja). */
  cajaOrigenId?: string | null;
  /** UD (Unidades de Desague) por aparato que viajan a la BD del piso. */
  fixtures?: Record<string, number>;
  /** BAJANTE ligado a una bomba de piso inferior: "<planId>|<bombaId>". Campo dedicado —
   *  descargaEnId/origenId dispararían la herencia hacia ABAJO (invertida para bombas). */
  bombaEnId?: string | null;
  /** Origen visto desde el destino (solo ayuda visual; el enlace vive arriba). */
  origenId?: string | null;
  /** Herencia UD (Unidades de Desague) por destino (resta la previa y aplica la nueva). */
  ucAplicado?: Record<string, Record<string, number>>;
  /** Libro gemelo de `ucAplicado` para los accesorios hidro heredados (misma clave). */
  ucAplicadoHidro?: Record<string, Record<string, number>>;
  ucAcum: number;
  ucExtra: number;
  area_m2: number;
  desplazamientos: Record<string, { dx: number; dy: number; Ldesvio?: string | null }>;
  lblOffX: number;
  lblOffY: number;
  labelAngle: number;
  labelX: number;
  labelY: number;
  direccion?: 'sube' | 'baja' | 'continua' | 'mantiene';
  aparato?: string;
  // Igual que en PlanoRamal: etiqueta movida a mano (ver comentario allá).
  labelMoved?: boolean;
  totalL?: number;
  pendiente?: number;
  piso?: string;
  bajR?: number;
  _circ?: { x: number; y: number; r: number };
  _ghost?: { x: number; y: number; r: number };
  _ghostLabelBox?: LabelBoxCorners;
  _labelBox?: LabelBoxCorners;
  ghostData?: Record<
    string,
    {
      dNominal?: string;
      direccion?: 'sube' | 'baja' | 'continua' | 'mantiene';
      labelX?: number;
      labelY?: number;
    }
  >;
  isFantasma?: boolean;
  diamPulg?: number;
  diametro?: string;
  acoDiam?: string;
  capacidad?: string;
  /** Simultaneidad del calentador en % (sobrevive recarga y cambio de equipo). */
  factorSim?: number;
  /** Seccion del canal ll (Lluvias) en cm (origen del marco, base corta y altura a iso). */
  base?: number;
  altura?: number;
  /** Tamaño del lado LARGO del canal en planta (cm) — el eje que recorre el canal. */
  longitud?: number;
  /** Eje largo del canal en grados (0 es +X; ausente es 0 legacy). */
  angulo?: number;
  /** Caja del canal en px (AABB del marco; el hit fino usa el OBB). */
  _canalBox?: { x: number; y: number; w: number; h: number };
  /** Flujo del canal segun arrastre (esquina 1 a 2, pinta la flecha centrada). */
  _canalFlowDir?: 'derecha' | 'izquierda' | 'abajo' | 'arriba';
  /** Canal ll (Lluvias) que contiene al bajante (se fija al crear o arrastrar). */
  canalId?: string | null;
  /** Canal manual fuera de su rectangulo (linea simple entre ambos, sin canalId). */
  bajanteExternoId?: string | null;
}

/** Zona pintada en el plano (techo de un apartamento, área de drenaje, sector de gas (Gas)) con su
 *  superficie en metros cuadrados; alimenta los cálculos de caudal. */
export interface PlanoArea {
  id: string;
  pts: number[][];
  color: string;
  label: string;
  labelX: number;
  labelY: number;
  labelAngle: number;
  areaM2: number;
  net?: string;
  // Altura libre del sector (m) — módulo Rejillas de ventilación (NTC 3631).
  alturaM?: number;
  // Igual que en PlanoRamal: etiqueta movida a mano (ver comentario allá).
  labelMoved?: boolean;
  _labelBox?: LabelBoxCorners;
  _polyBox?: CanvasBox;
}

/** Cota lineal: una medida (en metros) entre dos puntos del plano, con su etiqueta. */
export interface PlanoDimension {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  L: number;
  // Posición en el plano de la etiqueta, una vez que el usuario la arrastró fuera de la posición
  // automática (punto medio + desplazamiento). Indefinida hasta el primer arrastre.
  lblX?: number;
  lblY?: number;
  _labelPos?: { x: number; y: number };
}

/** Texto libre colocado sobre el plano. */
export interface PlanoTextAnnotation {
  id: string;
  x: number;
  y: number;
  text: string;
  fontMm: number;
  boxW: number;
  lblOffX: number;
  lblOffY: number;
  textAngle: number;
  _box?: CanvasBox;
}

/** Línea guía: trazo a mano alzada para marcar por dónde pasará la tubería; no cuenta en los
 *  cálculos ni sale en los informes (después se convierte en ramal). */
export interface PlanoGuideLine {
  id: string;
  net: string;
  pts: [number, number][];
  _labelBox?: LabelBoxCorners;
}

/** Nivel del edificio: su nombre visible (P1, S1, Cubierta) y su cota de referencia npt (nivel de
 *  piso topográfico, o sea la altura sobre/bajo el suelo en metros). */
export interface PlanoLevel {
  label?: string;
  npt?: number;
  n?: string | number;
}

/** Cuántos ramales y tributarios se han numerado en cada red, para seguir la cuenta sin releer el
 *  plano. Ej: af lleva 3 ramales → el siguiente será RAF4. */
export interface PlanoNetCounts {
  ramal: number;
  tributario: number;
}

/** Todos los tipos de elemento que el motor puede dibujar y seleccionar. */
export type PlanoElement =
  PlanoRamal | PlanoBajante | PlanoArea | PlanoTextAnnotation | PlanoDimension | PlanoGuideLine;

/** La tubería que se está dibujando ahora mismo, todavía sin confirmar: sus puntos y la longitud
 *  que lleva. Mientras exista, un clic añade un punto y Enter la guarda como ramal. */
export interface PlanoActiveRamal {
  id?: string;
  net: string;
  tipo: string;
  padre: string | null;
  pts: number[][];
  totalL: number;
}

/** El área que se está delimitando ahora, todavía sin cerrar (los puntos y el color con que se
 *  pintará al confirmar). */
export interface PlanoActiveArea {
  pts: number[][];
  color: string;
}

/** Lo que se le pone a una tubería nueva cuando el usuario no elige nada: el material, el diámetro
 *  y la pendiente que heredan las siguientes. */
export interface PlanoRamalDefaults {
  material: string;
  diametro: string;
  pendiente: number;
}

/** Foto de la posición original de cada elemento de un arrastre en grupo: sin ella, mover un
 *  conjunto a la vez deformaría las tuberías. Ej: se guardan los puntos de cada ramal al empezar
 *  el arrastre y se comparan en cada movimiento para saber cuánto se han desplazado. */
export type MultiDragOrigData = Record<
  string,
  {
    type: 'ramal' | 'bajante' | 'text' | 'guide' | 'area' | 'dim';
    origPts?: number[][];
    origLabelX?: number;
    origLabelY?: number;
    origLabelAngle?: number;
    origX?: number;
    origY?: number;
  }
>;

/** Todo lo que el motor de dibujo sabe de un momento a otro: qué hay en el plano (ramales,
 *  bajantes, áreas...), cómo se ve (zoom, escala scaleM (escala metros por pixel), red activa) y
 *  qué gesto está en curso (arrastre, cota a medias...). Es la "foto" que leen los handlers. */
export interface IPlanoEngineCore {
  /** Silencia el historial para que muchos cambios seguidos cuenten como UN solo Ctrl+Z. */
  pauseHistory?: () => void;
  /** Vuelve a activar el historial tras pausarlo (debe llamarse junto a pauseHistory). */
  resumeHistory?: () => void;
  /** Mallas/recirculaciones que el usuario marcó a mano: el chequeo de lazos no las reclama. */
  mallasDeclaradas?: Set<string>;
  dims: PlanoDimension[];
  textAnnots: PlanoTextAnnotation[];
  areas: PlanoArea[];
  ramales: PlanoRamal[];
  bajantes: PlanoBajante[];
  crossFloorGhosts: CrossFloorGhost[];
  guideLines: PlanoGuideLine[];
  _guideStart: { x: number; y: number } | null;
  // Ítem 2 (guías multisegmento): vértices acumulados de la guía en construcción (el último
  // coincide con _guideStart). Se commitea a guideLines con doble-click/Esc/cambio de
  // herramienta; null cuando no hay trazo en curso.
  _guidePts: [number, number][] | null;
  activeRamal: PlanoActiveRamal | null;
  activeArea: PlanoActiveArea | null;
  selId: string | null;
  selectedGhostId: string | null;
  _isGhostSel: boolean;
  // Traza DEV del flujo de selección (handleSelectDown/selectAt) — imprime _onDownHandler.
  _debugSel?: { x: number; y: number; notes: string[]; final: string | null } | null;
  _yeeFlashKey: string | null;
  _hiddenNets: Set<string>;
  _lockedNets: Set<string>;
  activeNetworks: Set<string> | undefined;
  activeNet: string;
  mouseX: number;
  mouseY: number;
  zoom: number;
  offX: number;
  offY: number;
  /** Factor multiplicador del grosor de TODAS las líneas del dibujo (slider de la barra de
   *  redes; 1 = grosor base, persistido por plano en cf_planos.line_width). */
  lineWidthScale: number;
  snapMode: boolean;
  gridMode: boolean;
  tool: string;
  tipoTramo: string;
  scaleM: number;
  definedScaleM: number;
  canv: HTMLCanvasElement;
  cw: HTMLElement;
  dpr: number;
  pageW: number;
  pageH: number;
  panX: number;
  panY: number;
  panX0: number;
  panY0: number;
  panning: boolean;
  drawingAcc: boolean;
  dirty: boolean;
  offCtx: CanvasRenderingContext2D | null;
  padreTributario: string | null;
  nivelActual: PlanoLevel | null;
  // Transitorio: se fija justo después de que el primer punto de un ramal de ventilación nuevo se
  // pega a un vértice de sanitaria (unión de codo reventilado) — fuerza la dirección del PRIMER
  // segmento a coincidir con la dirección local del ramal sanitario en ese punto, en vez del snap
  // genérico de 45°. Se limpia una vez colocado ese primer segmento.
  _ventFirstSegDir?: { x: number; y: number } | null;
  _dimStart: { x: number; y: number } | null;
  // Estado de la primera esquina para la herramienta de arrastre de rectángulo del canal — mismo
  // patrón de "clic-mueve-clic" (rubber-band) que _dimStart/_guideStart.
  _canalStart: { x: number; y: number } | null;
  // Eje fijado del canal (fase de ancho, 3er clic): p1→p2 es el eje ya confirmado con el
  // 2º clic — para TODA orientación (horizontal/vertical incluidas, orig. usuario); el 3er
  // clic define el ancho por distancia perpendicular. Se limpia al cambiar de herramienta
  // o con Escape, igual que _canalStart.
  _canalEje: { x1: number; y1: number; x2: number; y2: number } | null;
  // Estado transitorio de cada arrastre (se fija en handleMouseDown, se consume en
  // handleDragUp/handleDragMove; siempre vuelve a null al terminar el arrastre).
  _bajDragBackupXY?: { x: number; y: number; labelX?: number; labelY?: number } | null;
  _bajDragBackupPts?: Record<string, number[][]> | null;
  _lblDragIsParent?: boolean;
  _dragBackupPts?: number[][] | null;
  _dragLinkedBackupPts?: Record<string, number[][]> | null;
  _netCounts: Record<string, PlanoNetCounts>;
  _ramalDefaults: PlanoRamalDefaults | null;
  _dirty: boolean;
  _onRequestTextCb: ((x: number, y: number, cb: (text: string) => void) => void) | null;
  _loadedPlanId: string | number | null;
  planId?: string | number;
  _onDirtyCb: (() => void) | null;
  _lastMouseCvs: { x: number; y: number };
  // Punto (en coords de canvas) donde el usuario hizo clic para seleccionar el ramal actual —
  // usado por el atajo Suprimir para recortar el extremo CERCA DEL CLIC DE SELECCIÓN, no el que
  // queda cerca del cursor al momento de pulsar la tecla (que puede estar en otro lado del plano).
  _selPointCvs?: { x: number; y: number };
  _snapToSegment(
    x: number,
    y: number,
    pts: number[][],
    threshold?: number,
  ): { x: number; y: number } | null;
  nptLevels: PlanoLevel[];
  ghostDrag: { id: string; startX: number; startY: number; baseDx: number; baseDy: number } | null;
  lblDrag: { id: string; offX: number; offY: number; slot?: 'ini' | 'fin' } | null;
  txtDrag: { id: string; startX: number; startY: number; origX: number; origY: number } | null;
  dimLblDrag: { id: string; offX: number; offY: number } | null;
  txtResize: {
    id: string;
    corner: 'tl' | 'tr' | 'bl' | 'br';
    anchorX: number;
    anchorY: number;
    startDist: number;
    origFontMm: number;
    origBoxWpx: number;
  } | null;
  bajDrag: { id: string; offX: number; offY: number } | null;
  // Redimensionado del rectángulo de un canal por sus manijas de esquina — la esquina
  // opuesta queda fija en el MARCO LOCAL del inicio del gesto (anchorLX/LY + origen oX/oY y
  // ángulo ang en radianes): así el resize funciona también en diagonal. Las dims se
  // recalculan en vivo desde el cursor y normalizarCanal re-ancla si el marco se invierte.
  canalResizeDrag: {
    id: string;
    corner: 'tl' | 'tr' | 'bl' | 'br';
    anchorLX: number;
    anchorLY: number;
    oX: number;
    oY: number;
    ang: number;
  } | null;
  ptDrag: {
    id: string;
    ptIdx: number;
    slideConstraint?: { otherId: string; segmentIdx: number };
    accMedSlide?: { ax: number; ay: number; bx: number; by: number };
    linkedPts?: { id: string; ptIdx: number }[];
  } | null;
  areaDrag: { id: string; startX: number; startY: number } | null;
  /** PUNTO 5: arrastre de un VÉRTICE del área seleccionada (redimensionar por esquinas). */
  areaPtDrag: { id: string; idx: number; offX: number; offY: number } | null;
  /** PUNTO (orig. usuario): área candidata al presionar dentro de ella — si hay arrastre
   *  se convierte en marquee; si no lo hay (click simple) se selecciona. */
  _areaClickCandidate: string | null;
  /** PUNTO 3: extremo PREVIADO (con snap aplicado) de la cota en curso — el preview dibuja
   *  exactamente lo que aterrizará al hacer clic. */
  _dimPreviewPt: { x: number; y: number } | null;
  dimDrag: { id: string; startX: number; startY: number } | null;
  ramalDrag: {
    id: string;
    startX: number;
    startY: number;
    origPts: [number, number][];
    origLabelX?: number;
    origLabelY?: number;
    connBaj?: {
      id: string;
      origX: number;
      origY: number;
      origLblX: number;
      origLblY: number;
      atIdx: number;
    }[];
    connRamales?: {
      id: string;
      origPts: [number, number][];
      origLabelX?: number;
      origLabelY?: number;
    }[];
    segIdx?: number;
  } | null;
  multiSel: string[];
  multiDrag: { startX: number; startY: number; origData: MultiDragOrigData } | null;
  guideDrag: {
    id: string;
    startX: number;
    startY: number;
    origPts: [number, number][];
    // ponytail: índice del vértice tomado → estirar/encoger; undefined → arrastre de cuerpo.
    // Ítem 2: cualquier vértice de la guía (no solo 0|1).
    endIdx?: number;
  } | null;
  marqueeRect: { x1: number; y1: number; x2: number; y2: number } | null;
  MM: {
    lblName: number;
    lblInfo: number;
    lblCode: number;
    flowEmoji: number;
    coord: number;
  };
  readonly labelScaleM: number;

  setTool(t: string): void;
  finishRamal(): void;
  finishArea(): void;
  cancelRamal(): void;
  cancelArea(): void;
  undoLast(): void;
  redoLast(): void;
  toCvs(px: number, py: number): { x: number; y: number };
  toPlane(cx: number, cy: number): { x: number; y: number };
  mm2cvs(mm: number): number;
  pxToM(px: number): number;
  realMmToCanvasPx(realRadiusMm: number): number;
  cmToCanvasPx(cm: number): number;
  cmToPlanePx(cm: number): number;
  snapAngle(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    net?: string,
    tipo?: string,
  ): { x: number; y: number };
  snapToExisting(
    x: number,
    y: number,
    net?: string,
    tipo?: string,
    permitirBajantesLlenos?: boolean,
  ): { x: number; y: number } | null;
  snapPreviewToPadre(x: number, y: number): { x: number; y: number } | null;
  getBajantesFantasma(): PlanoBajante[];
  render(): void;
  scheduleRender(): void;
  _emitSelect(el: unknown): void;
  _emitStatus(msg: string): void;
  _emitDelete(ids: string[]): void;
  _markDirty(): void;
  _statusMsg(): string;
  _renumberRamales(netId: string): void;
  _renumberBajantes(netId: string): void;
  _renumberMontantes(): void;
  _renumberAreas(): void;
  updateElementById(id: string, fields: Record<string, unknown>): void;
  selectAt(cx: number, cy: number): void;
  getSelected():
    | PlanoRamal
    | PlanoBajante
    | PlanoTextAnnotation
    | PlanoArea
    | PlanoDimension
    | PlanoGuideLine
    | null;
  deleteSelected(ids?: string[], opts?: { noMerge?: boolean }): void;
  setActiveNet(id: string): void;
  triggerAlert(title: string, msg: string): void;
  triggerAccesorioModal(data: {
    ramalId: string;
    angleDeg: number;
    junctionIndex: number;
    point: number[];
    net: string;
    isTee?: boolean;
  }): void;
}

// ── Tipos de la clase PlanoEngine movidos aquí (Oleada 1.6 — la clase no se divide) ──

/** Los dos tipos de tubería que se dibujan a mano: un ramal principal o un tributario (la
 *  ramalito que cuelga de otro y desemboca en él). */
export type TramoType = 'ramal' | 'tributario';

/** Un punto suelto, con sus dos coordenadas. */
export interface Point {
  x: number;
  y: number;
}

export type SelectCallback = (el: Record<string, unknown> | null) => void;
export type StatusCallback = (msg: string) => void;
export type UpdateCallback = (data: unknown) => void;
/** Avisa que el dibujo cambió y hay que guardarlo. */
export type DirtyCallback = () => void;

/** Una fila de las tablas de diseño (agua, sanitaria, lluvias, gas): lo que la tabla necesita del
 *  elemento, no el elemento entero. Ej: RAF1 | desde el contador | hasta BAN1 | 12.4 m. */
export interface ElementItem {
  type: string;
  id: string;
  label: string;
  totalL: number;
  segs: number;
  piso: string;
  tipo: string;
  padre?: string | null;
  pendiente?: number;
  diametro?: string;
}
