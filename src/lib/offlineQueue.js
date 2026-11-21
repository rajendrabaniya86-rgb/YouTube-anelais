const DB_NAME = 'global-trust-offline';
const STORE = 'ledger-drafts';
const DB_VERSION = 1;

function openDb() {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('इस ब्राउज़र में ऑफलाइन स्टोरेज उपलब्ध नहीं है।'));
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('scope', ['userId', 'shopId'], { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('ऑफलाइन स्टोरेज नहीं खुला।'));
    request.onblocked = () => reject(new Error('ऑफलाइन स्टोरेज का अपडेट रुका हुआ है। दूसरे खुले टैब बंद करके फिर कोशिश करें।'));
  });
}

function createDraftId() {
  if (!globalThis.crypto?.randomUUID) {
    throw new Error('इस डिवाइस में सुरक्षित ड्राफ्ट ID बनाने की सुविधा नहीं है।');
  }
  return globalThis.crypto.randomUUID();
}

function runTransaction(db, mode, action, fallbackMessage) {
  return new Promise((resolve, reject) => {
    let result;
    try {
      const tx = db.transaction(STORE, mode);
      const request = action(tx.objectStore(STORE));
      if (request) {
        request.onsuccess = () => { result = request.result; };
        request.onerror = () => reject(request.error || new Error(fallbackMessage));
      }
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error || new Error(fallbackMessage));
      tx.onabort = () => reject(tx.error || new Error(fallbackMessage));
    } catch (error) {
      reject(error);
    }
  });
}

export async function saveOfflineLedgerDraft(input) {
  if (!input?.userId || !input?.shopId || !input?.customerId ||
      !Number.isFinite(Number(input.amount)) || Number(input.amount) <= 0 ||
      Number(input.amount) > 999999999999.99 || Math.round(Number(input.amount) * 100) !== Number(input.amount) * 100 ||
      !['credit', 'payment'].includes(input.type)) {
    throw new Error('ऑफलाइन ड्राफ्ट की जानकारी सही नहीं है।');
  }
  const draft = {
    id: createDraftId(),
    userId: input.userId,
    shopId: input.shopId,
    customerId: input.customerId,
    type: input.type,
    amount: Number(input.amount),
    note: String(input.note || '').slice(0, 300),
    createdAt: new Date().toISOString(),
    state: 'pending'
  };
  const db = await openDb();
  try {
    await runTransaction(db, 'readwrite', store => store.add(draft), 'ड्राफ्ट सेव नहीं हुआ।');
    return draft;
  } finally {
    db.close();
  }
}

export async function listOfflineLedgerDrafts(userId, shopId) {
  if (!userId || !shopId) return [];
  const db = await openDb();
  try {
    const rows = await runTransaction(
      db, 'readonly',
      store => store.index('scope').getAll([userId, shopId]),
      'ड्राफ्ट सूची नहीं पढ़ी जा सकी।'
    );
    return (rows || []).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  } finally {
    db.close();
  }
}

export async function removeOfflineLedgerDraft(id, userId, shopId) {
  if (!id || !userId || !shopId) return false;
  const db = await openDb();
  try {
    // Verify scope and delete in one read-write transaction to avoid a check/delete race.
    return await new Promise((resolve, reject) => {
      let removed = false;
      try {
        const tx = db.transaction(STORE, 'readwrite');
        const store = tx.objectStore(STORE);
        const request = store.get(id);
        request.onsuccess = () => {
          const row = request.result;
          if (!row || row.userId !== userId || row.shopId !== shopId) return;
          store.delete(id);
          removed = true;
        };
        request.onerror = () => reject(request.error || new Error('ड्राफ्ट जाँचा नहीं जा सका।'));
        tx.oncomplete = () => resolve(removed);
        tx.onerror = () => reject(tx.error || new Error('सिंक हुआ ड्राफ्ट हटाया नहीं जा सका।'));
        tx.onabort = () => reject(tx.error || new Error('सिंक हुआ ड्राफ्ट हटाया नहीं जा सका।'));
      } catch (error) {
        reject(error);
      }
    });
  } finally {
    db.close();
  }
}
