import { devError } from '../../../utils/desarrolloError.ts';
import { idbTx, openIdb } from '../../../lib/idb';

const DB_NAME = 'civilflow_plans';
const DB_VERSION = 1;
const STORE_NAME = 'pdfs';

interface PDFRecord {
  id: number;
  name: string;
  data: ArrayBuffer;
}

/** Guarda el PDF del plano en IndexedDB (bodega local del navegador) para no pedirlo otra vez. Ej: subes el plano del P1 y al reabrirlo carga sin esperar la nube. */
export async function storePDF(id: number, file: File): Promise<void> {
  try {
    const data = await file.arrayBuffer();
    const db = await openIdb(DB_NAME, DB_VERSION, STORE_NAME, 'id');
    await idbTx<void>(db, STORE_NAME, 'readwrite', (store) =>
      store.put({ id, name: file.name, data }),
    );
  } catch (e) {
    devError('idbStorage storePDF:', id, e);
  }
}

/** Devuelve el PDF guardado del plano (null si nunca se subió). */
export async function loadPDF(id: number): Promise<File | null> {
  try {
    const db = await openIdb(DB_NAME, DB_VERSION, STORE_NAME, 'id');
    const record = await idbTx<PDFRecord | undefined>(db, STORE_NAME, 'readonly', (store) =>
      store.get(id),
    );
    if (!record) return null;
    return new File([record.data], record.name, { type: 'application/pdf' });
  } catch (e) {
    devError('idbStorage loadPDF:', id, e);
    return null;
  }
}

/** Vacía la bodega local de PDFs (se usa al crear un proyecto nuevo, que arranca limpio). */
export async function clearAllPDFs(): Promise<void> {
  try {
    const db = await openIdb(DB_NAME, DB_VERSION, STORE_NAME, 'id');
    await idbTx<void>(db, STORE_NAME, 'readwrite', (store) => store.clear());
  } catch (e) {
    devError('idbStorage clearAllPDFs:', e);
  }
}

/** Borra de la bodega local el PDF de un plano eliminado. */
export async function deletePDF(id: number): Promise<void> {
  try {
    const db = await openIdb(DB_NAME, DB_VERSION, STORE_NAME, 'id');
    await idbTx<void>(db, STORE_NAME, 'readwrite', (store) => store.delete(id));
  } catch (e) {
    devError('idbStorage deletePDF:', id, e);
  }
}
