// Hub de creación de elementos de dibujo (des-monolitización 2026-10-06): la implementación
// vive en creations/ — este archivo re-exporta la superficie pública (motor, herramientas y
// tests importan de aquí).
export { BAJANTE_NETS, MONTANTE_NETS, CAJA_NETS } from './creations/cajaBajante';
export { handleCajaDown, handleBajanteDown } from './creations/cajaBajante';
export {
  handleMontanteDown,
  handleCreateMontanteMidBody,
  handleCreateCalentadorMidBody,
  handleCreateTeeCapStub,
  handleCalentadorDown,
} from './creations/montantes';
export { handleCanalDown, commitCanalAncho } from './creations/canales';
export { handleRedPublicaDown, handleContadorDown } from './creations/redPublica';
export { handleCreateBomba } from './creations/bomba';
