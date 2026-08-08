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
