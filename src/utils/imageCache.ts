const DB_NAME = 'smart_study_guide_images_v1';
const STORE_NAME = 'generated_images';
const memoryFallback = new Map<string, string>();

function openImageDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export function buildImageCacheKey(parts: {
  kind: 'cover' | 'page';
  subject?: string;
  guideTitle?: string;
  lessonTitle?: string;
  illustrationStyle?: string;
  customNote?: string;
  extraSeed?: string;
}): string {
  const normalized = [
    parts.kind,
    (parts.subject || '').trim().toLowerCase(),
    (parts.guideTitle || '').trim().toLowerCase(),
    (parts.lessonTitle || '').trim().toLowerCase(),
    (parts.illustrationStyle || '').trim().toLowerCase(),
    (parts.customNote || '').trim().toLowerCase(),
    (parts.extraSeed || '').trim().toLowerCase(),
  ].join('|');

  let hash = 2166136261;
  for (let i = 0; i < normalized.length; i++) {
    hash ^= normalized.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `img_${parts.kind}_${(hash >>> 0).toString(16)}`;
}

export async function getCachedImage(key: string): Promise<string | null> {
  if (memoryFallback.has(key)) {
    return memoryFallback.get(key) ?? null;
  }
  const db = await openImageDb();
  if (!db) return null;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => {
        const val = typeof req.result === 'string' ? req.result : null;
        if (val) memoryFallback.set(key, val);
        resolve(val);
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function setCachedImage(key: string, dataUrl: string): Promise<void> {
  if (!dataUrl) return;
  memoryFallback.set(key, dataUrl);
  const db = await openImageDb();
  if (!db) return;

  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(dataUrl, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function deleteCachedImage(key: string): Promise<void> {
  memoryFallback.delete(key);
  const db = await openImageDb();
  if (!db) return;

  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}
