---
Task ID: P6
Agent: main
Task: Otimizar layout mobile em landscape (P6)

Work Log:
- Analisado layout antes da otimização com agent-browser em 914x412 landscape
  - TopBar tinha 14 elementos visíveis (hamburger, logo, 3 emoji quick-icons, mode switch, Novo, GLB/GLTF/OBJ/JSON, Exportar, Guardar/Carregar, .flirengine/Abrir, Undo/Redo, MainMenu, Props)
  - BottomBar tinha 64px de altura (labels 10px)
  - Canvas ~280-300px de altura útil
- Adicionado atributo data-landscape="hide" no TopBar.jsx aos grupos:
  - 3 quick icons (🏠/⛰️/🏃)
  - Group "Novo"
  - Group "Import GLB/GLTF/OBJ/JSON"
  - Group "Guardar/Carregar"
  - Group ".flirengine/Abrir"
- Reescrito media query de landscape em global.css com:
  - --topbar-h: 36px (era 40px)
  - .bottom-bar height: 44px (era 52-64px)
  - .panel.left/.panel.right width: 240px
  - .tab-btn min-height: 34px
  - .viewport-hint: display none (cobria canvas)
  - .viewport-actions button: 32x32 (era 36x36)
  - .app-body height: calc(100vh - 36px - 44px)
  - Modais com max-height + overflow-y auto
  - Inputs/outliner items/tool grid mais compactos
- Modo de jogo (ScenePreview) agora verdadeiramente fullscreen:
  - TopBar e BottomBar condicionalmente não renderizados quando scenePreviewOpen
  - .app-shell.game-mode: grid-template-rows: 1fr (sem topbar row)
  - openScenePreview fecha drawers automaticamente
  - Debug console: default false (era true) + toggle button (🐛) bottom-right
  - .preview-debug-wrap class added (erca inline style)
  - .debug-console override em landscape: 260x140 (erca 400x240)
  - .preview-info mais compacto
- Toasts repositionados em landscape (bottom: 50px) para não cobrir bottom bar
- UIEditor em landscape: 3 colunas preservadas (220/1fr/240)

Testes realizados (agent-browser + VLM):
- 914x412 landscape: TopBar 36px, BottomBar 44px, Canvas 332px (80.6%)
- 844x390 landscape (iPhone X+): TopBar 36px, BottomBar 44px, Canvas 310px (79.5%)
- 740x360 landscape (small Android): TopBar 36px, BottomBar 44px, Canvas 280px (77.8%)
- 412x914 portrait: TopBar 48px, BottomBar 64px (sem regressões)
- 1920x1080 desktop: painel esquerdo 260px preservado (sem regressões)
- Left drawer aberto em landscape: 240px width, painelbody scrollável
- Right drawer aberto em landscape: 240px width, sem overlap
- Modal Exportar: totalmente visível sem clipping
- MAIS grid full-screen: scrollable, todas as categorias acessíveis
- UI editor landscape: 3 colunas (220/454/240) funcionando
- Game preview: fullscreen sem topbar/bottombar, exit button top-right, debug toggle bottom-right

Stage Summary:
- Commit: c9334e3 "feat(P6): landscape mobile layout otimizado"
- Pushed to origin/main
- 5 arquivos modificados (+353, -27)
- TopBar landscape: 8 elementos visíveis (erca 14) — muito mais limpo
- Canvas vertical: 332px em 914x412 (80.6% da viewport, era ~70%)
- Game mode agora é fullscreen real (TopBar/BottomBar ocultos, drawers fecham)
- Debug console não abre automaticamente em landscape (toggleable via 🐛 button)
- Sem regressões em portrait nem desktop

---
Task ID: P7
Agent: main
Task: Editor de Terrenos reconstruído ao padrão Unity

Work Log:
- Lido o TerrainEditor.jsx antigo (637 linhas): tinha 5 brushes, splatmap
  Uint8Array (sem blending), 4 layers fixas, sem tabs, sem brush cursor,
  sem drag painting, sem import/export
- Criado src/utils/terrain/terrainMath.js (487 linhas):
  - Perlin melhorado (Ken Perlin 2002) com buildPermutation + fade/lerp/grad2
  - fBm com oitavas/persistência/lacunaridade
  - generateHeightmap normalizado para [-1, 1]
  - 4 falloff types: smooth (cosine), linear, constant, sharp (1-t^2)
  - applyBrush com 6 modos: raise, lower, smooth (3x3 box blur),
    flatten, setHeight, noise (Mulberry32 PRNG)
  - applyRamp entre 2 pontos
  - Splatmap multi-camada: Float32Array(cells * 4), pesos normalizados
  - paintSplat com blending suave (lerp entre pesos antigos e target)
  - autoSplatByHeight: distribui 4 layers por altura E inclinação
    (relva < 0.5, terra meio, pedra em inclinações altas, neve > 0.65)
  - splatToColors: blending ponderado das cores das camadas
  - heightmapToPNG / pngToHeightmap (import/export 8-bit grayscale)
  - hexToRgb / rgbToHex / applyShade / heightmapStats helpers
- Criado src/utils/terrain/terrainPresets.js:
  - SCULPT_BRUSHES: 7 brushes com ícone + descrição
  - DEFAULT_TEXTURE_LAYERS: 4 layers (relva/terra/pedra/neve)
  - DEFAULT_TERRAIN_CONFIG, DEFAULT_BRUSH, DEFAULT_SCATTER
  - MAX_LAYERS = 4
- Criado src/components/panels/terrain/HeightmapPreview.jsx:
  - Canvas base + overlay canvas (cursor + ramp points + scatter markers)
  - Brush cursor segue rato/dedo: anel externo (raio) + anel interno (50%)
  - Drag painting: onMouseDown/Move/Up + onTouchStart/Move/End
  - Spacing entre stamps (evita sobre-aplicação)
  - Sombreamento por altura (0.55..1.0 factor) para relevo
  - ImageData com splatToColors + putImageData + drawImage escalado
- Reescrito src/components/panels/terrain/TerrainEditor.jsx (575 linhas):
  - 4 tabs estilo Unity Inspector: Escultura/Textura/Detalhes/Definições
  - Tab Escultura: 7 brushes em grelha 4x2, parâmetros (size/strength/
    falloff/targetHeight/spacing), mini-gráfico do falloff
  - Tab Textura: lista de camadas com color picker + nome editável +
    botão remover, "Adicionar Camada", Auto-Textura, Limpar Textura
  - Tab Detalhes: scatter com densidade/altura min-max/inclinação max/
    rotação aleatória/variação de escala + markers no preview
  - Tab Definições: dimensões, Perlin params, regenerar, import/export PNG
  - Preview sempre visível no fim com stats (min/max/Δ) e hint contextual
  - BrushControls sub-componente reutilizado entre Sculpt e Paint tabs
  - FalloffPreview sub-componente: mini-gráfico do perfil de falloff
- Atualizado src/components/panels/ConectRenderer.jsx (TerrainMesh):
  - Vertex colors gerados do splatmap (Float32Array de pesos)
  - meshStandardMaterial com vertexColors=true quando há splatmap
  - Cada vértice recebe cor blended das 4 camadas (somatória ponderada)
- Adicionado CSS:
  - .terrain-tabs (grelha 4 colunas) + .terrain-tab (estilo Unity)
  - .terrain-brush-grid (4 colunas) + .terrain-brush-btn
  - .terrain-layers-list + .terrain-layer-row (com color picker + input)
  - Landscape (P6): terrain-editor 320px, tabs 36px, brushes 42px

Testes realizados (agent-browser + VLM + pixel sampling):
- 4 tabs visíveis e funcionais (VLM confirmou: Escultura/Textura/Detalhes/Definições)
- 7 sculpt brushes visíveis (Elevar/Rebaixar/Suavizar/Achatar/Definir Altura/Ruído/Rampa)
- 4 falloffs visíveis (Smooth/Linear/Constant/Sharp) + mini-gráfico do perfil
- Drag painting funciona — área visivelmente elevada após pintar no preview
- Paint Texture tab: 4 layers com color picker + nome editável + Auto-Textura
- Settings tab: dimensões + Perlin params + Import/Export PNG
- Export PNG gera heightmap-64x64.png válido (8-bit, 65x65, RGBA grayscale)
- 3D mesh mostra vertex colors: 6.2% brown + 4.2% white + 3.5% gray + 1.1% green
  (confirmado por pixel sampling da WebGL canvas)
- Landscape (914x412): painel 320px, tabs usáveis, sem clipping

Stage Summary:
- Commit: 868c897 "feat(P7): Editor de Terrenos reconstruído ao padrão Unity"
- Pushed to origin/main
- 6 arquivos modificados/criados (+1676, -493)
- 3 novos arquivos: terrainMath.js, terrainPresets.js, HeightmapPreview.jsx
- TerrainEditor.jsx reescrito (575 linhas, era 637)
- Build production OK (1.96s, 2.4MB precache)
- Unity alignment atingido: tabs, multi-layer splat blending, falloff types,
  drag painting, brush cursor, import/export PNG, custom layers
