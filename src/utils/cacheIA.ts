/**
 * Caché local de respuestas de la IA en IndexedDB.
 *
 * Cada respuesta se guarda bajo el SHA-256 de la petición que la produjo, para
 * no volver a pagar una llamada idéntica.
 */

const DB_NAME = 'DrMediaCacheDB';
const STORE_NAME = 'responses';

/** Campos de la petición que no cambian la respuesta y no deben formar la clave. */
const CAMPOS_FUERA_DE_LA_CLAVE = [
  'userApiKey',
  'userGroqApiKey',
  'userOpenRouterApiKey',
  'userCerebrasApiKey',
  'userHuggingFaceApiKey',
];

/**
 * Texto que identifica una petición en la caché. Sin las claves de API: cambiar
 * o añadir una clave no altera el resultado, así que no debe invalidar la caché.
 */
export function textoDeClaveDeCache(payload: Record<string, any>): string {
  const sinClaves = { ...payload };
  for (const campo of CAMPOS_FUERA_DE_LA_CLAVE) delete sinClaves[campo];
  return JSON.stringify(sinClaves);
}

export async function hashText(text: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function initCacheDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'hash' });
      }
    };
  });
}

export async function getFromCache(hash: string): Promise<string | null> {
  try {
    const db = await initCacheDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(hash);
      request.onsuccess = () => {
        if (request.result) resolve(request.result.text);
        else resolve(null);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.warn("No se pudo leer de la caché:", e);
    return null;
  }
}

export async function saveToCache(hash: string, text: string): Promise<void> {
  try {
    const db = await initCacheDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put({ hash, text, timestamp: Date.now() });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.warn("No se pudo guardar en la caché:", e);
  }
}

export async function clearAllCache(): Promise<void> {
  try {
    const db = await initCacheDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.warn("No se pudo borrar la caché:", e);
  }
}
