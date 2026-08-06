import { devError } from '../../../utils/devError';

const DB_NAME = 'civilflow_plans';
const STORE_NAME = 'pdfs';
const DB_VERSION = 1;

interface PDFRecord {
  id: number;
  name: string;
  data: ArrayBuffer;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };
    request.onblocked = () => {
      dbPromise = null;
      reject(new Error('IndexedDB blocked'));
    };
  });
  return dbPromise;
}

/**
 * Guarda un archivo PDF en IndexedDB con clave numérica por id.
 * @param id - Identificador numérico del plano.
 * @param file - Objeto File PDF a persistir.
 */
export async function storePDF(id: number, file: File): Promise<void> {
  try {
    const data = await file.arrayBuffer();
    const db = await openDB();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put({ id, name: file.name, data });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch (e) {
    devError('idbStorage storePDF:', id, e);
  }
}

/**
 * Carga un archivo PDF de IndexedDB por id. Devuelve un objeto File con el nombre original
 * y el MIME type.
 * @param id - Identificador numérico del plano.
 * @returns Objeto File o null si no existe.
 */
export async function loadPDF(id: number): Promise<File | null> {
  try {
    const db = await openDB();
    return new Promise<File | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(id);
      req.onsuccess = () => {
        const record = req.result as PDFRecord | undefined;
        if (!record) {
          resolve(null);
          return;
        }
        resolve(new File([record.data], record.name, { type: 'application/pdf' }));
      };
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    devError('idbStorage loadPDF:', id, e);
    return null;
  }
}

/**
 * Elimina todos los registros PDF del store de IndexedDB.
 */
export async function clearAllPDFs(): Promise<void> {
  try {
    const db = await openDB();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch (e) {
    devError('idbStorage clearAllPDFs:', e);
  }
}

/**
 * Elimina un registro PDF individual de IndexedDB por id.
 * @param id - Identificador numérico del plano.
 */
export async function deletePDF(id: number): Promise<void> {
  try {
    const db = await openDB();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch (e) {
    devError('idbStorage deletePDF:', id, e);
  }
}
