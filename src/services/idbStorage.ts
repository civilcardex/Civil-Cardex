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
    request.onerror = () => { dbPromise = null; reject(request.error); };
    request.onblocked = () => { dbPromise = null; reject(new Error('IndexedDB blocked')); };
  });
  return dbPromise;
}

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
    console.error('idbStorage storePDF:', id, e);
  }
}

export async function loadPDF(id: number): Promise<File | null> {
  try {
    const db = await openDB();
    return new Promise<File | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(id);
      req.onsuccess = () => {
        const record = req.result as PDFRecord | undefined;
        if (!record) { resolve(null); return; }
        resolve(new File([record.data], record.name, { type: 'application/pdf' }));
      };
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.error('idbStorage loadPDF:', id, e);
    return null;
  }
}

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
    console.error('idbStorage deletePDF:', id, e);
  }
}
