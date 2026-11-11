/**
 * Catálogo de herramientas del visor y regla herramienta↔red: qué herramientas existen, cuáles
 * se insertan por red activa (contador, canal, cajas, gabinete, muro) y cuáles quedan
 * deshabilitadas. Extraído de PdfViewerToolbar para que la regla sea testeable sin React.
 * Ej: buildNetTools('gas', true) incluye 'cont' (Contador) y esToolDisabled oculta 'baj'.
 */
export interface ToolDef {
  id: string;
  label: string;
  ico: string;
  icoCol: string;
  shortcut: string;
}

// Bajante solo tiene sentido en san/vent/ll (bajantes); montante solo en gas/ac/af/rci (montantes) —
// centralizado aquí para que las dos rutas de render de la barra (expandida/colapsada) y los
// atajos de teclado de PlanoEngine.ts apliquen exactamente la misma regla sin divergir.
export function isToolDisabledForNet(
  toolId: string,
  net: string,
  recolectoraActive = true,
): boolean {
  if (toolId === 'baj') return !['san', 'vent', 'll'].includes(net);
  if (toolId === 'mon') return !['gas', 'ac', 'af', 'rci'].includes(net);
  // Los glifos de canal recolectora solo tienen sentido con la red de agua lluvias ('ll')
  // ACTIVA en esa sesión — de lo contrario la herramienta dibujaría formas de una red que el
  // proyecto no está diseñando (ni el piso la está viendo).
  if (toolId === 'canal') return net !== 'll' || !recolectoraActive;
  // Cajas de recolección: CAN solo con sanitaria activa, CALL solo con lluvias activa.
  if (toolId === 'caja') return !['san', 'll'].includes(net);
  // Gabinete GABn: solo rci (guard del motor: handleGabineteDown).
  if (toolId === 'gab') return net !== 'rci';
  // Muro: solo rci (la verificación de distancia de ramales a muros es del módulo RCI).
  if (toolId === 'muro') return net !== 'rci';
  return false;
}

export const TOOLS: ToolDef[] = [
  {
    id: 'sel',
    label: 'Seleccionar',
    ico: '\uD83D\uDC46',
    icoCol: '#9BA8AA',
    shortcut: 'S',
  },
  {
    id: 'line-ramal',
    label: 'Ramal principal',
    ico: '\u2571',
    icoCol: '#4D8FF7',
    shortcut: 'R',
  },
  {
    id: 'line-trib',
    label: 'Tributario',
    ico: '\u2571',
    icoCol: '#4D8FF7',
    shortcut: 'T',
  },
  { id: 'area', label: 'Área', ico: '\u2B21', icoCol: '#22D3EE', shortcut: 'A' },
  {
    id: 'dim',
    label: 'Medir/Acotar',
    ico: '\uD83D\uDCCF',
    icoCol: '#22D3EE',
    shortcut: 'D',
  },
  {
    id: 'guide',
    label: 'L\u00EDnea gu\u00EDa',
    ico: '\u2504',
    // 'G' colisionaba con el atajo mostrado para Snap \u2014 U (de "gU\u00EDa") queda libre.
    icoCol: '#888888',
    shortcut: 'U',
  },
  { id: 'text', label: 'Texto', ico: 'T', icoCol: '#A855F7', shortcut: 'C' },
  { id: 'baj', label: 'Bajante', ico: '\u2193', icoCol: '#F04545', shortcut: 'B' },
  { id: 'mon', label: 'Montante', ico: '\u2191', icoCol: '#3B82F6', shortcut: 'M' },
  { id: 'erase', label: 'Borrador', ico: '🧽', icoCol: '#ffb4ab', shortcut: 'E' },
];

/** Herramientas visibles para la red activa: catálogo base + inserciones por red + filtro por
 *  regla. El ORDEN de los splice es contrato (definía el orden de botones del HTML original).
 *  Ej: buildNetTools('af', true) pone 'cont' entre Texto y Bajante. */
export function buildNetTools(activeNet: string, recolectoraActive: boolean): ToolDef[] {
  const netTools = [...TOOLS];
  if (activeNet === 'af' || activeNet === 'gas') {
    netTools.splice(7, 0, {
      id: 'cont',
      label: 'Contador',
      ico: '🔳',
      icoCol: '#4D8FF7',
      shortcut: 'O',
    });
  }
  // El canal está disponible en cualquier piso/red activa mientras canal recolectora esté
  // activa — la visibilidad la controla isToolDisabledForNet(..., recolectoraActive) abajo.
  // Atajo 'L' (de aguas Lluvias): la 'C' ya es la herramienta Texto (useKeyboardShortcuts).
  netTools.splice(7, 0, {
    id: 'canal',
    label: 'Canal',
    ico: '▭',
    icoCol: '#8B5CF6',
    shortcut: 'L',
  });
  // Caja de recolección (san → CAN, ll → CALL): cuadrados concéntricos 100×100/70×70cm
  // a escala. La red del
  // elemento la decide handleCajaDown según activeNet; la etiqueta de la herramienta nombra la
  // red activa. ('X' ya borra montante.)
  netTools.splice(7, 0, {
    id: 'caja',
    label: activeNet === 'll' ? 'Caja ALL' : 'Caja AN',
    ico: '⧉',
    icoCol: '#10B981',
    shortcut: 'J',
  });
  // Gabinete GABn (SOLO rci): el motor ya trae la herramienta completa ('gab' en ToolType,
  // handleGabineteDown, atajo 'J' — la misma tecla que Caja, redes mutuamente excluyentes);
  // aquí solo se expone el botón (ped. usuario).
  netTools.splice(7, 0, {
    id: 'gab',
    label: 'Gabinete',
    ico: '▦',
    icoCol: '#d29922',
    shortcut: 'J',
  });
  // Muro (SOLO rci, ped. usuario): dibuja la pared para la verificación de distancia de
  // ramales a muros — misma mecánica de línea guía pero nace esMuro nativo (roja) y su menú
  // solo ofrece quitarla. Atajo 'W' (wall).
  netTools.splice(7, 0, {
    id: 'muro',
    label: 'Muro',
    ico: '▬',
    icoCol: '#f87171',
    shortcut: 'W',
  });
  return netTools.filter((t) => !isToolDisabledForNet(t.id, activeNet, recolectoraActive));
}
