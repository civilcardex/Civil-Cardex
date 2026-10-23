// Hub de compatibilidad: el código vive en drawingWrites/ (diametros, otros, props).
// Importadores y tests no cambian.
export {
  findContadorBajante,
  writeDiametroToDrawing,
  writeContadorDiamToDrawing,
  writeAcoDiamToDrawing,
} from './drawingWrites/diameters';
export {
  writePendienteToDrawing,
  writeNSalidasToDrawing,
  writeCanalDimsToDrawing,
} from './drawingWrites/others';
export {
  writeDiametroToDrawingBatch,
  writeBajantePropToDrawing,
  writeMaterialToDrawing,
  clearDiametroToDrawing,
} from './drawingWrites/props';
