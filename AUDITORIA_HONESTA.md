# Auditoria Honesta — Sistema de Import/Export + Estado da Engine

## Data: 2026-08-11

## 1. Sistema de Importação — Estado Real

### GLB — ✅ FUNCIONA
- `importGLB()` em `exporters.js` usa `GLTFLoader.parse(arrayBuffer, '')` corretamente
- Extrai meshes, materiais, geometria
- Funciona para GLB binário com geometria embedada

### GLTF — ⚠️ PARCIAL
- `importGLTF()` funciona para glTF embedado (JSON com geometria inline)
- **Falha silenciosamente** para glTF com `.bin` externo ou texturas externas
- Causa: `file.path` é undefined em browsers (File API não tem path)

### OBJ — ✅ FUNCIONA
- `importOBJ()` usa `OBJLoader.parse(text)` corretamente
- Aplica material padrão (cinza) porque OBJ não traz materiais PBR

### FBX — ⚠️ PARCIAL (bugs corrigidos nesta sessão)
- Worker (`fbxImportWorker.js`) funciona para FBX com geometria + esqueleto + animações position/rotation/quaternion
- **Bug corrigido**: Uint16/Uint32 index detection (antes corrompia meshes >65535 verts)
- **Ainda quebra** em:
  - FBX com morph targets (blend shapes) — track type 'unknown' mal processado
  - FBX com texturas embedadas que tentam criar `Image` no worker (ReferenceError)
  - Persistência de animações: `THREE.AnimationClip` não sobrevive a `JSON.stringify` (perde protótipo)

## 2. Sistema de Exportação — Estado Real

### Exportar GLB — ✅ FUNCIONA
- `exportSceneAsGLB()` usa `GLTFExporter.parse(scene, ..., { binary: true })`

### Exportar OBJ — ✅ FUNCIONA
- `exportSceneAsOBJ()` usa `OBJExporter.parse(scene)`

### Exportar Jogo (HTML standalone) — ⚠️ CORRIGIDO nesta sessão
- **Bug corrigido**: `data.scene.background` → `scene.background` (crash no boot)
- **Bug corrigido**: CDN scripts → importmap com módulos ES
- **Ainda limitado**: requer internet para carregar three.js + cannon-es via CDN (importmap)
- **Para ser 100% offline**: seria preciso embutir three.js (~600KB minified) inline no HTML

## 3. Modificadores — Avaliação

### Modificadores CPU (meshOperations.js) — ✅ Funcionam
- subdivision, mirror, array, solidify, curve deform
- 9 novos: elevation, displace, taper, twist, bend, smooth, decimate, linePath, contactIllum

### Modificadores GPU (gpuMeshModifiers.js) — ✅ Funcionam
- Bend, Twist, Taper, Skew, Spherify, Displace/Ripple via vertex shader

### Proposta: Conect "Deform Target" (seta direcional)
- **Não implementado** — seria um Conect que funciona como gizmo de deformação
- O objeto filho do Conect seria deformado na direção da seta
- Conceito interessante (estilo Maya Deformers), mas requer:
  1. Novo Conect type no taxonomy
  2. Gizmo 3D de seta arrastável no viewport
  3. Sistema de parent-child para aplicar deformação direcional
  4. UI para configurar tipo de deformação (bend, twist, etc.)
- **Estimativa**: 2-3 sessões para implementar corretamente

## 4. Comparação com Engines Profissionais

### Unreal Engine 5
- Layout: dockable panels, content browser, details panel, viewport
- **O que falta**: dockable panels (nós usamos drawers fixos), content browser organizado por pastas
- **O que temos**: rail vertical, painéis colapsáveis, outliner com pesquisa

### Unity
- Layout: hierarchy + inspector + project + scene
- **O que falta**: inspector com prefabs aninhados, material editor visual
- **O que temos**: ConectPropertiesPanel com CollapseSection, MaterialEditor

### Godot
- Layout: scene tree + inspector + filesystem
- **O que falta**: sistema de sinais visual, editor de scripts integrado
- **O que temos**: FlirCode (próprio), FlirScript (nós visuais)

### ItsMagic 2.0
- Layout: mobile-first, touch-optimized
- **O que falta**: gestures avançados (pinch-to-zoom no viewport), radial menus
- **O que temos**: rail vertical otimizado para touch, bottombar, media queries para ecrãs pequenos

## 5. Tentativa de Criar Jogo Complexo — Bloqueios Encontrados

### Cenário: Plataforma 3D simples
1. Criar terreno ✅
2. Adicionar PersonalObject ✅
3. Adicionar platformas (StaticObject) ✅
4. Adicionar JoystickObject ✅
5. Adicionar ViewObject com followMode='third' ✅
6. Adicionar CheckpointObject ⚠️ (visual funciona, save/respawn não)
7. Adicionar ItemObject ✅ (auto-pickup funciona)
8. Adicionar SkyObject ✅ (funciona)
9. Adicionar FogObject ✅ (funciona)
10. Adicionar TimerObject ✅ (funciona)
11. Script FlirCode: onCollide → changeScene ⚠️ (collidingWith funciona mas limitado)

### Cenário: Battle Royale / FPS
1. CameraTouchZone ✅ (funciona)
2. WeaponObject ✅ (equipWeapon/shoot funcionam)
3. Inventory ✅ (addToInventory funciona)
4. Multiplayer ⚠️ (básico, sem lag compensation)
5. Mapa grande com Loot ⚠️ (SpawnObject funciona mas sem gestão de vida de objetos)

### Bloqueios reais identificados:
1. **FlirCode `if` blocks** — no jogo exportado (gameRuntime.js), `if` é no-op. Só funciona no editor.
2. **Persistência de animações** — FBX com animações perde-as ao recarregar (JSON.stringify)
3. **Jogo exportado requer internet** — importmap carrega three.js de CDN
4. **Sem sistema de save/respawn** — CheckpointObject é decorativo
5. **Sem LOD automático** — objetos distantes não reduzem geometria (exceto terrain)

## 6. Ferramentas e Funções Recomendadas

### Para próxima sessão:
1. **Bundling do three.js no HTML exportado** — usar esbuild para bundlar three+cannon num único ficheiro JS
2. **Sistema de save/respawn** — CheckpointObject com localStorage
3. **FlirCode `if` no gameRuntime.js** — copiar o parser do flircode.js
4. **Persistência de animações** — serializar AnimationClip para JSON plain

### Para médio prazo:
5. **Sistema de prefabs visuais** — arrastar Conects do catálogo para criar prefab reutilizável
6. **LOD automático** — DecimateGeometry em objetos distantes
7. **Sistema de partículas avançado** — GPU particles com trails
8. **Editor de materiais PBR visual** — node graph como Unreal Material Editor

### Para longo prazo:
9. **Multiplayer com WebRTC** — sem servidor, peer-to-peer
10. **Sistema de terrains com streaming** — tiles carregados/descarregados
11. **Animation retargeting** — aplicar animações de um rig noutro
12. **Visual scripting completo** — FlirScript com nós de flow control

## 7. Resumo Honest

### O que FUNCIONA bem:
- Editor 3D completo (modelagem, textura, animação, rigging)
- Layout mobile otimizado (iPhone 7, Realme C33, iPhone SE)
- Sistema de Conects (42 tipos, todos com alguma funcionalidade)
- FlirCode no editor (aritmética, wait, if/else, funções)
- Importação GLB/OBJ (funciona)
- Exportação GLB/OBJ (funciona)
- Ícones SVG premium (sem emojis)
- CollapseSection nos painéis de propriedades
- Timeline com faixas coloridas
- SkeletonGizmo sobreposto ao modelo

### O que FUNCIONA parcialmente:
- Importação FBX (geometria + esqueleto sim, morph targets não, persistência de animações não)
- Exportação de jogo HTML (funciona mas requer internet para three.js)
- FlirCode no jogo exportado (parser simplificado, `if` blocks não funcionam)

### O que NÃO funciona:
- CheckpointObject save/respawn
- LOD automático em objetos (só terrain)
- Multiplayer com lag compensation
- Deform Target (seta direcional — não implementado)
- Prefabs visuais arrastáveis
