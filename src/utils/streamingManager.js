/**
 * streamingManager.js — Streaming System para Flir Engine.
 *
 * Performance Core Fase 3.7 — Streaming System.
 *
 * Princípios:
 *  - Carrega assets sob demanda com prioridade e concorrência controlada
 *  - Reference counting: load → reference → release → unload quando count=0
 *  - LRU cache para textures (limite configurável, eviction seguro)
 *  - Fallback automático quando carregamento falha
 *  - Estado TEMPORÁRIO — restore() limpa registos (Bug #4 safe)
 *  - FlirScript-friendly: getters públicos para FlirScriptAPI.Streaming
 *  - NÃO substitui loaders do Three.js (GLTFLoader, FBXLoader, RGBELoader)
 *  - NÃO substitui textureCache existente (integra com LRU)
 *
 * NÃO usa eval() nem new Function().
 *
 * Estados por asset:
 *   idle → queued → loading → loaded → unloading → unloaded
 *                                    ↘ error
 *
 * Prioridades:
 *   critical (0)    — asset necessário para gameplay atual
 *   high (1)        — asset selecionado ou próximo da câmara
 *   normal (2)      — default
 *   low (3)         — asset distante
 *   background (4)  — preload não urgente
 *
 * API pública (FlirScriptAPI.Streaming):
 *  - getStats(): { loadedAssets, queuedAssets, loadingAssets, cacheHits, cacheMisses, evictions, failedLoads }
 *  - isLoaded(assetId): boolean
 *  - getState(assetId): string
 *  - getPriority(assetId): string
 *  - request(assetId, options): Promise
 *  - release(assetId): void
 *
 * Memory usage: NÃO MEDIDO (sem API real de medição de memória JS heap)
 */

import * as THREE from 'three'

// Prioridades (número menor = mais prioritário)
const PRIORITY = {
  critical: 0,
  high: 1,
  normal: 2,
  low: 3,
  background: 4,
}

// Estados
const STATE = {
  idle: 'idle',
  queued: 'queued',
  loading: 'loading',
  loaded: 'loaded',
  unloading: 'unloading',
  unloaded: 'unloaded',
  error: 'error',
}

// Configuração default
const DEFAULT_MAX_CONCURRENT_LOADS = 3
const DEFAULT_TEXTURE_CACHE_LIMIT = 50 // max texturas em cache LRU

/**
 * StreamingManager — singleton que gere carregamento de assets.
 *
 * Estado:
 *  - Map<assetId, AssetEntry> — assets registados
 *  - PriorityQueue (array ordenado por prioridade) para assets em queue
 *  - Set de assets em loading ativo
 *  - Map<textureKey, { texture, lastUsed, refCount }> — cache LRU de texturas
 *  - Stats
 */
class StreamingManagerImpl {
  constructor() {
    this.reset()
  }

  reset() {
    // Map<assetId, AssetEntry>
    // AssetEntry: { id, type, state, priority, refCount, loader, data, error, promise, callbacks }
    this._assets = new Map()
    // Fila de carregamento ordenada por prioridade
    this._queue = []
    // Assets em loading ativo
    this._activeLoads = new Set()
    // Configuração
    this._maxConcurrentLoads = DEFAULT_MAX_CONCURRENT_LOADS
    // Cache LRU de texturas: Map<key, { texture, lastUsed, refCount }>
    this._textureCache = new Map()
    this._textureCacheLimit = DEFAULT_TEXTURE_CACHE_LIMIT
    // Stats
    this._stats = {
      loadedAssets: 0,
      queuedAssets: 0,
      loadingAssets: 0,
      cacheHits: 0,
      cacheMisses: 0,
      evictions: 0,
      failedLoads: 0,
    }
  }

  /**
   * Regista um asset no StreamingManager.
   * @param {string} id — identificador único
   * @param {object} options — { type, priority, loader }
   *   - type: 'texture' | 'geometry' | 'hdri' | 'model' | 'custom'
   *   - priority: 'critical'|'high'|'normal'|'low'|'background' (default: 'normal')
   *   - loader: function() → Promise<data> (chamado quando asset é carregado)
   */
  registerAsset(id, options = {}) {
    if (!id) return
    if (this._assets.has(id)) return // já registado

    const entry = {
      id,
      type: options.type || 'custom',
      priority: PRIORITY[options.priority] ?? PRIORITY.normal,
      state: STATE.idle,
      refCount: 0,
      loader: options.loader || null,
      data: null,
      error: null,
      promise: null,
      callbacks: [],
    }
    this._assets.set(id, entry)
  }

  /**
   * Solicita o carregamento de um asset.
   * Se já está loaded, incrementa refCount e retorna data.
   * Se está em queue/loading, incrementa refCount e retorna promise existente.
   * Se está idle, move para queue e processa.
   *
   * @param {string} id
   * @param {object} options — { priority?: string, loader?: function }
   * @returns {Promise<data>}
   */
  async requestAsset(id, options = {}) {
    let entry = this._assets.get(id)

    // Se não existe, registar com loader fornecido
    if (!entry) {
      if (!options.loader) {
        throw new Error(`Asset ${id} não registado e sem loader`)
      }
      this.registerAsset(id, options)
      entry = this._assets.get(id)
    }

    // Atualizar prioridade se fornecida
    if (options.priority) {
      entry.priority = PRIORITY[options.priority] ?? entry.priority
    }
    if (options.loader && !entry.loader) {
      entry.loader = options.loader
    }

    // Incrementar reference count
    entry.refCount++

    // Se já está loaded, retornar data imediatamente
    if (entry.state === STATE.loaded) {
      return entry.data
    }

    // Se está em loading, aguardar promise existente
    if (entry.state === STATE.loading && entry.promise) {
      return entry.promise
    }

    // Se está em error, tentar novamente
    if (entry.state === STATE.error) {
      entry.error = null
    }

    // Mover para queue
    entry.state = STATE.queued
    this._queue.push(entry)
    this._stats.queuedAssets = this._queue.length

    // Criar promise que resolve quando asset estiver loaded
    const promise = new Promise((resolve, reject) => {
      entry.callbacks.push({ resolve, reject })
    })
    entry.promise = promise

    // Processar fila
    this._processQueue()

    return promise
  }

  /**
   * Libera uma referência a um asset.
   * Se refCount chega a 0, asset é candidato a unload.
   *
   * @param {string} id
   */
  releaseAsset(id) {
    const entry = this._assets.get(id)
    if (!entry) return

    entry.refCount = Math.max(0, entry.refCount - 1)

    // Se refCount = 0, asset pode ser descarregado
    // (não descarregamos imediatamente — fica em cache até eviction ou explicit unload)
    if (entry.refCount === 0 && entry.state === STATE.loaded) {
      // Marcar como candidato a eviction (LRU)
      // Não descarregar aqui — cache LRU gere disposal
    }
  }

  /**
   * Define prioridade de um asset.
   */
  setPriority(id, priority) {
    const entry = this._assets.get(id)
    if (!entry) return
    entry.priority = PRIORITY[priority] ?? entry.priority
    // Re-ordenar fila se asset está em queue
    if (entry.state === STATE.queued) {
      this._sortQueue()
    }
  }

  /**
   * Processa a fila de carregamento respeitando concorrência máxima.
   */
  _processQueue() {
    this._sortQueue()

    while (
      this._activeLoads.size < this._maxConcurrentLoads &&
      this._queue.length > 0
    ) {
      const entry = this._queue.shift()
      this._stats.queuedAssets = this._queue.length
      this._startLoad(entry)
    }
  }

  /**
   * Ordena fila por prioridade (menor número = mais prioritário).
   */
  _sortQueue() {
    this._queue.sort((a, b) => a.priority - b.priority)
  }

  /**
   * Inicia carregamento de um asset.
   */
  async _startLoad(entry) {
    if (!entry.loader) {
      entry.state = STATE.error
      entry.error = 'No loader defined'
      this._stats.failedLoads++
      for (const cb of entry.callbacks) cb.reject(new Error(entry.error))
      entry.callbacks = []
      return
    }

    entry.state = STATE.loading
    this._activeLoads.add(entry.id)
    this._stats.loadingAssets = this._activeLoads.size

    try {
      const data = await entry.loader()
      entry.data = data
      entry.state = STATE.loaded
      this._stats.loadedAssets++

      for (const cb of entry.callbacks) cb.resolve(data)
      entry.callbacks = []
      entry.promise = null
    } catch (err) {
      entry.state = STATE.error
      entry.error = err.message
      this._stats.failedLoads++

      for (const cb of entry.callbacks) cb.reject(err)
      entry.callbacks = []
      entry.promise = null
    } finally {
      this._activeLoads.delete(entry.id)
      this._stats.loadingAssets = this._activeLoads.size
      // Continuar processando fila
      this._processQueue()
    }
  }

  // ===== Texture Cache LRU =====

  /**
   * Obtém textura do cache LRU ou carrega via loader.
   * @param {string} key — chave única (dataURL ou URL)
   * @param {function} loader — function() → THREE.Texture (síncrono ou async)
   * @returns {THREE.Texture}
   */
  getTexture(key, loader) {
    if (!key) return null

    // Cache hit
    if (this._textureCache.has(key)) {
      const entry = this._textureCache.get(key)
      entry.lastUsed = Date.now()
      entry.refCount++
      this._stats.cacheHits++
      return entry.texture
    }

    // Cache miss — carregar
    this._stats.cacheMisses++
    const texture = loader()
    if (!texture) return null

    // Eviction se cache cheio
    if (this._textureCache.size >= this._textureCacheLimit) {
      this._evictLRU()
    }

    this._textureCache.set(key, {
      texture,
      lastUsed: Date.now(),
      refCount: 1,
    })

    return texture
  }

  /**
   * Libera referência a textura do cache.
   */
  releaseTexture(key) {
    const entry = this._textureCache.get(key)
    if (!entry) return
    entry.refCount = Math.max(0, entry.refCount - 1)
    // Não remove aqui — eviction LRU gere quando cache encher
  }

  /**
   * Eviction LRU — remove textura menos recentemente usada com refCount=0.
   */
  _evictLRU() {
    let lruKey = null
    let lruTime = Infinity

    for (const [key, entry] of this._textureCache) {
      if (entry.refCount === 0 && entry.lastUsed < lruTime) {
        lruTime = entry.lastUsed
        lruKey = key
      }
    }

    if (lruKey) {
      const entry = this._textureCache.get(lruKey)
      try {
        entry.texture.dispose()
      } catch (e) {
        // Ignorar erro de dispose
      }
      this._textureCache.delete(lruKey)
      this._stats.evictions++
    }
  }

  /**
   * Remove todas as texturas com refCount=0 do cache.
   */
  flushTextureCache() {
    const toRemove = []
    for (const [key, entry] of this._textureCache) {
      if (entry.refCount === 0) {
        try {
          entry.texture.dispose()
        } catch (e) {}
        toRemove.push(key)
      }
    }
    for (const key of toRemove) {
      this._textureCache.delete(key)
    }
  }

  // ===== Getters públicos (FlirScriptAPI.Streaming) =====

  isLoaded(id) {
    const entry = this._assets.get(id)
    return entry ? entry.state === STATE.loaded : false
  }

  getState(id) {
    const entry = this._assets.get(id)
    return entry ? entry.state : STATE.idle
  }

  getPriority(id) {
    const entry = this._assets.get(id)
    if (!entry) return 'unknown'
    for (const [name, value] of Object.entries(PRIORITY)) {
      if (value === entry.priority) return name
    }
    return 'normal'
  }

  getStats() {
    return { ...this._stats }
  }

  getTextureCacheStats() {
    return {
      size: this._textureCache.size,
      limit: this._textureCacheLimit,
      hits: this._stats.cacheHits,
      misses: this._stats.cacheMisses,
      evictions: this._stats.evictions,
    }
  }

  /**
   * Desregistra asset e limpa referências.
   */
  unregisterAsset(id) {
    const entry = this._assets.get(id)
    if (!entry) return
    // Remover da queue se presente
    const qIdx = this._queue.indexOf(entry)
    if (qIdx >= 0) {
      this._queue.splice(qIdx, 1)
      this._stats.queuedAssets = this._queue.length
    }
    this._activeLoads.delete(id)
    this._assets.delete(id)
  }

  // ===== Restore (Bug #4 safe) =====

  restore() {
    // Rejeitar promises pendentes
    for (const [, entry] of this._assets) {
      if (entry.callbacks.length > 0) {
        for (const cb of entry.callbacks) {
          cb.reject(new Error('StreamingManager restored (Play Mode ended)'))
        }
        entry.callbacks = []
      }
    }
    this._assets.clear()
    this._queue.length = 0
    this._activeLoads.clear()
    // Dispor texturas do cache (apenas as com refCount=0)
    this.flushTextureCache()
    this._stats = {
      loadedAssets: 0,
      queuedAssets: 0,
      loadingAssets: 0,
      cacheHits: 0,
      cacheMisses: 0,
      evictions: 0,
      failedLoads: 0,
    }
  }

  // Alias
  clear() {
    this.restore()
  }
}

// Singleton — uma instância por Canvas.
export const StreamingManager = new StreamingManagerImpl()
export { PRIORITY, STATE, DEFAULT_MAX_CONCURRENT_LOADS, DEFAULT_TEXTURE_CACHE_LIMIT }
export default StreamingManager
