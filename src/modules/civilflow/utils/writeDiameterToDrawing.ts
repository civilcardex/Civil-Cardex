// Hub de compatibilidad: el código vive en drawingWrites/ (diametros, otros, props).
// Importadores y tests no cambian.
export {
  findContadorBajante,
  writeDiametroToDrawing,
  writeContadorDiamToDrawing,
  writeAcoDiamToDrawing,
} from './drawingWrites/diametros';
export {
  writePendienteToDrawing,
  writeNSalidasToDrawing,
  writeCanalDimsToDrawing,
} from './drawingWrites/otros';
export {
  writeDiametroToDrawingBatch,
  writeBajantePropToDrawing,
  writeMaterialToDrawing,
  clearDiametroToDrawing,
} from './drawingWrites/props';
