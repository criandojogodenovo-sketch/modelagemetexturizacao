/**
 * multiplayerManager.js — Sistema de multiplayer básico via WebSocket.
 *
 * **Fase 5**: Base inicial de multiplayer (sincronização simples).
 * NÃO é um sistema anti-cópia/anti-trapaça completo.
 *
 * Funcionalidades:
 *  - Criar Sala (host) — gera código curto de 6 caracteres
 *  - Entrar em Sala (join) — por código curto
 *  - Sincronizar posição/rotação/animação de PersonalObject entre jogadores
 *  - Mensagens customizadas via sendMessage(dados) → onMessage(dados)
 *  - Eventos: onPlayerJoin, onPlayerLeave
 *  - Indicador de latência/estado da rede
 *
 * Arquitetura:
 *  - Cliente (este ficheiro) ↔ Servidor de sinalização WebSocket ↔ Outro cliente
 *  - O servidor é um relay simples — não valida nem persiste estado
 *  - Conexão direta entre clientes quando possível (futura: WebRTC data channels)
 *
 * Nota: O servidor de sinalização é externo (deve ser deployado separadamente).
 * Por defeito, usa um servidor publico de teste (wss://echo.websocket.org).
 * Em produção, o utilizador deve configurar o seu próprio servidor.
 */

import { debugLog } from '../debug/debugStore'

const DEFAULT_SERVER = 'wss://echo.websocket.org:443' // servidor de teste (echo)
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // sem caracteres ambíguos
const CODE_LENGTH = 6

/**
 * Gera um código curto aleatório de 6 caracteres.
 */
export function generateRoomCode() {
  let code = ''
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  }
  return code
}

/**
 * MultiplayerManager — gere a conexão de rede e sincronização.
 */
export class MultiplayerManager {
  constructor() {
    this.ws = null
    this.roomCode = null
    this.isHost = false
    this.playerId = this._generatePlayerId()
    this.players = new Map() // playerId → { state, lastUpdate }
    this.connected = false
    this.latency = 0
    this._latencyCheckInterval = null
    this._callbacks = {}
    this._stateSyncInterval = null
    this._lastStateSent = 0
    this._getLocalState = null
  }

  on(event, callback) {
    if (!this._callbacks[event]) this._callbacks[event] = []
    this._callbacks[event].push(callback)
  }

  _emit(event, ...args) {
    const cbs = this._callbacks[event] || []
    cbs.forEach((cb) => {
      try { cb(...args) } catch (e) { console.error('Multiplayer callback error:', e) }
    })
  }

  _generatePlayerId() {
    return 'p_' + Math.random().toString(36).slice(2, 8)
  }

  setLocalStateGetter(getter) {
    this._getLocalState = getter
  }

  async createRoom(serverUrl = DEFAULT_SERVER) {
    this.roomCode = generateRoomCode()
    this.isHost = true
    await this._connect(serverUrl, this.roomCode)
    debugLog(`Sala criada: ${this.roomCode} (host)`, 'log', 'Multiplayer')
    return this.roomCode
  }

  async joinRoom(code, serverUrl = DEFAULT_SERVER) {
    this.roomCode = code.toUpperCase()
    this.isHost = false
    await this._connect(serverUrl, this.roomCode)
    debugLog(`Entrou na sala: ${this.roomCode} (cliente)`, 'log', 'Multiplayer')
  }

  async _connect(serverUrl, roomCode) {
    return new Promise((resolve, reject) => {
      try {
        const url = `${serverUrl}?room=${roomCode}&player=${this.playerId}&host=${this.isHost}`
        this.ws = new WebSocket(url)

        this.ws.onopen = () => {
          this.connected = true
          debugLog('WebSocket conectado', 'log', 'Multiplayer')
          this._emit('connect', { roomCode: this.roomCode, isHost: this.isHost })
          this._send({ type: 'join', playerId: this.playerId, roomCode: this.roomCode })
          this._startLatencyCheck()
          this._startStateSync()
          resolve()
        }

        this.ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data)
            this._handleMessage(msg)
          } catch (e) {
            // Pode ser uma mensagem de texto do servidor echo
          }
        }

        this.ws.onerror = (err) => {
          debugLog('Erro WebSocket: ' + (err.message || 'unknown'), 'error', 'Multiplayer')
          reject(err)
        }

        this.ws.onclose = () => {
          this.connected = false
          this._stopLatencyCheck()
          this._stopStateSync()
          debugLog('WebSocket fechado', 'log', 'Multiplayer')
          this._emit('disconnect', 'connection_closed')
        }
      } catch (err) {
        reject(err)
      }
    })
  }

  _handleMessage(msg) {
    if (msg.type === 'join' && msg.playerId !== this.playerId) {
      this.players.set(msg.playerId, { state: null, lastUpdate: Date.now() })
      debugLog(`Jogador ${msg.playerId} entrou na sala`, 'log', 'Multiplayer')
      this._emit('playerJoin', msg.playerId, msg.playerData || {})
      this._sendState()
    } else if (msg.type === 'leave' && msg.playerId !== this.playerId) {
      this.players.delete(msg.playerId)
      debugLog(`Jogador ${msg.playerId} saiu da sala`, 'log', 'Multiplayer')
      this._emit('playerLeave', msg.playerId)
    } else if (msg.type === 'state' && msg.playerId !== this.playerId) {
      const player = this.players.get(msg.playerId) || { state: null, lastUpdate: 0 }
      player.state = msg.state
      player.lastUpdate = Date.now()
      this.players.set(msg.playerId, player)
      this._emit('playerState', msg.playerId, msg.state)
    } else if (msg.type === 'message' && msg.playerId !== this.playerId) {
      this._emit('message', msg.playerId, msg.data)
    } else if (msg.type === 'ping') {
      this._send({ type: 'pong', timestamp: msg.timestamp, playerId: this.playerId })
    } else if (msg.type === 'pong' && msg.playerId !== this.playerId && msg.timestamp) {
      this.latency = Date.now() - msg.timestamp
      this._emit('latencyUpdate', this.latency)
    }
  }

  _send(msg) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ ...msg, roomCode: this.roomCode }))
    }
  }

  sendMessage(data) {
    this._send({ type: 'message', playerId: this.playerId, data })
    debugLog('Mensagem enviada: ' + JSON.stringify(data).slice(0, 50), 'log', 'Multiplayer')
  }

  _sendState() {
    if (!this._getLocalState) return
    const state = this._getLocalState()
    if (!state) return
    this._send({ type: 'state', playerId: this.playerId, state })
  }

  _startStateSync() {
    this._stateSyncInterval = setInterval(() => {
      this._sendState()
    }, 100)
  }

  _stopStateSync() {
    if (this._stateSyncInterval) {
      clearInterval(this._stateSyncInterval)
      this._stateSyncInterval = null
    }
  }

  _startLatencyCheck() {
    this._latencyCheckInterval = setInterval(() => {
      this._send({ type: 'ping', timestamp: Date.now(), playerId: this.playerId })
    }, 2000)
  }

  _stopLatencyCheck() {
    if (this._latencyCheckInterval) {
      clearInterval(this._latencyCheckInterval)
      this._latencyCheckInterval = null
    }
  }

  disconnect() {
    if (this.ws) {
      this._send({ type: 'leave', playerId: this.playerId })
      this.ws.close()
      this.ws = null
    }
    this.connected = false
    this.players.clear()
    this._stopLatencyCheck()
    this._stopStateSync()
    debugLog('Desconectado do multiplayer', 'log', 'Multiplayer')
  }

  getOtherPlayers() {
    return Array.from(this.players.keys()).filter((id) => id !== this.playerId)
  }

  getPlayerState(playerId) {
    return this.players.get(playerId)?.state || null
  }
}

export const multiplayer = new MultiplayerManager()
