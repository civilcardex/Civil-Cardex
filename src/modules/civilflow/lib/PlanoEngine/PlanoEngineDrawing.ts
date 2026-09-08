// Hub de compatibilidad del módulo de dibujo: re-exporta los símbolos de los sub-módulos
// extraídos para que los consumidores externos (PlanoEngine.ts, componentes, tests) sigan
// importando desde aquí sin cambios.
//   drawingAngles.ts   — validación de ángulos y snaps de tributario
//   drawingFlow.ts     — dirección de flujo, polaridad de codos y válidos de extremo
//   drawingCreations.ts — handlers de creación (bajante, montante, contador, canal…)
//   ramalMeasure.ts    — estado de barra y cálculo de longitudes
//   drawingUtils.ts    — utilidades geométricas, etiquetas y escala
//   junctionAutoSplit.ts — auto-división de uniones y detección de padre/yee
//   finishRamal.ts     — finalización del ramal y validación de ángulo cruzado
//   lineTool.ts        — herramienta de línea (y dim/text/área/erase de un clic)
//   guideLines.ts      — líneas guía: snap, cruces en T y uniones
//   drawingErase.ts    — borrador y división de ramales

export {
  checkRamalAngles,
  _firstSegmentAngle,
  segmentsIntersect,
  snapTributaryToPadre45Deg,
  codoNivelPermitidoEn,
} from './drawingAngles';

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
} from './drawingFlow';

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
} from './drawingCreations';

export { _statusMsg, calculateRamalLength } from './ramalMeasure';

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
} from './drawingUtils';

export {
  canJoinTributario,
  autoSplitJunctionAndSumFlow,
  detectYeeSimpleNear,
  detectTributaryPadre,
  checkRamalAnglesExcludingConnections,
} from './junctionAutoSplit';

export { finishRamal, checkCrossRamalAngle } from './finishRamal';

export {
  setTool,
  handleLineDown,
  handleDimDown,
  handleTextDown,
  handleAreaDown,
  handleDrawingMouseMove,
  handleDoubleClick,
} from './lineTool';

export {
  snapGuidePoint,
  snapGuideSegmentToRamal,
  handleGuideDown,
  commitOpenGuide,
  guideBodyHit,
  snapGuideCrossingToEndpoint,
  guideRamalJunctions,
  findGuideTCrossing,
} from './guideLines';

export { deleteSegmentAt, handleEraseDown, eraseRamalAt } from './drawingErase';
