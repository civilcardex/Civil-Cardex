// Catálogo de redes y helpers de activación/numeración por red del motor. Extraído de
// PlanoState (que re-exporta todo — cero churn de imports en los consumidores).
// Sin imports del motor: tipos ESTRUCTURALES (el ciclo PlanoState→planoNets→PlanoState
// haría fallar el guard G3 de ciclos).

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

/** Cuántos ramales y tributarios se han numerado en cada red, para seguir la cuenta sin releer el
 *  plano. Ej: af lleva 3 ramales → el siguiente será RAF4. */
export interface PlanoNetCounts {
  ramal: number;
  tributario: number;
}

/** Mínimo estructural del engine que los helpers de red tocan (sin importar PlanoState). */
interface EngineRedes {
  activeNetworks?: Set<string>;
  activeNet: string;
  triggerAlert: (title: string, msg: string) => void;
  setActiveNet: (netId: string) => void;
}

/** Dice si una red (af = Agua Fría, san = Sanitaria, ll = Lluvias...) está activa en el proyecto.
 *  Si el usuario no definió conjunto, todas valen. Ej: proyecto con solo sanitarias →
 *  checkActiveNet(engine, 'af') es false. */
export function checkActiveNet(engine: EngineRedes, netId: string): boolean {
  const activeNets = engine.activeNetworks as Set<string> | undefined;
  return activeNets ? activeNets.has(netId) : true;
}

/** Cambia a la red si el proyecto la tiene activa; si no, avisa al usuario y aborta (true = no
 *  seguir). Ej: ensureActiveNet(engine, 'gas') en un proyecto sin gas → alerta "Red inactiva". */
export function ensureActiveNet(engine: EngineRedes, netId: string): boolean {
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

/** Dice si dos redes se "pegan" al dibujar: la misma siempre, y sanitarias con ventilación se
 *  imánan entre sí (los codos reventilados unen ambas).
 *  @param a primera red; @param b segunda red; @returns true si se pegan. */
export function netsSnapLinked(a: string, b: string): boolean {
  return a === b || (a === 'vent' && b === 'san') || (a === 'san' && b === 'vent');
}
