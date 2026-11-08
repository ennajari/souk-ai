const DB_NAME = 'souk-offline'
const DB_VERSION = 1
const STORES = ['products', 'transactions', 'customers', 'syncQueue']

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = (event) => {
      const db = event.target.result
      STORES.forEach((store) => {
        if (!db.objectStoreNames.contains(store)) {
          db.createObjectStore(store, { keyPath: 'id', autoIncrement: store === 'syncQueue' })
        }
      })
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function withStore(storeName, mode = 'readonly') {
  return openDB().then((db) => {
    const tx = db.transaction(storeName, mode)
    const store = tx.objectStore(storeName)
    return { store, tx, db }
  })
}

function promisifyRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function getAll(storeName) {
  const { store, db } = await withStore(storeName)
  const result = await promisifyRequest(store.getAll())
  db.close()
  return result
}

export async function put(storeName, item) {
  const { store, db } = await withStore(storeName, 'readwrite')
  await promisifyRequest(store.put(item))
  db.close()
}

export async function remove(storeName, id) {
  const { store, db } = await withStore(storeName, 'readwrite')
  await promisifyRequest(store.delete(id))
  db.close()
}

export async function clear(storeName) {
  const { store, db } = await withStore(storeName, 'readwrite')
  await promisifyRequest(store.clear())
  db.close()
}

export async function addToSyncQueue(action) {
  // action: { url, method, body, timestamp }
  const item = { ...action, timestamp: action.timestamp || Date.now() }
  const { store, db } = await withStore('syncQueue', 'readwrite')
  await promisifyRequest(store.add(item))
  db.close()
}

export async function getSyncQueue() {
  return getAll('syncQueue')
}

export async function syncPendingActions(client) {
  const queue = await getSyncQueue()
  if (queue.length === 0) return 0

  let synced = 0

  const token = localStorage.getItem('token')

  for (const action of queue) {
    try {
      const headers = { 'Content-Type': 'application/json', ...(action.headers || {}) }
      if (token) headers['Authorization'] = `Bearer ${token}`
      const options = {
        method: action.method || 'POST',
        headers,
      }
      if (action.body) {
        options.body = typeof action.body === 'string' ? action.body : JSON.stringify(action.body)
      }

      const fetchFn = client || fetch
      const response = await fetchFn(action.url, options)

      if (response.ok) {
        await remove('syncQueue', action.id)
        synced++
      } else if (response.status >= 400 && response.status < 500 && ![401, 408, 429].includes(response.status)) {
        // Permanently rejected (e.g. stock now insufficient): drop it instead of retrying forever
        console.warn('[offline-sync] dropped rejected action', action.url, response.status)
        await remove('syncQueue', action.id)
      }
    } catch {
      // Stop syncing on network error — remaining items stay in queue
      break
    }
  }

  return synced
}

export default {
  getAll,
  put,
  remove,
  clear,
  addToSyncQueue,
  getSyncQueue,
  syncPendingActions,
}
