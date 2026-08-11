/**
 * MultiplayerPanel — painel de rede para criar/entrar em salas multiplayer.
 *
 * Funcionalidades:
 *  - Criar Sala (host) — gera código curto, mostra para partilhar
 *  - Entrar em Sala (join) — input para código, conecta
 *  - Lista de jogadores ligados
 *  - Indicador de latência/estado
 *  - Desconectar
 *
 * Nota: Isto é uma base inicial de multiplayer (sincronização simples),
 * não um sistema anti-cópia/anti-trapaça completo.
 */
import { useState, useEffect } from 'react'
import { multiplayer } from '../../utils/multiplayer/multiplayerManager'
import { useStore } from '../../store/useStore'
import { IconClose } from '../ui/Icons'

export default function MultiplayerPanel({ onClose }) {
  const [mode, setMode] = useState('idle') // idle | hosting | joining | connected
  const [roomCode, setRoomCode] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [players, setPlayers] = useState([])
  const [latency, setLatency] = useState(0)
  const [error, setError] = useState('')
  const toast = useStore((s) => s.toast)

  useEffect(() => {
    const onConnect = () => {
      setMode('connected')
      setError('')
    }
    const onDisconnect = (reason) => {
      setMode('idle')
      setPlayers([])
      setLatency(0)
      if (reason !== 'manual') {
        setError('Conexão perdida: ' + reason)
      }
    }
    const onPlayerJoin = (playerId) => {
      setPlayers(multiplayer.getOtherPlayers())
      toast(`Jogador ${playerId.slice(-4)} entrou`, 'info')
    }
    const onPlayerLeave = (playerId) => {
      setPlayers(multiplayer.getOtherPlayers())
      toast(`Jogador ${playerId.slice(-4)} saiu`, 'info')
    }
    const onLatency = (ms) => setLatency(ms)

    multiplayer.on('connect', onConnect)
    multiplayer.on('disconnect', onDisconnect)
    multiplayer.on('playerJoin', onPlayerJoin)
    multiplayer.on('playerLeave', onPlayerLeave)
    multiplayer.on('latencyUpdate', onLatency)

    return () => {
      // Não é possível remover callbacks individuais facilmente com a API atual
      // O multiplayer é singleton, os callbacks ficam mas são inofensivos
    }
  }, [toast])

  const handleCreate = async () => {
    setError('')
    setMode('hosting')
    try {
      const code = await multiplayer.createRoom()
      setRoomCode(code)
      toast(`Sala criada: ${code}`, 'success')
    } catch (err) {
      setError('Erro ao criar sala: ' + (err.message || 'desconhecido'))
      setMode('idle')
    }
  }

  const handleJoin = async () => {
    if (joinCode.length < 4) {
      setError('Código inválido (mínimo 4 caracteres)')
      return
    }
    setError('')
    setMode('joining')
    try {
      await multiplayer.joinRoom(joinCode)
      setRoomCode(joinCode.toUpperCase())
      toast(`Entrou na sala ${joinCode}`, 'success')
    } catch (err) {
      setError('Erro ao entrar na sala: ' + (err.message || 'desconhecido'))
      setMode('idle')
    }
  }

  const handleDisconnect = () => {
    multiplayer.disconnect()
    setMode('idle')
    setRoomCode('')
    setJoinCode('')
    toast('Desconectado do multiplayer', 'info')
  }

  const copyCode = () => {
    navigator.clipboard?.writeText(roomCode)
    toast('Código copiado', 'success')
  }

  const latencyColor = latency < 50 ? '#3fb950' : latency < 150 ? '#d29922' : '#f85149'

  return (
    <>
      <div className="drawer-backdrop show" onClick={onClose} />
      <aside className="multiplayer-panel open">
        <div className="panel-header">
          <span>Multiplayer</span>
          <button className="icon" onClick={onClose} title="Fechar">
            <IconClose width={14} height={14} />
          </button>
        </div>

        <div className="panel-body">
          {/* Estado da conexão */}
          {mode === 'connected' && (
            <div className="panel-section">
              <div className="mp-status-bar">
                <span className="mp-status-dot" style={{ background: '#3fb950' }} />
                <span className="mp-status-text">Ligado</span>
                <span className="mp-latency" style={{ color: latencyColor }}>
                  {latency}ms
                </span>
              </div>
              <div className="mp-room-info">
                <div className="small muted">Código da sala:</div>
                <div className="mp-room-code" onClick={copyCode}>
                  {roomCode}
                  <span className="mp-copy-hint small muted"> (clica para copiar)</span>
                </div>
              </div>
            </div>
          )}

          {/* Modo idle — escolher criar ou entrar */}
          {mode === 'idle' && (
            <>
              <div className="panel-section">
                <h4>Criar Sala (Host)</h4>
                <p className="small muted mb-2">
                  Cria uma sala e partilha o código com outra pessoa para jogarem juntos.
                </p>
                <button className="primary" style={{ width: '100%' }} onClick={handleCreate}>Criar Sala
                </button>
              </div>

              <div className="panel-section">
                <h4>Entrar em Sala</h4>
                <p className="small muted mb-2">
                  Introduz o código que o host te partilhou.
                </p>
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="ABCDEF"
                  maxLength={6}
                  style={{ textTransform: 'uppercase', textAlign: 'center', fontSize: 18, letterSpacing: 4 }}
                />
                <button
                  className="primary"
                  style={{ width: '100%', marginTop: 8 }}
                  onClick={handleJoin}
                  disabled={joinCode.length < 4}
                >
                  Entrar
                </button>
              </div>
            </>
          )}

          {/* Loading states */}
          {(mode === 'hosting' || mode === 'joining') && (
            <div className="panel-section">
              <div className="mp-loading">
                {mode === 'hosting' ? 'A criar sala...' : 'A conectar à sala...'}
              </div>
            </div>
          )}

          {/* Erro */}
          {error && (
            <div className="panel-section">
              <div className="mp-error">{error}</div>
            </div>
          )}

          {/* Jogadores ligados */}
          {mode === 'connected' && (
            <div className="panel-section">
              <h4>Jogadores na sala ({players.length + 1})</h4>
              <div className="mp-players-list">
                <div className="mp-player-item">
                  <span className="mp-player-name">Eu ({multiplayer.playerId.slice(-4)})</span>
                  <span className="mp-player-tag">Host</span>
                </div>
                {players.map((pid) => (
                  <div key={pid} className="mp-player-item">
                    <span className="mp-player-name">Jogador {pid.slice(-4)}</span>
                    <span className="mp-player-tag">Conectado</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Desconectar */}
          {mode === 'connected' && (
            <div className="panel-section">
              <button className="danger" style={{ width: '100%' }} onClick={handleDisconnect}>
                Desconectar
              </button>
            </div>
          )}

          {/* Nota */}
          <div className="panel-section">
            <div className="mp-note small muted">
              ℹ️ <strong>Nota:</strong> Este é um sistema de multiplayer básico (sincronização simples).
              Não é um sistema anti-cópia/anti-trapaça completo. Usa um servidor de sinalização
              público de teste por defeito — em produção, configura o teu próprio servidor.
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
