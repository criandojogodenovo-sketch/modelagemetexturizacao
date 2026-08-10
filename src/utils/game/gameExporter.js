/**
 * gameExporter.js — gera um build jogável autónomo a partir do projeto.
 *
 * **Fase 6 (reconstruído)**: O HTML exportado inclui:
 *  - Runtime completo como <script> embutido (de gameRuntime.js)
 *  - Three.js + cannon-es via CDN
 *  - FlirCode parser + runtime
 *  - Física ativa com Conects
 *  - GameUIOverlay com todos os ecrãs
 *  - Câmara do ViewObject ativo
 *  - Eventos: onStart, onTick, onCollide, onClick, onChange, etc.
 *
 * O HTML exportado é funcionalmente idêntico ao "Executar Jogo" do editor.
 */
import { downloadText } from '../helpers'
import gameRuntimeSource from './gameRuntime.js?raw'

export async function optimizeProject(projectData, options = {}) {
  return JSON.parse(JSON.stringify(projectData))
}

export function generateGameHTML(projectData, options = {}) {
  const projectName = options.name || 'Meu Jogo'
  const dataStr = JSON.stringify(projectData)
  // O runtime é embutido como texto (não executado no build) via ?raw
  return `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
  <meta name="theme-color" content="#0d1117">
  <title>${projectName}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
    html,body { width:100%; height:100%; overflow:hidden; background:#0d1117; font-family:sans-serif; }
    #game-canvas { display:block; width:100%; height:100%; touch-action:none; }
    #ui-overlay { position:fixed; inset:0; pointer-events:none; z-index:10; }
    #splash { position:fixed; inset:0; background:#0d1117; display:flex; align-items:center; justify-content:center; flex-direction:column; gap:20px; z-index:100; transition:opacity 0.4s; }
    #splash h1 { font-size:32px; background:linear-gradient(135deg,#2f81f7,#8957e5); -webkit-background-clip:text; -webkit-text-fill-color:transparent; }
    #splash p { color:#8b949e; font-size:14px; text-transform:uppercase; letter-spacing:2px; }
    #debug-console { position:fixed; bottom:0; right:0; width:300px; max-width:100%; height:150px; background:rgba(13,17,23,0.9); border:1px solid #30363d; z-index:50; display:flex; flex-direction:column; }
    #debug-header { padding:4px 8px; background:#161b22; border-bottom:1px solid #30363d; font-size:10px; color:#8b949e; display:flex; justify-content:space-between; }
    #debug-body { flex:1; overflow-y:auto; padding:4px; font-family:monospace; font-size:10px; }
    .dbg-log { color:#8b949e; }
    .dbg-warn { color:#d29922; }
    .dbg-error { color:#f85149; }
  </style>
</head>
<body>
  <div id="splash">
    <div style="font-size:64px;"></div>
    <h1>Flir Engine</h1>
    <p>Feito com Flir Engine</p>
  </div>
  <canvas id="game-canvas"></canvas>
  <div id="ui-overlay"></div>
  <div id="debug-console">
    <div id="debug-header"><span>Debug</span></div>
    <div id="debug-body"></div>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/cannon-es@0.20.0/dist/cannon-es.js"></script>

  <script>
    window.__GAME_DATA__ = ${dataStr};
  </script>

  <script>
${gameRuntimeSource}
  </script>
</body>
</html>`
}

export function generateCapacitorConfig(projectData, options = {}) {
  const projectName = options.name || 'Meu Jogo'
  const appId = options.appId || `com.flirengine.${(projectName || 'jogo').toLowerCase().replace(/[^a-z0-9]/g, '')}`
  return {
    appId,
    appName: projectName,
    webDir: 'dist',
    bundledWebRuntime: false,
    server: { androidScheme: 'https' },
    android: { allowMixedContent: true },
  }
}

export function generateShareUrl(projectId) {
  const base = typeof window !== 'undefined' ? window.location.origin : 'https://flir-engine.vercel.app'
  return `${base}/play/${projectId}`
}

export async function exportGame(projectData, options = {}) {
  const optimized = await optimizeProject(projectData, options)
  const html = generateGameHTML(optimized, options)
  const capacitorConfig = generateCapacitorConfig(projectData, options)
  const projectName = (options.name || 'meu-jogo').toLowerCase().replace(/[^a-z0-9-]/g, '-')
  downloadText(html, `${projectName}.html`, 'text/html')
  downloadText(JSON.stringify(capacitorConfig, null, 2), 'capacitor.config.json', 'application/json')
  const projectId = `game_${Date.now()}`
  const shareUrl = generateShareUrl(projectId)
  return { html, capacitorConfig, shareUrl, projectId }
}
