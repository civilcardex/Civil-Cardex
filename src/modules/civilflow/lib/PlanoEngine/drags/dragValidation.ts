/**
 * Validadores al SOLTAR un arrastre: dirección de flujo (contraflujo san/ll/vent), re-ancla de
 * tributario a un ramal que no es su padre, y rotación de rescate al pegar sobre un bajante con
 * ángulo inválido. Extraído verbatim de handleDragUp.ts — los consumen dragUpVertex y
 * dragUpRamalBody. Ej: dragFlowCheck(engine, ram, linked) devuelve el mensaje de alerta si el
 * ramal quedó fluyendo al revés.
 */
import type { IPlanoEngineCore, PlanoRamal } from '../PlanoState.ts';
import {
  ramalFlowDirectionCheck,
  checkRamalAnglesExcludingConnections,
} from '../PlanoEngineDrawing.ts';

// Ítems 2/5: un arrastre que re-ancla un ramal san/ll/vent puede crear una unión contraflujo
// (o un vent puede quedar fluyendo hacia una unión reventilado). Se valida ANTES de autoSplit
// y, si viola, el drag se revierte como un chequeo de ángulo fallido. Incluye el par
// san/vent arrastrado junto (linkedPts) para que una unión reventilado se revierta completa.
export function dragFlowCheck(
  engine: IPlanoEngineCore,
  ram: PlanoRamal,
  linkedRamales: PlanoRamal[],
): string | null {
  for (const r of [ram, ...linkedRamales]) {
    if (!r || !r.pts || r.pts.length < 2) continue;
    if (r.net !== 'san' && r.net !== 'll' && r.net !== 'vent') continue;
    const err = ramalFlowDirectionCheck(engine, r, [], 0.5);
    if (err) return err;
  }
  return null;
}

// Al DIBUJAR (handleLineDown) ya se bloquea conectar un tributario a cualquier ramal que no sea
// su padre seleccionado, pero eso solo protege el trazo nuevo — arrastrar el extremo de un
// tributario EXISTENTE (o todo su cuerpo) sobre otro ramal no tenía ningún chequeo equivalente, y
// un arrastre podía re-anclarlo en silencio al ramal equivocado. Solo dispara cuando un extremo
// queda sobre el vértice propio de otro ramal (una reconexión real), no solo cerca.
export function draggedOntoWrongPadre(engine: IPlanoEngineCore, ram: PlanoRamal): boolean {
  if (!ram.pts || ram.pts.length < 2) return false;
  if (!ram.padre) return false;
  const TOL = 0.5;
  for (const ep of [ram.pts[0], ram.pts[ram.pts.length - 1]]) {
    for (const other of engine.ramales) {
      if (other.id === ram.id || other.net !== ram.net) continue;
      const touches = other.pts?.some(([x, y]) => Math.hypot(x - ep[0], y - ep[1]) < TOL);
      if (!touches || other.id === ram.padre) continue;
      // La unión tributario-a-tributario de AC/AF/gas está permitida cuando ambos comparten el
      // mismo padre seleccionado — misma regla que autoSplitJunctionAndSumFlow (ruta de dibujo).
      if (
        other.tipo === 'tributario' &&
        (other.net === 'af' || other.net === 'ac' || other.net === 'gas') &&
        other.padre === ram.padre
      ) {
        continue;
      }
      return true;
    }
  }
  return false;
}

// Los arrastres de extremo que se pegan SOBRE un bajante (handleDragMove fija el punto
// exactamente sobre el bajante) deben sobrevivir al chequeo de liberación aunque el ángulo final
// quede fuera de la cuadrícula de la red — revertir desharía justo la conexión que el usuario
// acaba de hacer. Cuando es posible, se rota el ramal alrededor del bajante (que queda fijo)
// hasta el ángulo válido más cercano. La rotación es rígida (conserva giros internos y largos de
// segmento), así que solo puede arreglar violaciones absolutas de paso de segmento — y solo en
// tramos rectos de 2 puntos: en un ramal multipunto todos los segmentos se desplazarían con el
// mismo delta, sacando de cuadrícula los segmentos interiores ya válidos. El extremo opuesto
// también debe estar libre — un giro alrededor del bajante despegaría en silencio una unión u
// otra conexión de bajante.
export function tryRotateToValidAngle(
  engine: IPlanoEngineCore,
  ram: PlanoRamal,
  ptIdx: number,
  linkedOk: boolean,
): boolean {
  if (!linkedOk) return false;
  if (ram.net === 'san' || ram.net === 'll') return false;
  const pts = ram.pts;
  if (!pts || pts.length !== 2) return false;
  const anchorIdx = ptIdx === 0 ? 0 : 1;
  const [ax, ay] = pts[anchorIdx];
  const baj = engine.bajantes.find(
    (b) => b.net === ram.net && Math.hypot(b.x - ax, b.y - ay) < 1.5,
  );
  if (!baj) return false;
  const opp = pts[1 - anchorIdx];
  const TOL = 0.5;
  for (const other of engine.ramales) {
    if (other.id === ram.id) continue;
    if (other.pts?.some(([x, y]) => Math.hypot(x - opp[0], y - opp[1]) < TOL)) return false;
  }
  if (
    engine.bajantes.some((b) => b.id !== baj.id && Math.hypot(b.x - opp[0], b.y - opp[1]) < TOL)
  ) {
    return false;
  }
  const step =
    ram.net === 'gas' || ((ram.net === 'af' || ram.net === 'ac') && ram.tipo === 'tributario')
      ? 90
      : 45;
  const dx = opp[0] - ax,
    dy = opp[1] - ay;
  const len = Math.hypot(dx, dy);
  if (len < 0.1) return false;
  const curDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
  const snappedDeg = Math.round(curDeg / step) * step;
  if (Math.abs(snappedDeg - curDeg) < 1) return false;
  const rad = (snappedDeg * Math.PI) / 180;
  pts[1 - anchorIdx] = [ax + len * Math.cos(rad), ay + len * Math.sin(rad)];
  return checkRamalAnglesExcludingConnections(engine, { ...ram, pts });
}
