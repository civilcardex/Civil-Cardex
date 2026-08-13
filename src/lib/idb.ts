const openPromises = new Map<string, Promise<IDBDatabase>>();

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
