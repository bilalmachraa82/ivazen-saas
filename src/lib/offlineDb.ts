// IndexedDB utility for offline invoice uploads

const DB_NAME = 'raquel-offline';
const DB_VERSION = 1;
const STORE_NAME = 'pending-uploads';

export interface PendingUpload {
  id: string;
  imageData: string; // base64
  qrContent: string;
  fileName: string;
  createdAt: number;
  retryCount: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
  
  return dbPromise;
}

export async function addPendingUpload(upload: Omit<PendingUpload, 'id' | 'createdAt' | 'retryCount'>): Promise<string> {
  const db = await openDB();
  const id = crypto.randomUUID();
  const record: PendingUpload = {
    ...upload,
    id,
    createdAt: Date.now(),
    retryCount: 0,
  };
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.add(record);
    
    request.onsuccess = () => resolve(id);
    request.onerror = () => reject(request.error);
  });
}

export async function getPendingUploads(): Promise<PendingUpload[]> {
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function removePendingUpload(id: string): Promise<void> {
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function updateRetryCount(id: string): Promise<void> {
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const getRequest = store.get(id);
    
    getRequest.onsuccess = () => {
      const record = getRequest.result as PendingUpload;
      if (record) {
        record.retryCount++;
        store.put(record);
      }
      resolve();
    };
    getRequest.onerror = () => reject(getRequest.error);
  });
}

export async function getPendingCount(): Promise<number> {
  const uploads = await getPendingUploads();
  return uploads.length;
}
