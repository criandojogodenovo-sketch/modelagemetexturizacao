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
    html,body { width:100%; height:100%; overflow:hidden; background:#0a0e1a; font-family:sans-serif; }
    #game-canvas { display:block; width:100%; height:100%; touch-action:none; }
    #ui-overlay { position:fixed; inset:0; pointer-events:none; z-index:10; }
    #splash { position:fixed; inset:0; background:#0a0e1a; display:flex; align-items:center; justify-content:center; flex-direction:column; z-index:100; transition:opacity 0.4s, transform 0.4s; }
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
    <svg width="220" height="242" viewBox="0 0 240 264" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:block">
      <defs>
        <linearGradient id="flirShield" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#3b82f6" />
          <stop offset="50%" stop-color="#5b8def" />
          <stop offset="100%" stop-color="#8b5cf6" />
        </linearGradient>
        <linearGradient id="flirSilver" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#f3f4f6" />
          <stop offset="50%" stop-color="#e5e7eb" />
          <stop offset="100%" stop-color="#9ca3af" />
        </linearGradient>
        <linearGradient id="flirLine" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#3b82f6" stop-opacity="0" />
          <stop offset="50%" stop-color="#8b5cf6" />
          <stop offset="100%" stop-color="#3b82f6" stop-opacity="0" />
        </linearGradient>
        <filter id="flirShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000" flood-opacity="0.4" />
        </filter>
        <filter id="flirGlow" x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <g filter="url(#flirGlow)">
        <path d="M120 18 L198 56 L198 152 L120 190 L42 152 L42 56 Z" stroke="url(#flirShield)" stroke-width="3" fill="none" stroke-linejoin="round" />
        <path d="M120 28 L188 61 L188 147 L120 180 L52 147 L52 61 Z" stroke="url(#flirShield)" stroke-width="1.5" fill="#0a0e1a" fill-opacity="0.6" stroke-linejoin="round" />
      </g>
      <g filter="url(#flirShadow)">
        <path d="M88 68 L88 142 L100 142 L100 112 L128 112 L128 100 L100 100 L100 80 L132 80 L132 68 Z" fill="url(#flirShield)" />
        <path d="M88 68 L132 68 L132 73 L88 73 Z" fill="#ffffff" fill-opacity="0.3" />
        <path d="M88 68 L93 68 L93 142 L88 142 Z" fill="#000" fill-opacity="0.2" />
      </g>
      <g>
        <rect x="52" y="205" width="8" height="28" fill="url(#flirSilver)" />
        <rect x="52" y="205" width="18" height="7" fill="url(#flirSilver)" />
        <rect x="52" y="218" width="15" height="6" fill="url(#flirSilver)" />
        <rect x="78" y="205" width="8" height="28" fill="url(#flirSilver)" />
        <rect x="78" y="226" width="16" height="7" fill="url(#flirSilver)" />
        <rect x="103" y="213" width="7" height="20" fill="url(#flirSilver)" />
        <path d="M106.5 204 L112 210 L101 210 Z" fill="#8b5cf6" />
        <rect x="118" y="205" width="7" height="28" fill="url(#flirSilver)" />
        <rect x="118" y="205" width="14" height="6" fill="url(#flirSilver)" />
        <rect x="125" y="205" width="7" height="12" fill="url(#flirSilver)" />
        <rect x="118" y="211" width="14" height="6" fill="url(#flirSilver)" />
        <path d="M125 217 L133 233 L141 233 L133 217 Z" fill="url(#flirSilver)" />
      </g>
      <text x="120" y="253" text-anchor="middle" font-size="13" font-weight="700" letter-spacing="4" fill="#3b82f6" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Inter, Arial, sans-serif">ENGINE</text>
      <rect x="50" y="248" width="50" height="1.5" fill="url(#flirLine)" />
      <rect x="140" y="248" width="50" height="1.5" fill="url(#flirLine)" />
      <text x="120" y="268" text-anchor="middle" font-size="7" font-weight="500" letter-spacing="2" fill="#6b7280" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Inter, Arial, sans-serif">MOBILE \u2022 WEB \u2022 POWERFUL</text>
    </svg>
  </div>
  <canvas id="game-canvas"></canvas>
  <div id="ui-overlay"></div>
  <div id="debug-console">
    <div id="debug-header"><span>Debug</span></div>
    <div id="debug-body"></div>
  </div>

  <script type="importmap">
  {
    "imports": {
      "three": "https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js",
      "cannon-es": "https://cdn.jsdelivr.net/npm/cannon-es@0.20.0/dist/cannon-es.js"
    }
  }
  </script>

  <script>
    window.__GAME_DATA__ = ${dataStr};
  </script>

  <script type="module">
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
