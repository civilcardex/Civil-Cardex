const openPromises = new Map<string, Promise<IDBDatabase>>();

/**
 * Abre (y cachea) una base IndexedDB con un solo object store — dos aperturas simultáneas de
 * la misma BD colisionaban y bloqueaban la segunda para siempre. Ej: openIdb('CivilManagerDB', 1, 'state', 'k').
 *
 * @param dbName nombre de la base.
 * @param version versión (subirla solo con migración de stores).
 * @param storeName nombre del object store a crear si falta.
 * @param keyPath propiedad que hace de clave primaria.
 * @returns la BD abierta (misma promesa para llamadas repetidas).
 */
export function openIdb(
  dbName: string,
  version: number,
  storeName: string,
  keyPath: string,
): Promise<IDBDatabase> {
  let cached = openPromises.get(dbName);
  if (!cached) {
    cached = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(dbName, version);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName, { keyPath });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        openPromises.delete(dbName);
        reject(request.error);
      };
      request.onblocked = () => {
        openPromises.delete(dbName);
        reject(new Error('IndexedDB blocked'));
      };
    });
    openPromises.set(dbName, cached);
  }
  return cached;
}

/**
 * Corre una operación dentro de una transacción IndexedDB y la envuelve en Promise (la API
 * nativa es solo eventos). Ej: idbTx(db, 'state', 'readonly', s => s.get('civilmanager')).
 *
 * @param db base abierta con openIdb.
 * @param storeName store de la transacción.
 * @param mode 'readonly' o 'readwrite'.
 * @param run operación que devuelve el IDBRequest a esperar.
 * @returns el resultado del request cuando la transacción completa.
 */
export function idbTx<T>(
  db: IDBDatabase,
  storeName: string,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const req = run(tx.objectStore(storeName));
    let result: unknown;
    req.onsuccess = () => {
      result = req.result;
    };
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => resolve(result as T);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
