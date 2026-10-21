// Hub de compatibilidad del módulo de dibujo: re-exporta los símbolos de los sub-módulos
// extraídos para que los consumidores externos (PlanoMotor.ts, componentes, tests) sigan
// importando desde aquí sin cambios.
//   dibujoAngulos.ts   — validación de ángulos y snaps de tributario
//   dibujoFlujo.ts     — dirección de flujo, polaridad de codos y válidos de extremo
//   dibujoCreations.ts — handlers de creación (bajante, montante, contador, canal…)
//   ramalMedir.ts    — estado de barra y cálculo de longitudes
//   dibujoUtiles.ts    — utilidades geométricas, etiquetas y escala
//   empalmeAutoDivide.ts — auto-división de uniones y detección de padre/yee
//   finishRamal.ts     — finalización del ramal y validación de ángulo cruzado
//   lineaTool.ts        — herramienta de línea (y dim/text/área/erase de un clic)
//   guiaLineas.ts      — líneas guía: snap, cruces en T y uniones
//   dibujoBorra.ts    — borrador y división de ramales

export {
  checkRamalAngles,
  _firstSegmentAngle,
  segmentsIntersect,
  snapTributaryToPadre45Deg,
  codoNivelPermitidoEn,
} from './dibujoAngulos.ts';

export {
  flipRamalFlow,
  flowVecAt,
  flowEndsAt,
  ramalExtremoOcupado,
  extremoEntrelazado,
  aparatoEnExtremoInvalido,
  codoPolarityOk,
  ventFlowsIntoJunction,
  flowDirectionOkAt,
  ramalFlowDirectionCheck,
} from './dibujoFlujo.ts';

export {
  handleBajanteDown,
  handleMontanteDown,
  handleCreateMontanteMidBody,
  handleCreateCalentadorMidBody,
  handleCreateTeeCapStub,
  handleCalentadorDown,
  handleRedPublicaDown,
  handleContadorDown,
  handleCanalDown,
  handleCajaDown,
} from './dibujoCreations.ts';

export { _statusMsg, calculateRamalLength } from './ramalMedir.ts';

export {
  _nextLabel,
  reverseRamalEndpoints,
  _midpoint,
  _calcPolyArea,
  inchPartOfDiametro,
  maxDiametroLabel,
  bumpBajanteToMaxRamal,
  followBajanteToMaxRamal,
  cancelRamal,
  cancelArea,
  finishArea,
  setScaleM,
  setDefinedScaleM,
} from './dibujoUtiles.ts';

export {
  canJoinTributario,
  autoSplitJunctionAndSumFlow,
  detectTributaryPadre,
  checkRamalAnglesExcludingConnections,
  puntoEnCaja,
} from './empalmeAutoDivide.ts';

export { finishRamal, checkCrossRamalAngle } from './finishRamal';

export {
  setTool,
  handleLineDown,
  handleDimDown,
  handleTextDown,
  handleAreaDown,
  handleDrawingMouseMove,
  handleDoubleClick,
} from './lineaTool.ts';
export type { ToolType } from './lineaTool.ts';

export {
  snapGuidePoint,
  snapGuideSegmentToRamal,
  handleGuideDown,
  commitOpenGuide,
  guideBodyHit,
  snapGuideCrossingToEndpoint,
  guideRamalJunctions,
  findGuideTCrossing,
} from './guiaLineas.ts';

export { deleteSegmentAt, handleEraseDown, eraseRamalAt } from './dibujoBorra.ts';
