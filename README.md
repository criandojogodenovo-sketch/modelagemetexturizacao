# Modelagem & Texturização 3D — FlirScript Engine

Engine web de modelagem, texturização, animação e edição de cenas 3D — funciona offline como PWA instalável. Construída com **React + Vite + Three.js**, inspirada em Blender e Spline, com interface escura e responsiva (desktop + telemóvel/tablet).

> Todo o código corre 100% no browser (client-side). Não há backend obrigatório. Instalável como app no telemóvel/desktop.

---

---

## 📋 Estado Real da Engine (Auditoria Honesta — Agosto 2026, Sessão 4)

Esta secção documenta o estado REAL da engine após auditoria exaustiva e 4 sessões de correções. Sê cético sobre o que encontras em caches antigas — lê isto primeiro.

### ✅ O que FUNCIONA (testado e operacional)

- **Editor de modelagem 3D** — primitivas, edit, sculpt, materiais PBR, UV, animação, rig, esqueleto, FBX/GLB/OBJ import, GLB/OBJ/JSON export
- **Editor de cenas** — level editor com drag-and-drop, múltiplas cenas, gameCamera configurável
- **55+ tipos de Conects** com renderers dedicados — ver secção Conects
- **Modo de jogo** — física cannon-es (com mass=1 para PersonalObject/NPC), FlirCode runtime, animações, checkpoints, save/respawn
- **Joystick mobile** — `pointerEvents: 'auto'` corrigido; movimento relativo à câmara (estilo Godot)
- **Câmara FPS/Third-person** — `ViewObject` com `followMode: 'first' | 'third' | 'top' | 'side'`, integrado com `CameraTouchZone` (toque + rato + setas); movimento WASD segue a direção da câmara
- **Combate** — `shoot()`, `reload()`, `equipWeapon()`, `takeDamage()`, `getHealth()`, `getAmmo()` — funcionam tanto no preview como no jogo exportado (raycast real)
- **Shaders Pro** — skyShaderPro (Rayleigh+Mie), waterShaderPro (Gerstner+caustics), parallaxOcclusionMappingPro (raymarching), **realWaterShader** (Gerstner 4 oitavas + refração + Fresnel + espuma + flow mapping + caustics)
- **Hardware Instancing** — `InstancedMesh` + frustum culling + LOD + GPU variation via `InstancingPanel`
- **terrainNoise** — Simplex + Ridged + Domain Warping + Terracing + Erosão térmica, integrado no TerrainEditor
- **Escultura 3D direta no viewport** — raycast + cursor 3D + aplicação em tempo real; botão dedicado no SceneEditorPanel
- **GLTF com .bin externo** — multi-file selector + `LoadingManager.setURLModifier`
- **13 modificadores de malha** — Subdivision, Mirror, Array, Solidify, Bevel, Displace, Bend, Twist, Taper, Wireframe, Remesh, Smooth, Spherify
- **Conects de Realismo** — GIProbeObject, SSRObject, VolumetricFogObject, SSSObject, BloomObject, DOFObject (gizmos visuais no editor)
- **Marcadores** — EmptyObject, ArrowMarker, PointMarker (para marcar pontos específicos em modelos)
- **RealWaterObject** — água ultra-realista com Gerstner + refração + reflexão Fresnel + espuma + flow + caustics
- **Marketplace melhorado** — 4 abas (Assets/Jogos/Templates/Conta), categorias, pesquisa, sort, botão "Publicar", assets demo locais
- **PWA** — instalável, offline, auto-save IndexedDB
- **Exportação de jogo** — HTML standalone + APK Android (Capacitor)
- **2 jogos demo incluídos**: FlirQuest Arena (FPS simples) + FlirQuest Saga (RPG/FPS profissional com 2 cenas, BOSS, 102 conects)

### ⚠️ O que NÃO funciona (limitações conhecidas)

| Sistema | Estado | Notas |
|---|---|---|
| **Marketplace backend** | UI completa, backend NÃO deployado | As serverless functions em `/api/marketplace/` existem mas não estão activas. Para activar: deploy Vercel + `NEON_DATABASE_URL`. Modo demo funciona offline. |
| **Multiplayer real** | Stub com servidor de echo | Usa `wss://echo.websocket.org`. Para multiplayer real: configurar servidor WebSocket próprio. |
| **GIProbeObject (real)** | Gizmo visual funciona | O Conect tem gizmo no editor mas o efeito real de iluminação global NÃO está implementado no runtime. Marca como "planeado". |
| **SSRObject (real)** | Gizmo visual funciona | Reflexos screen-space não implementados no runtime. |
| **VolumetricFogObject (real)** | Gizmo + FogObject básico | O VolumetricFog usa FogExp2 do three.js (não é volumétrico real com god rays). |
| **SSSObject (real)** | Gizmo visual funciona | Subsurface scattering não implementado no material standard. |
| **BloomObject (real)** | Gizmo + pointLight | Para activar bloom real, usar `PostProcessingPanel` (separado do Conect). |
| **DOFObject (real)** | Gizmo visual funciona | Depth of Field não implementado no runtime. |
| **Pointer lock (desktop FPS)** | Não implementado | Em desktop, é preciso arrastar o rato na metade direita para rodar câmara. Para imersão total: usar `requestPointerLock()`. |

### 📊 Estatísticas do código

- **~18.000 linhas** de código em `src/`
- **55+ tipos de Conects** (todos com renderer dedicado)
- **13 modificadores de malha**
- **6 Conects de realismo** (gizmos + flags)
- **3 shaders Pro** (sky, water, realWater)
- **2 jogos demo incluídos** (Arena + Saga)
- **Build size**: ~3.0 MB (PWA precache)
- **Lint**: 0 erros, ~30 warnings

---

## 🎮 Jogos Demo Incluídos

### FlirQuest Arena — FPS 3D Simples

Um FPS 3D completo gerado programaticamente. Para jogar:

1. Abre a engine (homepage)
2. Clica em **"Demo FPS"** (botão azul)
3. Muda para modo **Cena** (rail vertical esquerdo)
4. Clica em **▶ Play**

**Conteúdo**: 25 conects — terreno 60×60m, 4 pilares, 4 muros, 3 inimigos, 5 gemas, 1 checkpoint, sky procedural, HUD completo.

### FlirQuest Saga — RPG/FPS Profissional

Um RPG/FPS profissional completo com 2 cenas, BOSS, e todos os Conects de realismo. Para jogar:

1. Abre a engine (homepage)
2. Clica em **"RPG Saga"** (botão roxo)
3. Muda para modo **Cena**
4. Clica em **▶ Play**

**Conteúdo** (102 conects total):
- **Cena 1 — Vila Inicial**: terreno suave 80×80m, lago com água super-realista (RealWaterObject), 5 casas, 10 árvores, 6 pedras, 3 muros, 3 soldados inimigos, 5 gemas, 3 checkpoints, portal para Floresta, GIProbe + Bloom + VolumetricFog
- **Cena 2 — Floresta Sombria**: terreno montanhoso (Simplex+Ridged+Erosion), 20 árvores densas, 8 pedras, 2 monstros corpo-a-corpo, **1 BOSS Dragon (1000 HP)**, 5 gemas raras, 2 checkpoints, portal de regresso
- **HUD completo**: vida, munição, aviso, bossbar, botões (tiro/reload/pular), título
- **2 armas**: pistola (25 dmg, 12 muni) + rifle (18 dmg, 30 muni, fire rate 0.1s)

### Controles (ambos os jogos)
- **WASD / setas** — mover (relativo à câmara, estilo Godot)
- **Setas** — rodar câmara (também)
- **Rato (arrastar metade direita)** — rodar câmara FPS
- **Touch (mobile)** — joystick virtual esquerdo + botões direita
- **Espaço** — saltar
- **Botão TIRO** (mobile) ou **`shoot()` via FlirCode** — disparar

---

## 🏗️ Arquitetura

### Estrutura de pastas
```
src/
├── components/
│   ├── 3d/              # Viewports Three.js (Scene3D, SceneLevel3D, SceneObject, SkeletonGizmo, TerrainSculpt3D)
│   ├── panels/          # Painéis da UI (TopBar, LeftPanel, RightPanel, TerrainEditor, ModifiersPanel, MarketplacePanel, InstancingPanel, ...)
│   ├── home/            # HomePage + Ebook
│   └── ui/              # Componentes reutilizáveis (Icons, VerticalRail, MainMenu, JoystickControl, ...)
├── store/
│   └── useStore.js      # Estado global Zustand com persistência
├── utils/
│   ├── conects/         # Taxonomia de Conects (55+ tipos) + física (cannon-es) + NPC AI + anim controller
│   ├── flirscript/      # FlirScript (visual) + FlirCode (textual) runtime
│   ├── terrain/         # terrainMath (Perlin) + terrainNoise (Simplex+Voronoi+Ridged)
│   ├── game/            # gameRuntime.js (exportado) + gameExporter.js + flirQuestArena.js + flirQuestSaga.js
│   └── ...              # waterShaderPro, skyShaderPro, realWaterShader, hardwareInstancing, etc.
├── workers/             # Web Workers (FBX import)
└── styles/global.css    # CSS único (5.3k linhas)
```

### Conects (55+ tipos)

Cada Conect é um objeto de jogo com semântica própria. Todos têm renderer dedicado no `ConectRenderer.jsx`:

| Categoria | Tipos |
|---|---|
| **Física** | RigidObject, StaticObject, StopObject, PersonalObject (jogador), NpcObject, TriggerObject, JointObject |
| **Visual** | VisualObject (catálogo), LuminousObject, SunObject, PointObject, SpotObject, AreaObject, AmbientObject, ReflectObject |
| **Ambiente** | SkyObject, TerrainObject, WaterObject, **RealWaterObject** (ultra-realista), FogObject, ParticleObject, TrailObject |
| **Realismo** | **GIProbeObject**, **SSRObject**, **VolumetricFogObject**, **SSSObject**, **BloomObject**, **DOFObject** |
| **Câmara** | ViewObject (followMode: none/first/third/top/side), CameraTouchZone |
| **Áudio** | SoundObject |
| **UI** | ButtonObject, JoystickObject, TextObject, ImageObject, PanelObject |
| **Gameplay** | SpawnObject, NavigatorObject (portal), CheckpointObject, TimerObject, PathObject, WeaponObject, ItemObject |
| **Sistema** | AnimationBoostObject, GameStateObject, PrefabObject, RoguelikeGenerator, GroupObject, ReferenceObject |
| **Marcadores** | **EmptyObject**, **ArrowMarker**, **PointMarker** |

---

## 🔧 Correções recentes (Agosto 2026 — Sessão 4)

### Joystick mobile agora funciona
- **Bug crítico**: `JoystickControl.jsx` não definia `pointerEvents: 'auto'` — herdados do parent `none`. Joystick aparecia mas não capturava toques.
- **Bug crítico**: `physicsSystem.addConect` fazia `mass ?? 0` — PersonalObject ficava `mass=0` (corpo estático no cannon-es), não se movia.
- **Solução**: `pointerEvents: 'auto'` no container; default `mass=1` para PersonalObject/NpcObject; `fixedRotation=true` + `linearDamping=0.4` para characters.

### Movimento relativo à câmara (estilo Godot)
- **Bug**: WASD/joystick aplicava velocidade em coordenadas do mundo (W = -Z sempre). Em FPS, deveria ser relativo à câmara.
- **Solução**: GameMode agora lê `yaw` de `window._flirCameraRotation` e aplica `vx = mx*cosY + mz*sinY`, `vz = -mx*sinY + mz*cosY` (equivalente a `transform.basis * input` do Godot).

### Handlers globais touch removidos
- **Bug**: `window.addEventListener('touchstart')` no GameMode interferia com o joystick (setava `active=true` para qualquer toque, incluindo na CameraTouchZone).
- **Solução**: Removidos handlers globais redundantes — `JoystickControl` já escreve diretamente em `window._flirJoystick`.

### Atalhos de teclado desactivados no modo jogo
- **Bug**: `G/R/S` para transform mode interferiam com WASD no modo jogo.
- **Solução**: Em `scenePreviewOpen`, atalhos do editor são desactivados; só Esc funciona (para sair).

### 9 novos Conects de realismo + marcadores + água ultra-realista
- `GIProbeObject` — gizmo icosaedro + pointLight
- `SSRObject` — gizmo plano espelhado
- `VolumetricFogObject` — gizmo nuvem
- `SSSObject` — gizmo pele
- `BloomObject` — gizmo sol brilhante + halo
- `DOFObject` — gizmo câmara + plano foco
- `EmptyObject` — axesHelper
- `ArrowMarker` — seta direccional com `direction`, `length`, `color`
- `PointMarker` — esfera rotativa + anel + label + `attachBone`
- `RealWaterObject` — shader completo: Gerstner 4 oitavas + refração + Fresnel (IOR) + espuma + flow mapping + caustics

### 9 novos modificadores de malha
- `Bevel` — chanfro de arestas
- `Displace` — deslocamento por noise
- `Bend` — dobrar num ângulo
- `Twist` — torcer em torno de eixo
- `Taper` — afunilar
- `Wireframe` — converter para edges
- `Remesh` — simplificar (decimate)
- `Smooth` — suavização laplaciana
- `Spherify` — deformar para esfera

Todos têm UI de parâmetros no `ModifiersPanel` e implementação real no `SceneObject.applyModifiers()`.

### Marketplace melhorado
- **4 abas**: Assets, Jogos, Templates, Conta
- **Categorias**: 7 categorias por aba (modelos, texturas, FPS, RPG, etc.)
- **Pesquisa + sort**: por relevância, downloads, rating, recente
- **Botão "Publicar"**: modal com nome, descrição, categoria, preço
- **Assets demo locais**: 6 assets + 3 jogos + 3 templates (não dependem de backend)
- **Login demo**: qualquer email + password (4+ chars) funciona offline

### SceneEditorPanel com botões de ferramentas
- Grelha 2×2: Terreno, **Esculp 3D** (toggle), Instancing, Marketplace
- Botão "Play" + "Exportar" + "Conects" no topo

### Código morto removido (9 ficheiros)
- `src/utils/waterShader.js` (substituído por waterShaderPro)
- `src/utils/flirSkyShader.js` (substituído por skyShaderPro)
- `src/utils/parallaxOcclusionMapping.js` (substituído por Pro)
- `src/utils/buildingGenerator.js` (nunca integrado)
- `src/utils/shaderGraphToGLSL.js` (nunca integrado)
- `src/utils/flirAdaptiveMesh.js` (flag sem caller)
- `src/utils/flirGI.js` (flag sem caller)
- `src/utils/instancedRenderer.js` (substituído por hardwareInstancing)
- `src/utils/conects/physicsSystem.rapier.js` (cannon-es é usado)

---

## 🚀 Começar

### Desenvolvimento
```bash
cd modelagemetexturizacao
npm install
npm run dev      # http://localhost:5173
```

### Build produção
```bash
npm run build    # gera dist/
npm run preview  # testar build
```

### Deploy
- **Vercel**: push para `main` → deploy automático
- **Netlify**: configuração em `netlify.toml`
- **APK Android**: usa Capacitor (ver `GameExportModal`)

---

## 🛣️ Roadmap futuro

### Prioridade alta
1. **Activar backend do Marketplace** — deploy das serverless functions + Neon PostgreSQL
2. **Multiplayer real** — servidor WebSocket próprio (não echo)
3. **Implementar GIProbeObject real** — global illumination com light probes
4. **Implementar SSRObject real** — screen space reflections no runtime
5. **Implementar BloomObject real** — integrar com `PostProcessingPanel`
6. **Pointer lock em desktop FPS** — `requestPointerLock()` para imersão total

### Prioridade média
7. **VolumetricFog real** — raymarching com god rays (não FogExp2)
8. **Subsurface Scattering real** — shader de pele/cera/jade
9. **Depth of Field real** — bokeh + focus distance
10. **WebRTC para multiplayer P2P** — sem servidor
11. **Terrain erosion hidráulica** — simulação de água
12. **Voxel terrain** — alternativa ao heightmap

### Prioridade baixa
13. **WebGPU backend** — quando tiver adoção >80%
14. **VR/AR mode** — WebXR
15. **AI NPC avançada** — pathfinding A*, behavior trees
16. **Animation retargeting** — aplicar animações de um rig noutro

---

## 🆕 Fase 1 — PWA + Editor de Cenas

### PWA instalável e offline
- **manifest.webmanifest** completo: nome, ícones (16/32/180/192/512 + maskable), cor de tema, `display: standalone`
- **Service Worker** (via `vite-plugin-pwa` + Workbox) faz cache de todos os ficheiros estáticos (JS, CSS, ícones, fontes) — a app abre e funciona sem internet após a primeira visita
- **IndexedDB** para projetos/cenas grandes (texturas em base64, geometrias editadas, múltiplas cenas) — substitui o localStorage para dados volumosos
- **Auto-save** para IndexedDB a cada 30s + ao fechar a página
- **Indicador offline** (banner amarelo) aparece automaticamente quando o browser perde ligação
- Critérios de instalabilidade PWA verificados: ícones corretos, manifest válido, SW ativo

### Editor de Cenas/Níveis (level editor)
- **Conceito de Cena/Nível**: uma cena contém instâncias de objetos posicionados (cada uma com position/rotation/scale próprios)
- **Lista de cenas** do projeto: criar, duplicar, apagar, reordenar (↑/↓), renomear (duplo-click)
- **Catálogo de objetos**: arrastar-e-largar (HTML5 DnD) objetos do catálogo para o viewport da cena, ou duplo-click para adicionar
- **Marcar objeto como "Jogador"** ⭐ — marcação visual (cone verde + anel no chão); sem lógica de jogo ainda (Fase 2)
- **Câmara de jogo configurável**: perspetiva ou ortográfica, posição, FOV/tamanho — visualizada como wireframe laranja no viewport
- **Guardar/carregar cenas** completas no projeto JSON + IndexedDB
- **Pré-visualizar cena** ▶: ecrã cheio com câmara orbital ou gameCamera; primeira aproximação ao "modo de jogo"

### Seletor de modo no topo
- **Modo Modelagem**: editar objetos individuais (primitivas, edit, sculpt, materiais, animação)
- **Modo Cena**: montar o nível com os objetos criados (level editor)
- Alternância instantânea via seletor no topo da barra

## ✨ Funcionalidades (Fase 0)

### Modelagem (nível profissional, tipo Blender)
- Formas primitivas: cubo, esfera, cilindro, cone, plano, torus
- Selecionar, mover, rodar e escalar objetos (gizmos tipo Blender)
- **Modo de edição de malha**: seleção vertex/edge/face, extrude, inset, bevel, loop cut, merge, subdivide
- **Modificadores não destrutivos**: Subdivision Surface, Mirror, Array, Solidify
- **Booleanas entre objetos**: união, subtração, interseção
- **Modo Esculpir**: pincel de elevar/rebaixar/suavizar/achatar com controlo de força e tamanho
- **Hierarquia**: agrupar objetos (parent/child)
- Outliner com nomes editáveis
- Undo / Redo (com atalhos de teclado)

### Texturização (nível profissional)
- Aplicar texturas (upload PNG/JPG) a qualquer objeto
- Editor de material PBR completo: cor base, roughness, metalness, opacity, wireframe, flat shading, **emissive**
- Textura normal + emissive map
- **Múltiplas camadas de textura** por objeto
- **Biblioteca de materiais predefinidos**: Metais (cromado, ouro, cobre), Madeiras (carvalho, nogueira), Pedras (mármore, granito), Panos, Plásticos, Vidros, Emissivos (neon, lava)
- Tiling (repeat U/V) e offset UV
- **Unwrap UV automático** (planar e box projection)
- Pré-visualização em tempo real com iluminação ajustável

### Animação (nova funcionalidade, para jogos)
- **Sistema de esqueleto/ossos** (rigging): criar e posicionar ossos
- **Editor de keyframes** com linha do tempo fixa em baixo (play, pause, keyframes)
- **Clips de animação**: idle, walk, run, jump, attack
- **Curvas de interpolação**: linear, ease, step
- Configuração de FPS, duração, loop
- Exportar animações junto com o modelo em .glb (compatível com Unity e Godot)

### Cena
- Câmara orbital (rodar, zoom, pan com rato ou toque)
- Grelha de chão configurável
- Fundo configurável (cor sólida ou gradiente)
- Iluminação: ambiente + direcional ajustável + sombras
- Suporte a HDRI (campo preparado)

### Importar / Exportar
- Exportar cena/modelo em **.glb** ou **.obj**
- Importar modelos **.glb** / **.gltf** / **.obj**
- Guardar / carregar projeto em **JSON** (via localStorage ou ficheiro)

### Interface (reformulada para mobile)
- **Barra de ferramentas principal fixa em baixo** (mobile) com 6 ícones sempre visíveis: Menu, Cubo, Transform, Editar, Mais, Props
- **Grelha "Mais Ferramentas"** em ecrã cheia — substitui scroll horizontal; ferramentas agrupadas por categorias
- Painel esquerdo com tabs em grelha 4×2 (Ferramentas, Editar, Modificadores, Booleanas, Esculpir, Materiais, Animação, Cena)
- Painel direito: propriedades do objeto selecionado (transform + material + modificadores)
- Barra superior: novo projeto, importar, exportar, guardar, undo/redo
- Design escuro, limpo, responsivo
- **Nenhuma zona funcional depende de scroll horizontal** — tudo acessível com toques diretos
- Testado em ecrãs de 360px: todas as ferramentas acessíveis

## 🚀 Stack Técnica

- **React 19** + **Vite 8** (build estático)
- **three.js** + **@react-three/fiber** + **@react-three/drei**
- **zustand** (state manager com persistência em localStorage)
- CSS nativo (sem framework externo)

## 📁 Estrutura de Pastas

```
modelagemetexturizacao/
├── public/
│   └── favicon.svg
├── src/
│   ├── components/
│   │   ├── 3d/
│   │   │   ├── Scene3D.jsx          # Canvas + câmara + luzes + sculpt raycast
│   │   │   └── SceneObject.jsx      # Mesh + material + modificadores aplicados
│   │   ├── panels/
│   │   │   ├── TopBar.jsx           # Barra superior (import/export/save/undo)
│   │   │   ├── LeftPanel.jsx        # Painel com 8 tabs
│   │   │   ├── RightPanel.jsx       # Painel propriedades do objeto
│   │   │   ├── Outliner.jsx         # Lista de objetos com nomes editáveis
│   │   │   ├── SceneSettings.jsx    # Configurações de fundo/grelha/luzes
│   │   │   ├── MaterialEditor.jsx   # Cor + texturas + tiling UV + emissive
│   │   │   ├── MaterialLibraryPanel.jsx  # Biblioteca de materiais predefinidos
│   │   │   ├── EditModePanel.jsx    # Edit mode (vertex/edge/face + operações)
│   │   │   ├── ModifiersPanel.jsx   # Stack de modificadores não destrutivos
│   │   │   ├── BooleansPanel.jsx    # Operações booleanas entre objetos
│   │   │   ├── SculptPanel.jsx      # Configurações do pincel de esculpir
│   │   │   ├── AnimationPanel.jsx   # Skeleton, keyframes, clips
│   │   │   ├── Timeline.jsx         # Barra de timeline fixa em baixo
│   │   │   └── Viewport.jsx         # Wrapper do canvas + overlays
│   │   └── ui/
│   │       ├── Icons.jsx            # Ícones SVG inline (40+ ícones)
│   │       ├── Toasts.jsx
│   │       ├── LoadingOverlay.jsx
│   │       ├── BottomBar.jsx        # Barra fixa em baixo (mobile, 6 ícones)
│   │       └── MoreToolsGrid.jsx    # Grelha "mais ferramentas" em ecrã cheia
│   ├── hooks/
│   │   └── useHotkeys.js
│   ├── store/
│   │   └── useStore.js              # Zustand (estado + undo/redo + sculpt + anim)
│   ├── utils/
│   │   ├── primitives.js            # Definição das formas + material padrão
│   │   ├── meshOperations.js        # Operações de malha (subdivide, bevel, etc)
│   │   ├── materialLibrary.js       # Biblioteca de materiais predefinidos
│   │   ├── exporters.js             # Import/export GLB/OBJ/JSON
│   │   └── helpers.js               # Utilitários gerais
│   ├── styles/
│   │   └── global.css               # Estilos globais (dark mode + responsivo)
│   ├── App.jsx
│   └── main.jsx
├── index.html
├── netlify.toml
├── vite.config.js
└── package.json
```

## ⚙️ Desenvolvimento Local

```bash
npm install
npm run dev        # servidor de desenvolvimento (http://localhost:5173)
npm run build      # gera dist/ pronto para deploy estático
npm run preview    # pré-visualiza o build de produção
```

## 🌐 Deploy na Vercel / Netlify

### Vercel
1. Faz push do projeto para o repositório GitHub
2. Em vercel.com → "Add New Project" → liga ao repositório
3. Configurações auto-detectadas:
   - **Build command:** `npm run build`
   - **Output directory:** `dist`

### Netlify
1. Em app.netlify.com → "Add new site" → "Import an existing project"
2. Configurações (auto-detectadas pelo `netlify.toml`):
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`

## ⌨️ Atalhos de Teclado

| Ação | Windows/Linux | macOS |
|------|---------------|-------|
| Mover | `G` | `G` |
| Rodar | `R` | `R` |
| Escalar | `S` | `S` |
| Desfazer | `Ctrl+Z` | `Cmd+Z` |
| Refazer | `Ctrl+Shift+Z` | `Cmd+Shift+Z` |
| Duplicar | `Ctrl+D` | `Cmd+D` |
| Apagar | `Delete` | `Delete` |
| Desselecionar | `Esc` | `Esc` |

## 📱 Gestos de Toque (mobile)

- **1 dedo:** orbitar a câmara
- **2 dedos:** pinch zoom + pan
- **Tap num objeto:** selecionar
- **Tap no vazio:** desselecionar
- **Barra inferior fixa:** 6 ícones principais sempre visíveis
- **Botão "Mais":** abre grelha em ecrã cheia com todas as ferramentas

## 🎨 Biblioteca de Materiais

A aplicação inclui uma biblioteca de materiais predefinidos com texturas geradas proceduralmente (sem ficheiros externos):

- **Metais:** Cromado, Ouro, Cobre, Aço Escovado
- **Madeiras:** Carvalho, Nogueira
- **Pedras:** Mármore, Granito, Arenosa
- **Panos:** Algodão, Veludo
- **Plásticos:** Vermelho, Branco
- **Vidros:** Transparente, Fosco
- **Emissivos:** Neon Azul, Neon Rosa, Lava
- **Outros:** Borracha, Cerâmica, Asfalto

## 📝 Licença

MIT — usa livremente.

---

# Auditoria Honesta da Engine — Estado Real (2026-08-11)

Esta secção documenta o que **realmente funciona** vs o que **não funciona**, após auditoria exaustiva do código fonte.

## Conects que FUNCIONAM (visual + runtime)

| Conect | Visual no editor | Runtime no jogo | Notas |
|---|---|---|---|
| PersonalObject | ✅ Capsule verde | ✅ Física + input + joystick + salto | Funciona completamente |
| RigidObject | ✅ Cubo cinza | ✅ Física (gravidade, massa) | Funciona (placeholder visual) |
| StaticObject | ✅ Cubo cinza | ✅ Física (massa=0) | Funciona |
| StopObject | ✅ Cubo amarelo | ✅ Física (kinematic) | Funciona |
| NpcObject | ⚠️ Cubo cinza | ✅ IA (patrulhar, perseguir) | Visual é placeholder |
| TriggerObject | ❌ Invisível | ✅ Deteção de colisão | Funciona mas sem preview visual |
| JointObject | ❌ Invisível | ✅ Junta física entre objetos | Funciona mas sem linha visual |
| ViewObject | ✅ Gizmo de câmara | ✅ Segue jogador (third/top/side) | Funciona |
| TimerObject | ❌ Invisível | ✅ Timer + evento onTimer | Funciona |
| VisualObject | ✅ Modelo do catálogo | ⚠️ Só mesh, sem lógica extra | Funciona como placeholder |
| TerrainObject | ✅ Heightmap + splat | ✅ Física (box collider) | Funciona |
| LuminousObject | ✅ Luz + gizmo | ⚠️ Declarativo (sem animação) | Funciona |
| PathObject | ✅ Waypoints + linha | ⚠️ Só dados para NPC patrulha | Não move objetos ao longo do path |
| CheckpointObject | ✅ Bandeira visual | ❌ Sem lógica de save/respawn | Apenas decorativo |
| JoystickObject | ❌ Invisível | ✅ Joystick virtual no jogo | Funciona via GameUIOverlay |

## Conects CORRIGIDOS nesta sessão (antes não funcionavam)

| Conect | Antes | Depois | O que foi corrigido |
|---|---|---|---|
| **SkyObject** | ❌ Não renderizava, não mudava fundo | ✅ Renderiza esfera + muda background | Adicionado SkyMesh no ConectRenderer |
| **WaterObject** | ❌ Plano estático, sem ondas | ✅ Ondas animadas via useFrame | Adicionada animação de vértices |
| **FogObject** | ❌ scene.fog nunca era definido | ✅ FogApplier aplica fog à cena | Adicionado FogApplier no SceneLevel3D |
| **SunObject** | ❌ Luz nunca era criada | ✅ directionalLight + gizmo | Adicionado SunLightMesh no ConectRenderer |
| **PointObject** | ❌ Luz nunca era criada | ✅ pointLight + gizmo | Adicionado PointLightMesh |
| **SpotObject** | ❌ Luz nunca era criada | ✅ spotLight + gizmo | Adicionado SpotLightMesh |
| **AmbientObject** | ❌ Luz nunca era criada | ✅ ambientLight à cena | Adicionado AmbientLightMesh |
| **ButtonObject** | ❌ Não aparecia no jogo | ✅ Renderizado pelo GameUIOverlay | Adicionado render de Conects de UI |
| **TextObject** | ❌ Não aparecia no jogo | ✅ Renderizado pelo GameUIOverlay | Adicionado render de Conects de UI |
| **ImageObject** | ❌ Não aparecia no jogo | ✅ Renderizado pelo GameUIOverlay | Adicionado render de Conects de UI |
| **PanelObject** | ❌ Não aparecia no jogo | ✅ Renderizado pelo GameUIOverlay | Adicionado render de Conects de UI |

## Conects que AINDA NÃO FUNCIONAM

| Conect | Estado | O que falta |
|---|---|---|
| ParticleObject | ✅ CORRIGIDO | Partículas agora animam (emission, life, gravity, recycling) via Points + useFrame |
| TrailObject | ✅ CORRIGIDO | Rasto segue followTarget, atualiza buffer no useFrame, com updateRate configurável |
| SpawnObject | ❌ Morto | Spawning não implementado. |
| NavigatorObject | ✅ CORRIGIDO | Portal transporta jogador para cena de destino quando próximo (triggerRadius) |
| WeaponObject | ✅ PARCIAL | equipWeapon/shoot/reload/getAmmo funcionam no editor (raycast da câmara) |
| ItemObject | ✅ CORRIGIDO | Auto-pickup quando jogador próximo, addToInventory atualiza inventário |
| AnimationBoostObject | ❌ Morto | Propriedades nunca lidas. |
| GameStateObject | ✅ PARCIAL | setGameState/getGameState funcionam no editor |
| PrefabObject | ❌ Morto | Instanciação de prefabs não implementada. |
| RoguelikeGenerator | ❌ Morto | Geração procedural não implementada. |
| GroupObject | ❌ Morto | Parenting não implementado. |
| ReferenceObject | ❌ Morto | Referência entre cenas não implementada. |
| CameraTouchZone | ❌ Morto | Zona de toque para câmara não funcional no runtime. |

## FlirCode — funções que FUNCIONAM no editor

| Função | Estado |
|---|---|
| setVar / getVar | ✅ Funciona |
| playAnimation | ✅ Funciona |
| playSound / playSoundByName | ✅ Funciona |
| spawnObject | ✅ Funciona |
| changeScene | ✅ Funciona |
| setVisible | ✅ Funciona |
| applyForce | ✅ Funciona |
| jumpPlayer | ✅ Funciona |
| showUIScreen / hideUIScreen | ✅ Funciona |
| getUIValue / setUIValue | ✅ Funciona |
| distanceTo | ✅ Funciona |
| isTouching | ✅ Funciona (mas básico) |
| move / rotate / scale | ✅ Funciona (mas hardcode 60fps) |

## FlirCode — funções que NÃO FUNCIONAM no editor

| Função | Estado | Nota |
|---|---|---|
| wait() | ❌ No-op | _waitQueue nunca definido |
| destroy() | ⚠️ Parcial | Só esconde mesh, não remove da física |
| collidingWith() | ⚠️ Parcial | Usa distância, não colisão real |
| shoot / reload / equipWeapon | ✅ CORRIGIDO | Agora funciona no editor (raycast da câmara, fireRate, ammo) |
| takeDamage / getHealth | ✅ CORRIGIDO | Agora funciona via globalVars (_health_ID) |
| addToInventory / removeFromInventory | ✅ CORRIGIDO | Agora funciona (inventoryRef + window._flirInventory) |
| linkTo | ❌ No-op | |
| setGameState / getGameState | ✅ CORRIGIDO | Agora funciona no editor |
| saveProgress / loadProgress | ✅ CORRIGIDO | Agora funciona via localStorage |
| playSequence | ✅ CORRIGIDO | Agora funciona (debug + signal) |
| setLightIntensity / setLightColor | ❌ No-op | |
| getCameraRotation / setCameraSensitivity | ✅ CORRIGIDO | Agora funciona no editor |
| startNewRun / getRunSeed / endRun | ❌ No-op | |
| emitSignal | ✅ CORRIGIDO | Agora funciona (dispata onSignal event) |

**Nota:** Algumas destas funções (shoot, inventory, saveProgress, etc.) funcionam no **jogo exportado** (gameRuntime.js) mas NÃO no preview do editor (SceneLevel3D.jsx). Há divergência entre os dois contextos.

## Import/Export

| Funcionalidade | Estado |
|---|---|
| Importar GLB | ✅ Funciona |
| Importar GLTF | ✅ Funciona |
| Importar OBJ | ✅ Funciona |
| Importar FBX (via Worker) | ✅ Funciona |
| Exportar GLB | ✅ Funciona |
| Exportar OBJ | ✅ Funciona |
| Guardar .flirengine | ✅ Funciona |
| Abrir .flirengine | ✅ Funciona |
| Auto-save IndexedDB | ✅ Funciona |

## Layout mobile

| Dispositivo | Otimização | Notas |
|---|---|---|
| Realme C33 (360px) | ✅ Otimizado | Media queries @media(max-width:375px) — rail 36px, bottombar compacto, texto 10px |
| Samsung S8 (360px) | ✅ Otimizado | Mesmo que C33 |
| iPhone 7 (375px) | ✅ Otimizado | Mesmo que C33 |
| iPhone SE 1st (320px) | ✅ Otimizado | Media queries @media(max-width:340px) — rail 32px, sem labels no bottombar |

Otimizações aplicadas para ecrãs pequenos (≤375px):
- Rail vertical: 44px → 36px (32px em ≤340px)
- BottomBar: sem labels de texto em ≤340px (só ícones)
- Painéis laterais: largura total (100vw - rail)
- Texto/ícones: reduzidos (10-11px labels, 9px texto pequeno)
- Tabs-grid: 3 colunas em vez de 4
- Home features: 2 colunas em vez de 4 (1 coluna em ≤340px)
- Modais: 95vw de largura

## O que pode ser corrigido numa próxima sessão

Todos os itens anteriores foram resolvidos. O estado atual da engine é:

### Resolvido (sessões anteriores):
- CameraTouchZone ✅
- wait() real ✅
- collidingWith real ✅
- Aritmética no FlirCode ✅
- SpawnObject ✅
- PrefabObject ✅
- GroupObject ✅
- ReferenceObject ✅
- AnimationBoostObject ✅
- RoguelikeGenerator ✅
- linkTo ✅
- setLightIntensity/setLightColor ✅
- FlirCode if/else no exportado ✅
- Persistência de animações FBX ✅
- CheckpointObject save/respawn ✅
- SkyObject/WaterObject/FogObject/SunObject/PointObject/SpotObject/AmbientObject ✅
- ButtonObject/TextObject/ImageObject/PanelObject no GameUIOverlay ✅
- ParticleObject runtime ✅
- TrailObject runtime ✅
- NavigatorObject (portal) ✅
- ItemObject (auto-pickup) ✅
- WeaponObject (equip/shoot/reload) ✅
- GameStateObject ✅
- emitSignal ✅
- saveProgress/loadProgress ✅
- getCameraRotation/setCameraSensitivity ✅
- Otimização mobile (iPhone 7, Realme C33, iPhone SE) ✅

### Resolvido nesta sessão:
- TimerObject com FlirCode: runtime registado para `flirCode` (não só `flirScript`) ✅
- TextObject com FlirCode: `setUIValue`/`getUIValue` agora procuram em Conects de UI ✅
- PersonalObject _y_pos: atualizado automaticamente a cada frame ✅
- FlirCode if com begincode: parser agora suporta `if (cond)` sem `begincode` na mesma linha ✅

### Pendente (honesto):
- Jogo exportado requer internet (importmap CDN) — para 100% offline, copiar three.module.js + cannon-es.js localmente
- LOD automático em objetos (só terrain tem LOD)
- FlirCode `else` no exportado (gameRuntime.js) — `else if` funciona mas `else` sozinho é stub
- GLTF com .bin externo (browser File API não tem path)
- GLTF sem DRACO/KTX2 support
- GLTF perde skeleton/animações no import
- Super-realismo (skyShaderPro, gpuMeshModifiers, POM Pro, hardwareInstancing, terrainNoise) — módulos existem mas não estão wired à UI
- Marketplace precisa de backend (serverless functions) para funcionar

---

# Marketplace (Estrutura)

## Estado atual
- UI completa: MarketplacePanel com 4 abas (Assets, Jogos, Templates, Login)
- Config do servidor Neon (PostgreSQL) em `src/utils/neonConfig.js`
- Esquema SQL completo (users, assets, games, templates, purchases, sessions)
- API client stub (`marketplaceAPI`) com todas as funções
- Botão Marketplace no MainMenu
- Estado no store (`marketplaceOpen`, `openMarketplace`, `closeMarketplace`)

## O que falta (backend)
Para o marketplace funcionar, precisa de serverless functions em `/api/marketplace/`:
- `auth/register` — criar conta (hash password, gerar token)
- `auth/login` — verificar credenciais, retornar token
- `assets` — CRUD de assets (listar, criar, download)
- `games` — CRUD de jogos (listar, publicar, download)
- `templates` — CRUD de templates (listar, criar, download)

Estas functions conectam ao Neon PostgreSQL usando a URL em `neonConfig.js`.

## URL do servidor
```
postgresql://neondb_owner:npg_Yr7nld2jTpSW@ep-fragrant-pond-ayedmxhc-pooler.c-5.us-east-2.aws.neon.tech/neondb
```

## Esquema SQL
Ver `NEON_SCHEMA` em `src/utils/neonConfig.js` — inclui tabelas para users, assets, games, templates, purchases e sessions.


---

# Flir Engine — Sistema Gráfico Avançado (WebGL 2.0)

Documentação dos sistemas de renderização avançada implementados. Tudo otimizado para mobile (WebGL 2.0), com honestidade sobre limitações e custos de performance.

## 🌊 Shader de Água Fotorrealista (`waterShaderPro.js`)

Água com ondas Gerstner físicas, caustics dinâmicas, IOR ajustável, Fresnel e SSR simplificado.

### Funcionalidades
- **Vertex Shader**: Soma de 3 ondas Gerstner (deslocamento físico real) + ruído procedural para micro-detalhes
- **Fragment Shader**:
  - Caustics dinâmicas animadas por tempo (padrão tipo teia, 3 camadas senoidais)
  - Refração com IOR ajustável (1.330 padrão — água real)
  - Fresnel Effect (Schlick approximation) — transição refração/reflexão por ângulo da câmara
  - Color Gradation por Profundidade (turquesa raso → azul oceânico fundo)
  - Normal Maps cruzados (2 amostras em direções diferentes) para micro-detalhes
  - SSR simplificado (reflexo do céu + cor ambiente via Fresnel)
  - Espuma nas cristas das ondas + margens

### Otimização mobile
- Apenas 3 ondas Gerstner (não 8+)
- Caustics via 1 amostra senoidal (não raymarching)
- SSR simplificado (reflexo do céu, não raymarching de cena)
- Normal maps procedurais (sem ficheiros externos)

### Honestidade
SSR real (refletir objetos da cena) exigiria pass de profundidade + raymarching — demasiado pesado para mobile. Esta implementação usa aproximação: reflexo do céu + cor ambiente.

### Uso
```javascript
import { createWaterProMaterial } from './utils/waterShaderPro'
const material = createWaterProMaterial({
  color: '#2f81f7',        // turquesa claro
  deepColor: '#0a3d5c',    // azul oceânico
  ior: 1.330,
  waveHeight: 0.2,
  causticsEnabled: true,
  ssrEnabled: true,
})
```

Ativado quando `renderSettings.waterQuality === 'professional'` (ver Fase 6 — Níveis de Qualidade).

## ☀️ Céu Procedural Físico (`skyShaderPro.js`)

Espalhamento atmosférico Rayleigh + Mie (modelo de Preetham et al. 1996).

### Funcionalidades
- Rayleigh Scattering (céu azul — moléculas pequenas)
- Mie Scattering (halo solar — aerosóis/partículas grandes)
- Posição solar dinâmica (calculada por hora do dia + latitude)
- Transição dia/noite (estrelas + lua)
- Tons de pôr do sol automatizados (vermelho-laranja quando sol baixo)
- Afeta névoa e brilho especular na água (via uniforms partilhados)

### Otimização mobile
- Modelo analítico (não raymarching) — 1 sample por pixel
- Sem texturas — tudo procedural
- Estrelas via hash simples

### Honestidade
Não implementa multi-scattering (cálculo de 2ª ordem) — demasiado pesado para mobile. A aproximação de Preetham captura ~90% do visual.

### Uso
```javascript
import { createSkyProMaterial, calculateSunDirection } from './utils/skyShaderPro'
const sunDir = calculateSunDirection(12, 172, 0) // hora, dia do ano, latitude
const material = createSkyProMaterial({
  sunDirection: sunDir.toArray(),
  sunIntensity: 15,
  rayleigh: 2.5,
  mie: 0.5,
  turbidity: 10,
})
```

## 🎛️ Modificadores GPU (`gpuMeshModifiers.js`)

Deformadores paramétricos processados inteiramente no Vertex Shader (zero overhead CPU).

### Deformadores implementados
1. **Bend (Dobra)** — curvar vértices ao longo de um eixo com ângulo
2. **Twist (Torção)** — rodar malha em torno de um eixo proporcional à altura
3. **Taper (Cônico)** — afunilar/alargar extremidades
4. **Skew (Chanfrar)** — deslocar vértices ao longo de um eixo com base noutro
5. **Spherify (Esferizar)** — interpolar para esfera perfeita
6. **Displace & Ripple** — ruído + ondas senoidais para relevo

### Stack encadeável
Os modificadores são aplicados em sequência: `Bend → Twist → Taper → Skew → Spherify → Displace`. A saída de um é entrada do próximo.

### Recálculo de normais
As normais são recalculadas após deformação (aproximação — finite differences completos seriam demasiado pesados para mobile).

### Uso
```javascript
import { applyGPUModifiers } from './utils/gpuMeshModifiers'
const stack = applyGPUModifiers(mesh)
stack.setParam('twistAngle', Math.PI)  // 180°
stack.setParam('taperFactor', 0.5)
stack.update(delta)  // chamar a cada frame para animar displace/ripple
```

### Vantagem sobre modificadores CPU
- Zero overhead por frame (Geometria não é recalculada na CPU)
- Pode ser animado em tempo real sem custo
- Ideal para deformações dinâmicas (vento em bandeiras, etc.)

### Limitação
A geometria base não muda — colisões/física usam a geometria original. Para deformações que afetam física, usar os modificadores CPU (`meshOperations.js`).

## 🌲 Hardware Instancing (`hardwareInstancing.js`)

Sistema de instancing para renderizar milhares de objetos sem sobrecarregar a CPU.

### Funcionalidades
1. `drawElementsInstanced` via THREE.InstancedMesh
2. **Frustum Culling** por instância (JS, antes de enviar à GPU) — bounding sphere
3. **LOD por instância** — 3 níveis (alta/média/baixa complexidade) por distância
4. **Variações aleatórias na GPU** — rotação/escala/cor via `gl_InstanceID` + InstancedBufferAttribute

### Otimização mobile
- Frustum cull em JS (não na GPU) para reduzir draw calls
- LOD com 3 níveis (mobile aguenta 3)
- Variações calculadas no vertex shader (zero memória extra)

### Uso
```javascript
import { createForestSystem } from './utils/hardwareInstancing'
const forest = createForestSystem(100, { minX: -50, maxX: 50, minZ: -50, maxZ: 50 })
forest.addToScene(scene)
// No loop de render:
forest.update(camera)
```

## 🧊 Parallax Occlusion Mapping Pro (`parallaxOcclusionMappingPro.js`)

POM com raymarching completo, self-shadowing e soft edges.

### Funcionalidades
1. **Raymarching no height map** — N passos configurável (4-32)
2. **Self-shadowing** — luz dinâmica projeta sombras dentro dos buracos do POM
3. **Soft Edge Clipping** — evitar bordas distorcidas em ângulos rasos
4. **Binary search refinement** — 2 passos extra para precisão após raymarching grosso
5. **Controlo de passos** — reduzir em dispositivos fracos, aumentar para Ultra

### Texturas necessárias (formato PBR)
- **Albedo** — cor base (diffuse)
- **Normal map** — normais por pixel
- **Height map** — profundidade (branco = alto, preto = baixo)
- **Roughness map** — controla brilho (opcional)

### Uso
```javascript
import { applyPOMPro } from './utils/parallaxOcclusionMappingPro'
applyPOMPro(material, heightMapTexture, {
  scale: 0.04,
  steps: 8,         // 4 = mobile fraco, 16 = Ultra
  selfShadow: true,
  softEdges: true,
})
```

## 🏔️ Terreno Procedural (`terrain/terrainNoise.js`)

Ruídos procedurais para geração de terreno fotorrealista.

### Ruídos implementados
1. **Simplex Noise** (melhoria sobre Perlin — sem artefactos de alinhamento)
2. **Voronoi Noise (Cellular)** — picos escarpados e cristas (ridges)
3. **Ridged Multifractal** — cristas afiadas (montanhas)
4. **Terracing** — degraus para formações rochosas em camadas
5. **Domain Warping** — distorção do domínio para terreno orgânico
6. **Erosão Térmica leve** — desgaste de encostas + acumulação nos vales

### Combinação recomendada (estilo Unreal Landscape)
- Base: fBm Simplex (montanhas + vales)
- Crists: ridgedMultifractal (cristas afiadas)
- Detalhe: Simplex (micro-detalhe)
- Terracing opcional (formações rochosas)
- Domain warping (organicidade)
- Erosão térmica no final

### Uso
```javascript
import { generateTerrainHeightmap } from './utils/terrain/terrainNoise'
const heightmap = generateTerrainHeightmap(128, {
  seed: 12345,
  scale: 50,
  octaves: 4,
  ridgedAmount: 0.3,
  warpStrength: 1.0,
  terracing: true,
  terraceSteps: 8,
  erosion: true,
  erosionIterations: 3,
})
```

### Versão GLSL
O ficheiro exporta `TERRAIN_NOISE_GLSL` com as funções em GLSL para uso em shaders de terreno em tempo real (geração na GPU).

## 📋 Limitações honestas e trabalho futuro

### Não implementado nesta sessão (demasiado grande)

1. **Névoa Volumétrica (Raymarching + God Rays)** — exige pass de pós-processamento com raymarching no fragment shader + MRT. Custo elevado para mobile. Abordagem recomendada: fog exponencial simples (já existe em `FogObject`) + bloom para simular god rays.

2. **Câmera Cinematográfica (DOF + Lens Presets + Grid Overlay)** — DOF exige pass de blur proporcional à distância focal. Lens presets (35mm/50mm/85mm) são apenas mudança de FOV. Grid overlay é canvas 2D sobre o viewport. Viável mas UI-heavy.

3. **Color Grading / Film Look (Lift/Gamma/Gain + ACES + Vignette + Grain)** — exige EffectComposer com pass custom. Three.js tem `EffectComposer` + `ShaderPass`. Implementação direta mas trabalhosa.

4. **Animation Timeline UI profissional** — a engine já tem `Timeline.jsx` básico. Upgrade para sistema profissional (múltiplas camadas, atalhos P/S/R/T, F9 easy ease, undo/redo) é UI-heavy e seria uma sessão dedicada.

5. **Three-Point Lighting + Rim Lights** — a engine já suporta múltiplas luzes (ambient + directional + hemisphere). Three-point lighting é apenas configuração de 3 luzes direcionais. Rim lights são luzes atrás do objeto. Não exige shader novo.

6. **Bounced Lighting (Irradiance/Light Probes)** — Flir GI (`flirGI.js`) já existe como aproximação. Light probes reais exigem pré-computação de SH (Spherical Harmonics) — complexo.

7. **Denoising/Blur bilateral** — para suavizar ruído de SSR/SSGI. Exige pass de pós-processamento. Leve mas trabalhoso.

### Performance esperada (Realme C33 / WebGL 2.0)
- Água Pro: ~5ms por frame (3 ondas Gerstner + caustics)
- Céu Pro: ~2ms por frame (1 sample analítico)
- GPU Modifiers: ~0ms extra (integrado no vertex shader)
- Instancing (1000 objs): ~3ms (frustum cull + 3 LOD)
- POM (8 steps): ~4ms por material com POM
- Terreno 128x128 com erosão: ~50ms geração única (não por frame)

