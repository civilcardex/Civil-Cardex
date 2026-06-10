export {
  writeSanDrawingSync,
  readSanDrawingSync,
  SAN_SYNC_KEY,
  APARATOS_BY_TRAMO_KEY as APARATOS_BY_TRAMO_STORAGE_KEY,
} from './drawingSync';

export function pisKeyForNivel(n: number | string) { return String(n); }
