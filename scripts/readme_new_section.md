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

