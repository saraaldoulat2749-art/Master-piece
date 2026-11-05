(() => {
  const DB_NAME = 'careplus-doctor-documents-v1';
  const STORE_NAME = 'documents';
  function openDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  async function put(id, file) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).put({ id: String(id), blob: file, name: file.name, type: file.type, size: file.size });
      transaction.oncomplete = () => { db.close(); resolve({ id: String(id), name: file.name, type: file.type, size: file.size }); };
      transaction.onerror = () => { db.close(); reject(transaction.error); };
    });
  }
  async function get(id) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const request = db.transaction(STORE_NAME).objectStore(STORE_NAME).get(String(id));
      request.onsuccess = () => { const result = request.result; db.close(); resolve(result || null); };
      request.onerror = () => { db.close(); reject(request.error); };
    });
  }
  async function remove(id) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).delete(String(id));
      transaction.oncomplete = () => { db.close(); resolve(true); };
      transaction.onerror = () => { db.close(); reject(transaction.error); };
    });
  }
  window.CarePlusDoctorDocuments = { put, get, remove };
})();
