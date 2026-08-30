/**
 * GameExportModal — modal para exportar o jogo.
 *
 * Mostra:
 *  - Campo para nome do jogo
 *  - Opções de otimização (tamanho máx textura, máx partículas, máx luzes, simplificar malhas)
 *  - Barra de progresso durante o build HTML standalone
 *  - Botão para descarregar HTML standalone
 *  - URL de partilha (rota /play/<id>)
 *  - Secção "Gerar APK (Android)" — Cloud Build no GitHub Actions, disparado
 *    pelas funções serverless /api/build-apk* (Vercel), com polling de estado
 *    e download do APK publicado em Release público do GitHub. O utilizador
 *    não precisa de PC nem Android Studio.
 *
 * Botão "Exportar Jogo" acessível a partir do editor de cenas.
 */
import { useState, useEffect, useRef } from 'react'
import { useStore } from '../../store/useStore'
import { exportGame } from '../../utils/game/gameExporter'
import { IconClose, IconExport } from '../ui/Icons'

// Constantes alinhadas com api/build-apk.js (serverless)
const APK_MAX_PROJECT_BYTES = 4 * 1024 * 1024 // 4MB (limite do request body das Vercel Functions)
const APK_POLL_INTERVAL = 5000 // polling a cada 5s
const APK_TIMEOUT_MS = 15 * 60 * 1000 // 15 min → erro
const APK_ESTIMATED_SECONDS = 180 // estimativa para a barra de progresso

export default function GameExportModal({ onClose }) {
  const exportProjectJSON = useStore((s) => s.exportProjectJSON)
  const objects = useStore((s) => s.objects)
  const scenes = useStore((s) => s.scenes)
  const background = useStore((s) => s.background)
  const grid = useStore((s) => s.grid)
  const lights = useStore((s) => s.lights)
  const toast = useStore((s) => s.toast)

  const [gameName, setGameName] = useState('Meu Jogo 3D')
  const [options, setOptions] = useState({
    maxTextureSize: 512,
    maxParticles: 150,
    maxLights: 6,
    simplifyMeshes: false,
  })
  const [progress, setProgress] = useState(0)
  const [exporting, setExporting] = useState(false)
  const [result, setResult] = useState(null)

  // ---------- APK Cloud Build ----------
  // idle → building → ready | error
  const [apkStatus, setApkStatus] = useState('idle')
  const [apkBuildId, setApkBuildId] = useState(null)
  const [apkDownloadUrl, setApkDownloadUrl] = useState(null)
  const [apkRunUrl, setApkRunUrl] = useState(null)
  const [apkError, setApkError] = useState(null)
  const [apkElapsed, setApkElapsed] = useState(0)
  const pollRef = useRef(null)
  const tickRef = useRef(null)
  const startedAtRef = useRef(0)

  // Limpar timers ao desmontar (modal fechado)
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
      if (tickRef.current) clearInterval(tickRef.current)
    }
  }, [])

  const stopApkTimers = () => {
    if (pollRef.current) clearInterval(pollRef.current)
    if (tickRef.current) clearInterval(tickRef.current)
    pollRef.current = null
    tickRef.current = null
  }

  const handleBuildApk = async () => {
    setApkStatus('building')
    setApkError(null)
    setApkDownloadUrl(null)
    setApkRunUrl(null)
    setApkElapsed(0)
    try {
      // Construir projectData completo (mesma fonte do export HTML)
      const projectData = JSON.parse(exportProjectJSON())
      projectData.scene = { objects, background, grid, lights }
      // S19 FIX (P2-26): o runtime procura definições do catálogo em
      // data.objects (top-level) — sem isto as instâncias não renderizam.
      projectData.objects = objects

      const projectJson = JSON.stringify(projectData)
      if (projectJson.length > APK_MAX_PROJECT_BYTES) {
        setApkStatus('error')
        setApkError(
          `Projeto demasiado grande (${(projectJson.length / 1024 / 1024).toFixed(1)}MB; máximo 4MB). ` +
            'Reduz texturas/geometrias embebidas ou usa o export HTML standalone.',
        )
        return
      }

      const response = await fetch('/api/build-apk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project: projectData }),
      })

      // Guarda amigável para respostas não-JSON (ex.: dev server sem /api)
      const contentType = String(response.headers.get('content-type') || '')
      if (!contentType.includes('application/json')) {
        throw new Error(
          'O endpoint /api/build-apk não respondeu com JSON. O Cloud Build só está ' +
            'disponível na versão publicada do site (deploy Vercel).',
        )
      }

      const data = await response.json()
      if (!response.ok || !data.success) {
        throw new Error(data.error || `HTTP ${response.status}`)
      }

      setApkBuildId(data.buildId)
      startedAtRef.current = Date.now()

      // Ticker de elapsed (1s) + polling de estado (5s)
      tickRef.current = setInterval(() => {
        setApkElapsed(Math.round((Date.now() - startedAtRef.current) / 1000))
      }, 1000)
      startApkPolling(data.buildId)
      toast('Build do APK iniciado na nuvem', 'info', 2000)
    } catch (err) {
      setApkStatus('error')
      setApkError(err.message || String(err))
    }
  }

  const startApkPolling = (buildId) => {
    pollRef.current = setInterval(async () => {
      try {
        const response = await fetch(`/api/build-apk/status?buildId=${encodeURIComponent(buildId)}`)
        const contentType = String(response.headers.get('content-type') || '')
        if (!contentType.includes('application/json')) {
          throw new Error('Resposta inválida do servidor de estado do build.')
        }
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`)

        // Timeout — o build nunca chegou a aparecer/terminar
        if (Date.now() - startedAtRef.current > APK_TIMEOUT_MS) {
          stopApkTimers()
          setApkStatus('error')
          setApkError('O build demorou demasiado (timeout de 15 minutos). Tenta novamente.')
          return
        }

        if (data.htmlUrl) setApkRunUrl(data.htmlUrl)

        if (data.status === 'completed') {
          stopApkTimers()
          if (data.conclusion === 'success') {
            setApkDownloadUrl(
              data.downloadUrl || `/api/build-apk/download?buildId=${encodeURIComponent(buildId)}`,
            )
            setApkStatus('ready')
            toast('O teu APK está pronto para descarregar!', 'success', 2500)
          } else {
            setApkStatus('error')
            setApkError(
              `O build falhou no GitHub Actions (conclusão: ${data.conclusion || 'desconhecida'}).` +
                (data.htmlUrl ? ` Detalhes: ${data.htmlUrl}` : ''),
            )
          }
        } else if (data.status === 'unknown') {
          stopApkTimers()
          setApkStatus('error')
          setApkError(data.error || 'Build não encontrado no GitHub Actions.')
        }
        // queued | in_progress → continua a pollar
      } catch (err) {
        // Falhas de rede pontuais não matam o polling; só acumulam
        console.warn('[APK] Erro no polling (a continuar):', err?.message)
      }
    }, APK_POLL_INTERVAL)
  }

  const resetApk = () => {
    stopApkTimers()
    setApkStatus('idle')
    setApkBuildId(null)
    setApkDownloadUrl(null)
    setApkRunUrl(null)
    setApkError(null)
    setApkElapsed(0)
  }

  const copyShareUrl = () => {
    if (!result?.shareUrl) return
    navigator.clipboard?.writeText(result.shareUrl)
    toast('URL copiada para a área de transferência', 'success', 1500)
  }

  // Progresso estimado do APK (nunca passa de 95% até estar pronto)
  const apkProgress = apkStatus === 'ready' ? 100 : Math.min(95, 5 + (apkElapsed / APK_ESTIMATED_SECONDS) * 90)

  const handleExport = async () => {
    setExporting(true)
    setProgress(10)
    try {
      // Construir projectData completo
      const projectData = JSON.parse(exportProjectJSON())
      projectData.scene = { objects, background, grid, lights }
      // S19 FIX (export): o runtime exportado procura as definições do catálogo
      // em data.objects (top-level, P2-26) — sem isto as instâncias das cenas
      // (scene.objects = {instanceId, objectId, ...}) nunca encontravam as
      // definições e a cidade inteira ficava invisível no jogo exportado.
      projectData.objects = objects

      setProgress(30)
      const res = await exportGame(projectData, { name: gameName, ...options })
      setProgress(100)
      setResult(res)
      toast('Jogo exportado com sucesso!', 'success')
    } catch (err) {
      toast('Erro ao exportar: ' + err.message, 'error')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal game-export-modal" onClick={(e) => e.stopPropagation()}>
        <div className="row between" style={{ marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>Exportar Jogo</h3>
          <button className="icon" onClick={onClose} title="Fechar">
            <IconClose width={16} height={16} />
          </button>
        </div>

        <p className="small muted mb-2">
          Gera um build jogável autónomo (HTML standalone) que abre em qualquer navegador,
          ou compila um APK Android diretamente na nuvem — sem PC nem Android Studio.
        </p>

        {/* Nome do jogo */}
        <div className="prop-row">
          <label>Nome do jogo</label>
          <input
            type="text"
            value={gameName}
            onChange={(e) => setGameName(e.target.value)}
            placeholder="Meu Jogo 3D"
          />
        </div>

        {/* Otimizações */}
        <div className="panel-section" style={{ marginTop: 12 }}>
          <h4>Otimizações para Mobile</h4>

          <div className="prop-row">
            <label>Tamanho máx. textura: {options.maxTextureSize}px</label>
            <select
              value={options.maxTextureSize}
              onChange={(e) => setOptions({ ...options, maxTextureSize: Number(e.target.value) })}
            >
              <option value="256">256px (muito leve)</option>
              <option value="512">512px (leve — recomendado)</option>
              <option value="1024">1024px (média qualidade)</option>
              <option value="2048">2048px (alta qualidade)</option>
            </select>
          </div>

          <div className="prop-row">
            <label>Máx. partículas por sistema: {options.maxParticles}</label>
            <input
              type="range"
              min="50"
              max="500"
              step="50"
              value={options.maxParticles}
              onChange={(e) => setOptions({ ...options, maxParticles: Number(e.target.value) })}
            />
          </div>

          <div className="prop-row">
            <label>Máx. luzes dinâmicas: {options.maxLights}</label>
            <input
              type="range"
              min="2"
              max="16"
              step="1"
              value={options.maxLights}
              onChange={(e) => setOptions({ ...options, maxLights: Number(e.target.value) })}
            />
          </div>

          <label className="checkbox-row mt-2">
            <input
              type="checkbox"
              checked={options.simplifyMeshes}
              onChange={(e) => setOptions({ ...options, simplifyMeshes: e.target.checked })}
            />
            Simplificar malhas (reduz polígonos no build)
          </label>
        </div>

        {/* ===== APK Cloud Build (Android) ===== */}
        <div
          className="panel-section"
          style={{ marginTop: 12, border: '1px solid var(--accent, #4f8cff)', background: 'rgba(79, 140, 255, 0.04)' }}
        >
          <h4>📱 Gerar APK (Android — Cloud Build)</h4>
          <p className="small muted mb-2">
            Compila o APK do teu jogo na nuvem (GitHub Actions) e publica-o num link de
            download. O jogo fica embebido no APK e abre direto em Play Mode.
            Demora 2 a 5 minutos.
          </p>

          {apkStatus === 'idle' && (
            <button
              className="primary"
              onClick={handleBuildApk}
              disabled={!scenes?.length && !objects?.length}
              title={!scenes?.length && !objects?.length ? 'O projeto está vazio' : undefined}
            >
              <IconExport width={14} height={14} />
              Gerar APK
            </button>
          )}

          {apkStatus === 'building' && (
            <div>
              <div className="prop-row">
                <label>
                  A gerar APK... {apkElapsed}s
                  <span className="muted"> (estimativa: ~3 min)</span>
                </label>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${apkProgress}%` }} />
                </div>
              </div>
              {apkRunUrl && (
                <div className="small muted">
                  Acompanha o build no GitHub:{' '}
                  <a href={apkRunUrl} target="_blank" rel="noreferrer">
                    {apkRunUrl}
                  </a>
                </div>
              )}
              <div className="small muted mt-2">
                Podes fechar este modal — mas mantém a página aberta para receber o link.
              </div>
            </div>
          )}

          {apkStatus === 'ready' && apkDownloadUrl && (
            <div>
              <div className="small mb-2" style={{ color: 'var(--success)' }}>
                ✅ APK pronto! Instala no Android (ativa "fontes desconhecidas" se pedido).
              </div>
              <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                <a
                  className="button primary"
                  href={apkDownloadUrl}
                  download="flir-engine.apk"
                  style={{ textDecoration: 'none', padding: '6px 12px' }}
                >
                  ⬇ Descarregar APK
                </a>
                <button onClick={resetApk}>Gerar outro</button>
              </div>
            </div>
          )}

          {apkStatus === 'error' && (
            <div>
              <div className="small mb-2" style={{ color: 'var(--danger, #e5534b)' }}>
                ❌ {apkError || 'Erro ao gerar o APK.'}
              </div>
              <button onClick={handleBuildApk}>Tentar novamente</button>
            </div>
          )}
        </div>

        {/* Barra de progresso */}
        {exporting && (
          <div className="prop-row">
            <label>A exportar... {progress}%</label>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        {/* Resultado */}
        {result && (
          <div className="panel-section" style={{ marginTop: 12, border: '1px solid var(--success)', background: 'rgba(63, 185, 80, 0.05)' }}>
            <h4 style={{ color: 'var(--success)' }}>✓ Build gerado</h4>
            <div className="small mb-2">
              Os ficheiros <code>{gameName.toLowerCase().replace(/[^a-z0-9-]/g, '-')}.html</code> e{' '}
              <code>capacitor.config.json</code> foram descarregados.
            </div>

            {result.shareUrl && (
              <div className="prop-row">
                <label>URL de partilha (rota /play)</label>
                <div className="row" style={{ gap: 6 }}>
                  <input
                    type="text"
                    value={result.shareUrl}
                    readOnly
                    style={{ flex: 1 }}
                  />
                  <button onClick={copyShareUrl} title="Copiar URL">
                    Copiar
                  </button>
                </div>
                <div className="small muted mt-2">
                  Para a rota funcionar, a app precisa de ter uma página em <code>/play/&lt;id&gt;</code> que carregue o projeto da IndexedDB.
                </div>
              </div>
            )}

            <div className="prop-row mt-2">
              <label>Empacotamento APK</label>
              <div className="small muted">
                Para gerar o APK <strong>não precisas de Android Studio</strong>: usa a secção
                «Gerar APK (Cloud Build)» acima — compila na nuvem e devolve o ficheiro pronto
                a instalar. O fluxo manual (Capacitor local) continua disponível para quem
                tiver um PC com Android Studio.
              </div>
            </div>
          </div>
        )}

        <div className="actions mt-2">
          <button onClick={onClose}>Fechar</button>
          <button
            className="primary"
            onClick={handleExport}
            disabled={exporting || !gameName.trim()}
          >
            <IconExport width={14} height={14} />
            {exporting ? 'A exportar...' : 'Exportar Jogo'}
          </button>
        </div>
      </div>
    </div>
  )
}
