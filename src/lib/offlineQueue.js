const DB_NAME = 'global-trust-offline';
const STORE = 'ledger-drafts';
const DB_VERSION = 1;

function openDb() {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('इस ब्राउज़र में सुरक्षित ऑफलाइन स्टोरेज उपलब्ध नहीं है।'));
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
  });
}

export async function saveOfflineLedgerDraft(input) {
  const db = await openDb();
  const draft = {
    id: crypto.randomUUID(),
    userId: input.userId,
    shopId: input.shopId,
    customerId: input.customerId,
    type: input.type,
    amount: Number(input.amount),
    note: String(input.note || '').slice(0, 300),
    createdAt: new Date().toISOString(),
    state: 'pending'
  };
  if (!draft.userId || !draft.shopId || !draft.customerId ||
      !Number.isFinite(draft.amount) || draft.amount <= 0 ||
      !['credit', 'payment'].includes(draft.type)) {
    db.close();
    throw new Error('ऑफलाइन ड्राफ्ट की जानकारी सही नहीं है।');
  }
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).add(draft);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error || new Error('ड्राफ्ट सेव नहीं हुआ।'));
    tx.onabort = () => reject(tx.error || new Error('ड्राफ्ट सेव रद्द हुआ।'));
  });
  db.close();
  return draft;
}

export async function listOfflineLedgerDrafts(userId, shopId) {
  const db = await openDb();
  const rows = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const request = tx.objectStore(STORE).index('scope').getAll([userId, shopId]);
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error || new Error('ड्राफ्ट सूची नहीं पढ़ी जा सकी।'));
  });
  db.close();
  return rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function removeOfflineLedgerDraft(id, userId, shopId) {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const request = store.get(id);
    request.onsuccess = () => {
      const row = request.result;
      if (row && row.userId === userId && row.shopId === shopId) store.delete(id);
    };
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error || new Error('ड्राफ्ट हटाया नहीं जा सका।'));
  });
  db.close();
}
