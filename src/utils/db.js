/**
 * db.js — camada de persistência IndexedDB.
 *
 * Substitui o localStorage para projetos/cenas que podem conter:
 *  - Geometrias editadas (customGeometry com arrays de vértices)
 *  - Texturas em base64 (dataURLs que podem ser muitos MB)
 *  - Múltiplas cenas com vários objetos cada
 *
 * Stores (object stores) em IndexedDB:
 *  - `projects`: projetos completos (estado da app serializado)
 *  - `scenes`: cenas individuais (para carregamento rápido)
 *  - `assets`: assets binários (texturas, modelos) — key = hash, value = Blob
 *
 * API exposta:
 *  - saveProject(id, data)        — guarda projeto completo
 *  - loadProject(id)              — carrega projeto
 *  - listProjects()               — lista metadados de projetos
 *  - deleteProject(id)
 *  - saveScene(sceneId, data)
 *  - loadScene(sceneId)
 *  - listScenes()
 *  - deleteScene(sceneId)
 *  - saveAsset(hash, blob)
 *  - loadAsset(hash)
 *  - clearAll()                   — limpa toda a base de dados (debug)
 */

const DB_NAME = 'me3d-db'
const DB_VERSION = 1

// Object stores
const STORE_PROJECTS = 'projects'
const STORE_SCENES = 'scenes'
const STORE_ASSETS = 'assets'

let dbPromise = null

// Abre (ou cria) a base de dados
function openDB() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB não disponível neste browser'))
      return
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onerror = () => reject(req.error)
    req.onsuccess = () => resolve(req.result)
    req.onupgradeneeded = (e) => {
      const db = e.target.result
      if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
        const projectsStore = db.createObjectStore(STORE_PROJECTS, { keyPath: 'id' })
        projectsStore.createIndex('updatedAt', 'updatedAt', { unique: false })
      }
      if (!db.objectStoreNames.contains(STORE_SCENES)) {
        const scenesStore = db.createObjectStore(STORE_SCENES, { keyPath: 'id' })
        scenesStore.createIndex('projectId', 'projectId', { unique: false })
        scenesStore.createIndex('updatedAt', 'updatedAt', { unique: false })
      }
      if (!db.objectStoreNames.contains(STORE_ASSETS)) {
        db.createObjectStore(STORE_ASSETS, { keyPath: 'hash' })
      }
    }
  })
  return dbPromise
}

// Helper genérico para operações em stores
function tx(storeName, mode, fn) {
  return openDB().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode)
    const store = tx.objectStore(storeName)
    const req = fn(store)
    tx.oncomplete = () => resolve(req.result)
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  }))
}

// ---------- Projetos ----------

export async function saveProject(id, data) {
  const payload = {
    id,
    name: data.name || `Projeto ${id}`,
    data,
    updatedAt: Date.now(),
    size: JSON.stringify(data).length,
  }
  await tx(STORE_PROJECTS, 'readwrite', (store) => store.put(payload))
  return payload
}

export async function loadProject(id) {
  const result = await tx(STORE_PROJECTS, 'readonly', (store) => store.get(id))
  return result?.data || null
}

export async function listProjects() {
  const all = await tx(STORE_PROJECTS, 'readonly', (store) => store.getAll())
  return (all || []).map((p) => ({
    id: p.id,
    name: p.name,
    updatedAt: p.updatedAt,
    size: p.size,
  }))
}

export async function deleteProject(id) {
  await tx(STORE_PROJECTS, 'readwrite', (store) => store.delete(id))
}

// ---------- Cenas ----------

export async function saveScene(scene) {
  const payload = {
    ...scene,
    updatedAt: Date.now(),
  }
  await tx(STORE_SCENES, 'readwrite', (store) => store.put(payload))
  return payload
}

export async function loadScene(sceneId) {
  return await tx(STORE_SCENES, 'readonly', (store) => store.get(sceneId))
}

export async function listScenes(projectId) {
  const all = await tx(STORE_SCENES, 'readonly', (store) => store.getAll())
  let scenes = all || []
  if (projectId) {
    scenes = scenes.filter((s) => s.projectId === projectId)
  }
  return scenes.map((s) => ({
    id: s.id,
    name: s.name,
    projectId: s.projectId,
    updatedAt: s.updatedAt,
    objectCount: s.objects?.length || 0,
  }))
}

export async function deleteScene(sceneId) {
  await tx(STORE_SCENES, 'readwrite', (store) => store.delete(sceneId))
}

// ---------- Assets binários ----------

export async function saveAsset(hash, blob) {
  await tx(STORE_ASSETS, 'readwrite', (store) => store.put({ hash, blob, createdAt: Date.now() }))
}

export async function loadAsset(hash) {
  const result = await tx(STORE_ASSETS, 'readonly', (store) => store.get(hash))
  return result?.blob || null
}

// ---------- Utilitários ----------

export async function clearAll() {
  await tx(STORE_PROJECTS, 'readwrite', (store) => store.clear())
  await tx(STORE_SCENES, 'readwrite', (store) => store.clear())
  await tx(STORE_ASSETS, 'readwrite', (store) => store.clear())
}

// Estima o tamanho usado da base de dados
export async function estimateStorage() {
  if (navigator.storage?.estimate) {
    const est = await navigator.storage.estimate()
    return {
      usage: est.usage || 0,
      quota: est.quota || 0,
      percent: est.quota ? (est.usage / est.quota) * 100 : 0,
    }
  }
  return { usage: 0, quota: 0, percent: 0 }
}

// Verifica se IndexedDB está disponível
export function isIndexedDBAvailable() {
  return typeof indexedDB !== 'undefined'
}
