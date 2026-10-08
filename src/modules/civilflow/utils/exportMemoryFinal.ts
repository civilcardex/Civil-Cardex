// Hub de exportación de la memoria de cálculo (des-monolitización 2026-10-06): la
// implementación vive en memoriaExportShared/Excel/Docx/Pdf — este archivo re-exporta
// la superficie pública (infTab y los archivos de filas importan de aquí).
export {
  type MemoriaHeaderGroup,
  type MemoriaTable,
  type MemoriaData,
  dropAllZeroColumns,
} from './memoriaExportShared';
export { generateMemoriaExcel } from './memoriaExcel';
export { generateMemoriaDocx } from './memoriaDocx';
export { generateMemoriaPdf } from './memoriaPdf';
