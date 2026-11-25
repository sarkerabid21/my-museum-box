const DB_NAME = 'mymuseum_custom_models_v1';
const STORE_NAME = 'glb_models';
const DB_VERSION = 1;

export interface StoredCustomGlb {
  emailKey: string;
  fileName: string;
  buffer: ArrayBuffer;
  updatedAt: number;
}

function openModelDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available in this browser.'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'emailKey' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Failed to open local 3D model store.'));
  });
}

export async function saveCustomGlbForAccount(
  email: string,
  fileName: string,
  buffer: ArrayBuffer
): Promise<void> {
  const emailKey = email.trim().toLowerCase();
  const db = await openModelDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const record: StoredCustomGlb = {
      emailKey,
      fileName,
      buffer,
      updatedAt: Date.now(),
    };
    store.put(record);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error('Failed to save custom 3D model.'));
    };
  });
}

export async function loadCustomGlbForAccount(
  email: string
): Promise<StoredCustomGlb | null> {
  const emailKey = email.trim().toLowerCase();
  try {
    const db = await openModelDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(emailKey);
      req.onsuccess = () => {
        db.close();
        resolve((req.result as StoredCustomGlb | undefined) ?? null);
      };
      req.onerror = () => {
        db.close();
        reject(req.error ?? new Error('Failed to load custom 3D model.'));
      };
    });
  } catch {
    return null;
  }
}

export async function clearCustomGlbForAccount(email: string): Promise<void> {
  const emailKey = email.trim().toLowerCase();
  try {
    const db = await openModelDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(emailKey);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error ?? new Error('Failed to clear custom 3D model.'));
      };
    });
  } catch {
    // Ignore cleanup errors
  }
}
