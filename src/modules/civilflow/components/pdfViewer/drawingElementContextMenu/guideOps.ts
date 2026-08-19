import type PlanoEngine from '../../../lib/PlanoEngine/PlanoEngine';
import type { PlanoRamal, PlanoGuideLine, PlanoElement } from '../../../lib/PlanoEngine/PlanoState';
import {
  checkRamalAngles,
  detectAccesorioTrigger,
  _firstSegmentAngle,
} from '../../../lib/PlanoEngine/drawingAngles';
import {
  autoSplitJunctionAndSumFlow,
  flowVecAt,
  ramalFlowDirectionCheck,
} from '../../../lib/PlanoEngine/PlanoEngineDrawing';
import { allocTributaryNumber, rootTributarioLabel } from '../../../lib/PlanoEngine/PlanoState';

// Rota pts[1] alrededor de pts[0] (el pivote fijo) en el paso de grados con signo dado,
// validando el resultado contra las mismas reglas de ángulo que debería obedecer un ramal
// real de esa red — así una línea guía nunca puede quedar rotada a un ángulo que su
// conversión posterior "Crear ramal" no aceptaría.
// Intersección estándar línea infinita/segmento acotado: la guía se trata como línea
// infinita (es una ayuda de construcción, a menudo dibujada corta del ramal al que debe
// referenciar) mientras el segmento del ramal queda acotado a su extensión real (s debe
// caer en [0,1], con una tolerancia pequeña para el vértice del propio ramal que yace casi
// exactamente sobre la línea de la guía).
export function intersectGuideWithSegment(
  p0: number[],
  p1: number[],
  q0: number[],
  q1: number[],
): { x: number; y: number } | null {
  const dx1 = p1[0] - p0[0];
  const dy1 = p1[1] - p0[1];
  const dx2 = q1[0] - q0[0];
  const dy2 = q1[1] - q0[1];
  const denom = dx1 * dy2 - dy1 * dx2;
  if (Math.abs(denom) < 1e-9) return null;
  const dx3 = q0[0] - p0[0];
  const dy3 = q0[1] - p0[1];
  const s = (dx3 * dy1 - dy3 * dx1) / denom;
  if (s < -0.02 || s > 1.02) return null;
  return { x: q0[0] + s * dx2, y: q0[1] + s * dy2 };
}

// Busca el ramal más cercano que cruce la línea (infinita) de la guía y devuelve ese punto de
// cruce junto con la dirección del propio segmento del ramal — los botones de rotación forman
// su ángulo respecto a ESTA, no a la orientación actual de la guía, que es precisamente el
// sentido de dibujar una guía a través de un ramal.
export function findGuideCrossing(
  eng: PlanoEngine,
  guide: PlanoGuideLine,
): { point: [number, number]; angle: number; ramalId: string } | null {
  const [p0, p1] = guide.pts;
  let best: { point: [number, number]; angle: number; dist: number; ramalId: string } | null = null;
  for (const r of eng.ramales) {
    if (!r.pts || r.pts.length < 2) continue;
    for (let i = 0; i < r.pts.length - 1; i++) {
      const hit = intersectGuideWithSegment(p0, p1, r.pts[i], r.pts[i + 1]);
      if (!hit) continue;
      const dist = Math.hypot(hit.x - p0[0], hit.y - p0[1]);
      if (!best || dist < best.dist) {
        const dx = r.pts[i + 1][0] - r.pts[i][0];
        const dy = r.pts[i + 1][1] - r.pts[i][1];
        best = { point: [hit.x, hit.y], angle: Math.atan2(dy, dx), dist, ramalId: r.id };
      }
    }
  }
  return best;
}

// Un segmento de ramal cruzado da DOS rayos de referencia posibles desde el punto de cruce
// (su propia dirección y la inversa) — "Superior"/"Inferior" permite al usuario elegir desde
// cuál se mide el ángulo, ya que rotar 45° desde un rayo o desde el otro produce un resultado
// espejado. La Y de pantalla crece hacia abajo, así que "Superior" = el rayo que apunta hacia
// arriba (Y negativa); en empates (ramal horizontal) se cae al rayo que apunta a la izquierda,
// una elección arbitraria pero estable.
export function pickSideAngle(rayAngle: number, side: 'sup' | 'inf'): number {
  const reverse = rayAngle + Math.PI;
  const raySinY = Math.sin(rayAngle);
  const upIsRay = Math.abs(raySinY) > 1e-6 ? raySinY < 0 : Math.cos(rayAngle) < 0;
  const upAngle = upIsRay ? rayAngle : reverse;
  const downAngle = upIsRay ? reverse : rayAngle;
  return side === 'sup' ? upAngle : downAngle;
}

// La tubería san/ll/vent solo gira con codos de 45°; AF/AC y gas solo de 90° — coincide con la
// misma regla por red que `checkRamalAngles`/`drawingAngles.ts` aplica en otros sitios para los
// ramales reales, aplicada aquí como filtro de UX sobre qué botones de rotación se muestran
// (ver GuideLineMenu más abajo).
export function netAllowedSteps(net: string): (45 | 90)[] {
  if (net === 'san' || net === 'll' || net === 'vent') return [45];
  return [90];
}

// Una guía se dibuja con `net: activeNet` fijado en el momento de dibujarla — si el usuario
// cambia de red activa después (o la dibujó con la red "equivocada" activa por descuido), ese
// campo queda desalineado con lo que la guía realmente está cruzando en el plano. Los botones de
// ángulo, la validación y el ramal/tributario que finalmente se crea deben reflejar SIEMPRE la
// red del ramal real que la guía toca, no el valor congelado al dibujarla — así el menú "detecta
// automáticamente" la red correcta en vez de exigir que el usuario la haya elegido bien de
// antemano. Si la guía no cruza ningún ramal (línea guía libre), no hay nada que detectar y se
// conserva `guide.net` como mejor valor disponible.
export function resolveGuideNet(eng: PlanoEngine, guide: PlanoGuideLine): string {
  const crossing = findGuideCrossing(eng, guide);
  if (!crossing) return guide.net;
  const ramal = eng.ramales.find((r) => r.id === crossing.ramalId);
  return ramal?.net || guide.net;
}

export function rotateGuideLine(
  eng: PlanoEngine,
  guide: PlanoGuideLine,
  deg: number,
  side: 'sup' | 'inf',
  setSelElement: (el: PlanoElement | null) => void,
  selElement: PlanoElement | null,
): void {
  // Resolver siempre el objeto VIVO de eng.guideLines por id, nunca confiar en la referencia
  // `guide` recibida — el menú contextual puede guardar una copia desconectada.
  const liveGuide = eng.guideLines.find((g) => g.id === guide.id) || guide;
  const [p0, p1] = liveGuide.pts;
  const crossing = findGuideCrossing(eng, liveGuide);
  const effectiveNet = resolveGuideNet(eng, liveGuide);

  let pivot: [number, number];
  let farPt: number[];
  let baseAngle: number;
  if (crossing) {
    pivot = crossing.point;
    baseAngle = pickSideAngle(crossing.angle, side);
    const d0 = Math.hypot(p0[0] - pivot[0], p0[1] - pivot[1]);
    const d1 = Math.hypot(p1[0] - pivot[0], p1[1] - pivot[1]);
    farPt = d1 >= d0 ? p1 : p0;
  } else {
    pivot = [p0[0], p0[1]];
    baseAngle = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]);
    farPt = p1;
  }
  const dist = Math.hypot(farPt[0] - pivot[0], farPt[1] - pivot[1]);
  const newAngle = baseAngle + (deg * Math.PI) / 180;
  const newFar: [number, number] = [
    pivot[0] + dist * Math.cos(newAngle),
    pivot[1] + dist * Math.sin(newAngle),
  ];
  const newPts: [number, number][] = [pivot, newFar];

  if (!crossing && !checkRamalAngles(newPts, effectiveNet)) {
    eng.triggerAlert(
      'Ángulo no permitido',
      effectiveNet === 'san' || effectiveNet === 'll'
        ? 'Las redes sanitarias y de lluvias solo permiten ángulos de 45°. Usar línea guía para ajustar ángulo.'
        : effectiveNet === 'gas'
          ? 'La red de gas solo permite ángulos de 90°. Usar línea guía para ajustar ángulo.'
          : 'Esta red debe diseñarse con ángulos de 45° o 90°. Usar línea guía para ajustar ángulo.',
    );
    return;
  }
  liveGuide.pts = newPts;
  if (selElement?.id === liveGuide.id) setSelElement({ ...liveGuide });
  eng.render();
  eng._markDirty();
}

export function guideAngleAlertMessage(net: string, tipo: string): string {
  if (net === 'san' || net === 'll' || net === 'vent')
    return 'Las redes sanitarias y de lluvias solo permiten ángulos de 45°. Usar línea guía para ajustar ángulo.';
  if (net === 'gas')
    return 'La red de gas solo permite ángulos de 90°. Usar línea guía para ajustar ángulo.';
  if ((net === 'af' || net === 'ac') && tipo === 'tributario')
    return 'Los tributarios de AF/AC solo permiten ángulos de 90°. Usar línea guía para ajustar ángulo.';
  return 'Esta red debe diseñarse con ángulos de 45° o 90°. Usar línea guía para ajustar ángulo.';
}

// Núcleo compartido de creación de un tributario desde línea guía (botón singular y el plural
// del ítem 1.3): construye el tributario [freeEnd → cruce], valida ángulo/flujo, lo empuja y lo
// parte si cae a mitad de cuerpo de su padre (autoSplitJunctionAndSumFlow). Devuelve el
// tributario o null si algo bloqueó la creación (la alerta ya se disparó).
export function buildTribFromGuide(
  eng: PlanoEngine,
  padre: PlanoRamal,
  crossPt: [number, number],
  freeEnd: [number, number],
  id: string,
): PlanoRamal | null {
  const pStart: [number, number] = [freeEnd[0], freeEnd[1]];
  const pEnd: [number, number] = [crossPt[0], crossPt[1]];
  // El flujo del tributario se dibuja desde pts[0] hacia el último punto — se orienta para que
  // la cabeza apunte AL cruce (la intersección con el ramal padre que alimenta).
  if (!checkRamalAngles([pStart, pEnd], padre.net, 'tributario')) {
    eng.triggerAlert('Ángulo no permitido', guideAngleAlertMessage(padre.net, 'tributario'));
    return null;
  }
  // San/ll/vent: mismo pre-alineamiento que el botón "Crear ramal" — sin esto,
  // autoSplitJunctionAndSumFlow aborta en silencio la división cuando el sentido no coincide con
  // el del padre (tributario queda suelto, sin símbolo, con la alerta "Dirección de flujo
  // incorrecta"). En af/ac/gas esto se sobrescribe de todos modos (autoSplit fuerza la cola del
  // tributario hacia la unión). Se usa el vector LOCAL del padre en el punto de cruce
  // (flowVecAt), no el global pts[0]→pts[last].
  let tribReversedForFlow: boolean | undefined;
  if (padre.net === 'san' || padre.net === 'll' || padre.net === 'vent') {
    const flowEx = flowVecAt(padre, crossPt, 1);
    if (flowEx) {
      const flowNew = [pEnd[0] - pStart[0], pEnd[1] - pStart[1]];
      if (flowNew[0] * flowEx[0] + flowNew[1] * flowEx[1] <= 0) {
        tribReversedForFlow = true;
      }
    }
  }
  // Ítem 10: la numeración va contra el RAÍZ de la cadena de padres — si el cruce cae sobre un
  // tributario, el consecutivo es el global de su ramal raíz (T5RS1), no T1T1RS1.
  const padreLabel = rootTributarioLabel(eng.ramales, padre.id);
  const cnt = allocTributaryNumber(eng, padreLabel);
  const distMm = Math.hypot(pEnd[0] - pStart[0], pEnd[1] - pStart[1]);
  const label = `T${cnt}${padreLabel}`;
  const newTrib: PlanoRamal = {
    id,
    net: padre.net,
    tipo: 'tributario',
    padre: padre.id,
    pts: [pStart, pEnd],
    totalL: +eng.pxToM(distMm).toFixed(3),
    label,
    ini: '',
    fin: '',
    piso: String(eng.nivelActual?.n ?? ''),
    dz: '',
    uc: 0,
    nSalidas: 1,
    // Ítem 1: etiqueta en el punto medio del trazo real [pStart,pEnd] con el ángulo de su
    // primer segmento (igual que los ramales manuales).
    labelX: (pStart[0] + pEnd[0]) / 2,
    labelY: (pStart[1] + pEnd[1]) / 2,
    labelAngle: _firstSegmentAngle([pStart, pEnd]),
    // El tributario nace del mismo material que el ramal al que se une (el padre) — sin esto
    // la etiqueta del canvas no mostraba material (matDrawingLabel('') = ''), a diferencia de
    // los ramales dibujados a mano, que lo heredan de _ramalDefaults en finishRamal.
    material: padre.material || eng._ramalDefaults?.material || '',
    diametro: '',
    pendiente: 2,
    bloqueado: true,
    _tribReversed: tribReversedForFlow,
  };
  // Ítem 5: un tributario vent creado desde guía que termina fluyendo HACIA la unión san (codo
  // reventilado) se bloquea aquí — autoSplit no valida uniones extremo-con-extremo. Misma
  // validación pre-push para san/ll: los tributarios creados desde línea guía deben cumplir la
  // dirección de flujo de la red.
  if (padre.net === 'vent' || padre.net === 'san' || padre.net === 'll') {
    const flowErr = ramalFlowDirectionCheck(eng, newTrib, [newTrib], 0.5);
    if (flowErr) {
      eng.triggerAlert('Dirección de flujo incorrecta', flowErr);
      return null;
    }
  }
  eng.ramales.push(newTrib);
  // Igual que un tributario terminado a mano sobre su padre: parte al padre en existing+
  // downstream en el punto de cruce y fija la dirección del tributario (cola hacia la unión).
  autoSplitJunctionAndSumFlow(eng, newTrib);
  // El usuario pide que una conversión de línea guía a tributario NO dibuje NINGÚN símbolo de
  // accesorio (codo/tee) en la unión — ni siquiera uno que viniera persistido de una conversión
  // anterior con código viejo. En el punto de cruce se anula todo accesorio de extremo que otro
  // ramal (padre, downstream o el propio tributario) tuviera anclado.
  scrubGuideJunctionAccessories(eng, crossPt);
  return newTrib;
}

// Ítem usuario (guías): elimina cualquier accesorioInicio/Fin anclado en los ramales cuyo
// extremo coincide con el punto de la unión de conversión, para que no quede el glifo "C90"/tee
// persistido por código viejo. El codo de SEGMENTOS (arco) que sí se quiere se asigna DESPUÉS,
// por resolveGuideJunctionAccessory, en el handler del botón.
export function scrubGuideJunctionAccessories(eng: PlanoEngine, pt: [number, number]): void {
  const TOL = 0.5;
  for (const r of eng.ramales) {
    if (!r.pts || r.pts.length < 2) continue;
    if (Math.hypot(r.pts[0][0] - pt[0], r.pts[0][1] - pt[1]) < TOL) r.accesorioInicio = '';
    if (Math.hypot(r.pts[r.pts.length - 1][0] - pt[0], r.pts[r.pts.length - 1][1] - pt[1]) < TOL)
      r.accesorioFin = '';
  }
}

// El usuario pidió "eliminar cualquier símbolo de accesorio" — pero matizó: el disco "C90" no,
// el símbolo de SEGMENTOS (arco 90°) sí. En la conversión de guía a tributario/ramal con esquina
// en L, la unión se resuelve sin modal: se escribe el codo de plano (codo90rm/codos_90_std /
// codo45/codos_45) en el extremo del ramal que forma la esquina, y el render dibuja el arco.
// Una tee geométrica (3 brazos, p. ej. el botón plural) no recibe codo — se queda con su tick.
export function resolveGuideJunctionAccessory(eng: PlanoEngine, ramalId: string): void {
  const r = eng.ramales.find((x) => x.id === ramalId);
  if (!r || !r.pts || r.pts.length < 2) return;
  if (r.net !== 'af' && r.net !== 'ac' && r.net !== 'gas') return;
  const trigger = detectAccesorioTrigger(eng, ramalId);
  if (!trigger || trigger.isTee) return;
  const accId =
    trigger.angleDeg === 45
      ? r.net === 'gas'
        ? 'codos_45'
        : 'codo45'
      : r.net === 'gas'
        ? 'codos_90_std'
        : 'codo90rm';
  const TOL = 0.5;
  if (Math.hypot(r.pts[0][0] - trigger.point[0], r.pts[0][1] - trigger.point[1]) < TOL) {
    r.accesorioInicio = accId;
  } else {
    r.accesorioFin = accId;
  }
}
