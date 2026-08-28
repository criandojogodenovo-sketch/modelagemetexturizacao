/**
 * GameExportModal — modal para exportar o jogo como build standalone.
 *
 * Mostra:
 *  - Campo para nome do jogo
 *  - Opções de otimização (tamanho máx textura, máx partículas, máx luzes, simplificar malhas)
 *  - Barra de progresso durante o build
 *  - Botão para descarregar HTML standalone
 *  - Botão para descarregar capacitor.config.json
 *  - URL de partilha (rota /play/<id>)
 *
 * Botão "Exportar Jogo" acessível a partir do editor de cenas.
 */
import { useState } from 'react'
import { useStore } from '../../store/useStore'
import { exportGame } from '../../utils/game/gameExporter'
import { IconClose, IconExport } from '../ui/Icons'

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

  const copyShareUrl = () => {
    if (!result?.shareUrl) return
    navigator.clipboard?.writeText(result.shareUrl)
    toast('URL copiada para a área de transferência', 'success', 1500)
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
          pronto para empacotamento como APK Android via Capacitor.
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
              <option value={256}>256px (muito leve)</option>
              <option value={512}>512px (leve — recomendado)</option>
              <option value={1024}>1024px (média qualidade)</option>
              <option value={2048}>2048px (alta qualidade)</option>
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
              <label>Empacotamento APK (Capacitor)</label>
              <div className="small muted">
                Coloca o <code>index.html</code> gerado numa pasta <code>dist/</code> e executa:
                <pre style={{ background: 'var(--bg-app)', padding: 8, borderRadius: 4, marginTop: 6, fontSize: 11 }}>
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init
npx cap add android
npx cap copy android
npx cap open android
                </pre>
                Depois, no Android Studio, gera o APK.
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
