# Flir Engine — Documentação Completa

> Engine de jogos 3D mobile no navegador — funciona offline (PWA), sem instalar nada.
>
> Esta documentação cobre **tudo o que existe na engine** (commit mais recente), escrita para dois públicos: utilizadores humanos (que podem não saber programar) e IAs/assistentes (que precisam de contexto preciso).

## Índice

1. [Visão Geral](#1-visão-geral)
2. [Aba Modelagem](#2-aba-modelagem)
3. [Aba Cena](#3-aba-cena)
4. [Aba Construtores](#4-aba-construtores)
5. [Aba UI](#5-aba-ui)
6. [Conects — Lista Completa](#6-conects--lista-completa)
7. [FlirCode — Linguagem de Script](#7-flircode--linguagem-de-script)
8. [Ambientes (Sky, Water, Fog, Luzes)](#8-ambientes-sky-water-fog-luzes)
9. [Física e Colisões](#9-física-e-colisões)
10. [Sistemas de Jogo (Armas, Inventário, GameState)](#10-sistemas-de-jogo-armas-inventário-gamestate)
11. [Animação (Keyframes, Blending, Controlador)](#11-animação-keyframes-blending-controlador)
12. [Organização (Camadas, Grupos, Hierarquia)](#12-organização-camadas-grupos-hierarquia)
13. [Configurações e Renderização](#13-configurações-e-renderização)
14. [Exportação e Persistência](#14-exportação-e-persistência)
15. [Modo Story (Gravação + Replay)](#15-modo-story-gravação--replay)
16. [Limitações Conhecidas](#16-limitações-conhecidas)

---

## 1. Visão Geral

A **Flir Engine** é uma engine de jogos 3D que corre inteiramente no navegador. Não precisa de instalação — funciona como PWA (Progressive Web App), permitindo uso offline após o primeiro carregamento.

### Abas Principais

| Aba | Função |
|---|---|
| **Modelagem** | Criar e editar objetos 3D (primitivas, esculpir, rigging, materiais, modificadores) |
| **Cena** | Montar níveis com objetos do catálogo e Conects (física, IA, luzes, etc.) |
| **Construtores** | Gerar edifícios e veículos proceduralmente com parâmetros simples |
| **UI** | Criar interfaces de jogo (botões, textos, imagens, formulários) |

### Fluxo de Trabalho Típico

1. Na aba **Modelagem**, cria-se objetos (cubos, esferas, modelos esculpidos, etc.)
2. Na aba **Cena**, criam-se níveis e adicionam-se objetos do catálogo + Conects
3. Na aba **Construtores**, podem-se gerar edifícios/veículos automaticamente
4. Na aba **UI**, criam-se interfaces (menus, HUDs)
5. Em **Cena**, clica-se em "▶ Executar Jogo" para testar

### Tecnologias

- **React + Vite** — UI e build
- **Three.js (r0.185)** — renderização 3D
- **@react-three/fiber + @react-three/drei** — bridge React ↔ Three.js
- **cannon-es** — física
- **Zustand** — state manager (com persistência via localStorage)

---

## 2. Aba Modelagem

A aba Modelagem permite criar e editar objetos 3D individuais. Cada objeto criado fica no "catálogo" e pode depois ser usado em cenas.

### 2.1 Primitivas

6 tipos disponíveis:

| Tipo | Argumentos |
|---|---|
| Cubo | `size` (tamanho) |
| Esfera | `radius`, `segments` |
| Cilindro | `radius`, `height`, `segments` |
| Cone | `radius`, `height`, `segments` |
| Plano | `width`, `height` |
| Torus | `radius`, `tube`, `radialSegments`, `tubularSegments` |

### 2.2 Ferramentas (tabs do painel esquerdo)

| Tab | Função |
|---|---|
| **Ferramentas** | Seleção de objetos, mover/rodar/escalar, agrupar (parent) |
| **Editar** | Edit mode: selecionar vértices/arestas/faces, extrude, inset, bevel, loop cut, merge, unwrap UV |
| **Modificadores** | Subdivision, Mirror, Array, Solidify, Curva (deformar ao longo de Path) |
| **Booleanas** | União, Subtração, Interseção entre dois objetos |
| **Escanpir** | Esculpir a malha: raise, lower, smooth, flatten (com raio e força configuráveis) |
| **Materiais** | Cor, roughness, metalness, emissive, opacidade, wireframe, flat shading, texturas (map + normalMap com tiling) |
| **Esqueleto** | Adicionar ossos, preset Humanoide (19 ossos), rigging |
| **Peso** | Pintar pesos dos ossos sobre a malha (auto-peso por proximidade, pincel manual) |
| **Animação** | Keyframes por osso, clips (idle/walk/run/jump/attack), reprodução, gizmo de transformação em ossos |
| **Cena** | Configurações globais (fundo, grelha, luzes, renderização avançada) |

### 2.3 Modificadores

| Modificador | Parâmetros |
|---|---|
| Subdivision Surface | `levels` (1–4) |
| Mirror | `axis` (x/y/z) |
| Array | `count` (2–20), `offset` [x, y, z] |
| Solidify | `thickness` (0.01–1) |
| Curva | `pathId` (PathObject de referência), `twist` (-3 a 3), `stretch` (0.1–3) |

**Notas:**
- Os modificadores são **não destrutivos** — aplicam-se por cima da geometria original.
- O modificador **Curva** usa interpolação Catmull-Rom suave (passa por todos os pontos do Path sem angulosidades).
- A ordem dos modificadores importa: Subdivision deve ser aplicado **antes** de Curva para ter vértices suficientes.

### 2.4 Materiais

Propriedades do material PBR (Physically Based Rendering):

| Propriedade | Descrição |
|---|---|
| Cor base | Cor do objeto |
| Roughness | 0 = espelho, 1 = mate |
| Metalness | 0 = dielétrico, 1 = metal |
| Emissive | Cor de brilho próprio |
| Emissive Intensity | Intensidade do brilho |
| Opacidade | 0 = invisível, 1 = opaco |
| Wireframe | Mostrar apenas as arestas |
| Flat Shading | Normais por face (visual facetado) |
| Textura difusa (map) | Imagem PNG/JPG aplicada como cor |
| Normal Map | Imagem que simula relevo |
| Tiling U/V | Repetição da textura |
| Offset U/V | Deslocamento da textura |

### 2.5 Rigging e Weight Painting

- **Esqueleto**: adiciona ossos manualmente ou usa o preset Humanoide (19 ossos: root, spine, chest, neck, head, shoulders, arms, hands, thighs, calves, feet).
- **Weight Painting**: cada osso tem um peso (0–1) em cada vértice. O auto-peso calcula por proximidade. O pincel manual permite ajustar.
- **SkinnedMesh**: quando um objeto tem esqueleto + skinWeights, é renderizado como `THREE.SkinnedMesh` — os ossos deformam a malha em tempo real.

### 2.6 Animação no Editor

- **Keyframes por osso**: seleciona um osso, move-o com o gizmo, e carrega em "Gravar Keyframe". O keyframe guarda posição/rotação/escala do osso no tempo atual.
- **Clips**: idle, walk, run, jump, attack. Cada clip tem os seus próprios keyframes.
- **Reprodução no editor**: o `EditorAnimationPlayer` aplica os keyframes aos bones no editor (não só no modo jogo).
- **Interpolação**: ease (smoothstep), linear, ou step.
- **Blending**: `AnimationBoostObject` na cena ativa blending suave entre clips (ex: idle → walk).

---

## 3. Aba Cena

A aba Cena é onde se montam os níveis do jogo.

### 3.1 Estrutura

- **Cenas**: cada cena é um nível independente. Pode ter múltiplas cenas e navegar entre elas.
- **Catálogo**: lista de objetos criados na Modelagem, disponíveis para adicionar à cena.
- **Conects**: elementos de jogo (física, IA, luzes, sons, etc.) — ver secção 6.
- **Câmara de Jogo**: configurar tipo (perspetiva/ortográfica), FOV, near/far.

### 3.2 Outliner de Conects

- Lista hierárquica com indentação (filhos aparecem sob os pais).
- **Drag-and-drop**: arrastar um Conect para dentro de outro torna-o filho (reparent).
- Botão expandir/colapsar (▼/▶) para pais com filhos.
- Tags: `script` (tem FlirCode), `modelo` (tem sourceObjectId), `↳ filho` (tem parentId).
- Menu de contexto (⋯) por Conect: Ver Filhos/Substituir modelo, FlirScript, Controlador de Animação, Criar filho, Adicionar como filho, Conectar (Joint), Mover para outra cena, Duplicar, Apagar, Remover do pai.

### 3.3 Painéis da Cena

| Painel | Função |
|---|---|
| **Cenas** | Criar, duplicar, apagar, renomear cenas |
| **Catálogo** | Lista de objetos da Modelagem (arrastar para a cena) |
| **Objetos na Cena** | Instâncias de objetos do catálogo na cena atual |
| **Conects na Cena** | Lista hierárquica de Conects |
| **Camadas** | Gerir camadas (criar, apagar, mostrar/esconder, bloquear) |
| **Data Assets** | ScriptableObjects (dados reutilizáveis) + Autoloads (scripts globais) |
| **Modo Story** | Gravação e replay de ações do jogador |
| **Câmara de Jogo** | Configurar câmara de jogo |

### 3.4 Executar Jogo

- Botão "▶ Executar Jogo" inicia o modo jogo.
- O `SceneLevel3D` ativa física, FlirCode, animações, IA, câmara de jogo.
- Botão "Parar" volta ao editor.

---

## 4. Aba Construtores

Gera objetos complexos sem modelar manualmente. Os objetos gerados entram no catálogo da Modelagem.

### 4.1 Construtor de Edifícios

| Parâmetro | Range | Descrição |
|---|---|---|
| Pisos | 1–6 | Número de andares |
| Telhado | Plano / Inclinado / Duas águas | Tipo de telhado |
| Largura | 3–15m | Largura do edifício |
| Profundidade | 3–12m | Profundidade |
| Altura do piso | 2–5m | Altura de cada andar |
| Cor das paredes | Cor | Cor do material |

**Gera**: chão, 4 paredes, teto, telhado, janelas decorativas e porta.

**Botão "Variar"**: gera variações aleatórias (pisos, largura, telhado, cor) para criar ruas com casas não-idênticas.

### 4.2 Construtor de Veículos

| Parâmetro | Opções | Descrição |
|---|---|---|
| Tipo | Sedan / Desportivo / Camião | Carroçaria |
| Tamanho rodas | 0.2–0.8 | Raio das rodas |
| Cor | Cor | Cor da carroçaria |

**Gera**: chassis, cabine, 4 rodas, 2 para-choques, vidro (windshield).

---

## 5. Aba UI

Editor de interfaces de jogo (menus, HUDs, etc.).

### 5.1 Tipos de Elementos (9)

| Tipo | Propriedades |
|---|---|
| Button | label, color, textColor, fontSize, eventName |
| Label | text, color, fontSize |
| Input | placeholder, value, eventName |
| Checkbox | label, checked, eventName |
| Slider | min, max, value, eventName |
| Form | fields, submitLabel, eventName |
| Text | text |
| Image | url |
| Panel | color, opacity |

### 5.2 Sistema de Ancoragem

Cada elemento tem `position` (X%, Y%) e `size` (W, H em pixels). A posição é relativa ao ecrã.

### 5.3 Ligação a FlirCode

Cada elemento tem um `eventName` (ex: `onClick`, `onChange`, `onSubmit`). Quando o utilizador interage com o elemento, o evento é disparado no FlirCode do Conect associado.

### 5.4 Sistema de Links

A função `linkTo("scene"/"screen"/"url", "target")` no FlirCode permite navegação automática:
- `linkTo("scene", "Nível 2")` — muda de cena
- `linkTo("screen", "Menu Principal")` — mostra um ecrã de UI
- `linkTo("url", "https://...")` — abre URL externo

---

## 6. Conects — Lista Completa

Os Conects são os blocos de construção do jogo. Há **40 tipos** em 7 categorias.

### 6.1 Física (7 tipos)

#### RigidObject 📦
Corpo com física real (gravidade, massa, atrito, ressalto).
- **Propriedades**: mass, friction, restitution, linearDamping, angularDamping, fixedRotation, sourceObjectId
- **Usos**: caixas, barris, objetos que caem e rolam

#### StaticObject 🧱
Não se move, colisão fixa.
- **Propriedades**: friction, restitution, sourceObjectId
- **Usos**: chão, paredes, obstáculos

#### StopObject 🛑
Kinematic — não reage à física mas pode ser movido por FlirScript.
- **Propriedades**: friction, restitution, sourceObjectId
- **Usos**: plataformas móveis, portas, elevadores

#### PersonalObject 🚶
Controlador de personagem/jogador.
- **Propriedades**: moveSpeed, jumpForce, canJump, fixedRotation, sourceObjectId
- **Usos**: o jogador principal. Controlado por joystick/teclado (WASD + espaço).

#### NpcObject 🤖
Personagem controlado por IA.
- **Propriedades**: moveSpeed, behavior (idle/patrol/chase/flee), detectionRadius, loseSightRadius, patrolPath, health, sourceObjectId
- **Usos**: inimigos, aliados, NPCs. A IA persegue o PersonalObject quando está dentro do raio de deteção.

#### TriggerObject 🎯
Zona que deteta entrada/saída sem colisão física.
- **Propriedades**: size [X,Y,Z]
- **Usos**: zonas que ativam eventos (ex: entrar numa zona dispara um diálogo)

#### JointObject 🔗
Junta/articulação entre dois objetos.
- **Propriedades**: jointType (hinge/ball/spring/fixed), targetA, targetB, stiffness, damping
- **Usos**: portas articuladas, correntes, molas

### 6.2 Visual (10 tipos)

#### VisualObject 🎨
Malha 3D visível sem física.
- **Propriedades**: sourceObjectId
- **Usos**: decoração, acessórios

#### LuminousObject 💡
Fonte de luz genérica (point/directional/spot).
- **Propriedades**: lightType, color, intensity, distance, castShadow

#### SunObject ☀️
Luz direcional que simula o sol, com temperatura de cor (Kelvin).
- **Propriedades**: intensity, temperature (1000K–20000K), elevation, azimuth, castShadow
- **Conversão Kelvin→RGB**: 6500K = branco neutro, 3000K = quente (laranja), 10000K = frio (azul)

#### PointObject 🔵
Luz pontual com alcance e atenuação configuráveis.
- **Propriedades**: color, intensity, distance, decay, castShadow

#### SpotObject 🔦
Holofote com cone de luz.
- **Propriedades**: color, intensity, distance, angle (graus), penumbra, decay, castShadow
- **Gizmo**: cone wireframe a indicar direção e abertura

#### AreaObject ▭
Luz de área retangular (mais pesada — evitar mais de 2–3 em simultâneo).
- **Propriedades**: color, intensity, width, height
- **Gizmo**: retângulo preenchido + wireframe

#### AmbientObject 🌫️
Luz ambiente uniforme (hemisphere) — preenche sombras sem criar novas.
- **Propriedades**: color (céu), groundColor (chão), intensity

#### ReflectObject 🪞
Sonda de reflexo/ambiente.
- **Propriedades**: resolution, intensity

#### ParticleObject ✨
Sistema de partículas.
- **Propriedades**: maxParticles, emissionRate, particleLife, particleSize, particleSpeed, color, spread, gravity

#### TrailObject 💫
Rasto visual atrás de um objeto.
- **Propriedades**: length, width, color, fade, followTarget

### 6.3 Câmara e Áudio (2 tipos)

#### ViewObject 📷
Câmara de jogo com modos de seguimento.
- **Propriedades**: cameraRole (primary/secondary/player), cameraType (perspective/orthographic), fov, near, far, followTarget, followMode (none/third/top/side), followDistance, followHeight
- **Usos**: câmara em terceira pessoa, vista de topo, vista lateral

#### SoundObject 🔊
Fonte de som/música.
- **Propriedades**: url, volume, loop, autoplay, isMusic, spatial, maxDistance

### 6.4 Ambiente (4 tipos)

#### SkyObject 🌤️
Céu/ambiente com 4 modos:
- **solid**: cor sólida
- **gradient**: gradiente vertical (topColor → bottomColor)
- **hdri**: carrega ficheiro HDRI via URL (RGBELoader + PMREMGenerator)
- **procedural**: céu atmosférico com shader custom (gradiente azul, sol com glow, tons de pôr do sol, estrelas, nuvens)
- **Propriedades do procedural**: sunElevation (0–90°), sunAzimuth (0–360°), rayleigh (azul), turbidity (partículas), mieCoefficient (brilho do sol), starsEnabled

#### TerrainObject ⛰️
Terreno com heightmap editável.
- **Propriedades**: width, depth, segments, heightScale, heightmapSeed

#### WaterObject 🌊
Plano de água com ondas animadas.
- **Propriedades**: size [X,Z], color, opacity, waveHeight, waveSpeed
- **Animação**: vertex displacement no useFrame (ondas senoidais combinadas)

#### FogObject 🌫️
Névoa com distância/cor configuráveis.
- **Propriedades**: fogType (linear/exponential), color, near, far, density
- **Funciona no editor e no jogo** (FogApplier component)

### 6.5 UI (5 tipos)

#### ButtonObject 🔘
Botão na tela.
- **Propriedades**: label, position [X,Y %], size [W,H], color, textColor, fontSize

#### JoystickObject 🕹️
Joystick virtual para mobile.
- **Propriedades**: side (left/right), size, color, deadzone, targetPersonal

#### TextObject 📝
Texto na tela.
- **Propriedades**: text, position, color, fontSize, align

#### ImageObject 🖼️
Imagem/ícone na tela.
- **Propriedades**: url, position, size

#### PanelObject ▬
Painel de fundo para agrupar UI.
- **Propriedades**: position, size, color, opacity

### 6.6 Gameplay (9 tipos)

#### SpawnObject 📍
Ponto de criação automática de objetos.
- **Propriedades**: objectToSpawn, interval (s), maxAlive, autoStart

#### NavigatorObject 🌀
Portal/passagem entre cenas.
- **Propriedades**: targetSceneId, transitionType (fade/instant), transitionDuration, triggerRadius, spawnPosition
- **Comportamento**: quando o PersonalObject entra no raio do portal, muda para a cena de destino

#### CheckpointObject 🚩
Ponto de recomeço/progresso.
- **Propriedades**: checkpointId, isStart

#### TimerObject ⏱️
Temporizador de jogo.
- **Propriedades**: duration (s), autoStart, loop

#### PathObject 🛤️
Caminho/waypoints para movimento guiado.
- **Propriedades**: points (array de [x,y,z]), loop, speed, target
- **Usos**: patrulha de NPCs, trajetos de plataformas móveis, modificador Curva

#### WeaponObject 🔫
Arma equipável com sistema de combate.
- **Propriedades**: damage, fireRate (s), range, fireType (raycast/projectile), maxAmmo, reloadTime, showCrosshair

#### ItemObject 🎁
Item apanhável no mundo.
- **Propriedades**: itemName, itemType (generic/weapon/consumable/material), quantity, icon, pickupRadius, autoPickup

#### AnimationBoostObject ⚡
Ativa blending suave entre clips de animação.
- **Propriedades**: blendTime, interpolationQuality (low/medium/high)
- **Comportamento**: quando presente na cena, todos os animation players usam blending entre clips

#### GameStateObject 🎮
Gere o estado global do jogo.
- **Propriedades**: currentState (menu/playing/paused/gameover/custom)

### 6.7 Organização (3 tipos)

#### PrefabObject 📦
Pacote reutilizável de Conects.
- **Propriedades**: prefabData, sourcePrefabId

#### GroupObject 📁
Agrupa outros Conects sem corpo físico nem visual.
- **Propriedades**: children
- **Usos**: pasta/ container para organizar hierarquia

#### ReferenceObject 🔗
Mostra o conteúdo de outra cena sem duplicar dados.
- **Propriedades**: targetSceneId
- **Comportamento**: renderiza os objetos da cena referenciada na posição do ReferenceObject

### 6.8 Propriedades de Colisor (auto-injetadas)

Todos os Conects com `hasPhysics: true` têm estas propriedades:

| Propriedade | Descrição |
|---|---|
| colliderShape | Forma do colisor: model (usa a geometria), box, sphere, capsule |
| colliderSize | Tamanho do colisor [X,Y,Z] |
| colliderOffset | Offset do colisor [X,Y,Z] |
| colliderRadius | Raio (para esfera/cápsula) |
| colliderHeight | Altura (para cápsula) |

### 6.9 Ver Filhos / Substituir Modelo

No menu de contexto (⋯) de cada Conect com visual:
- **Ver Filhos / Modelo**: mostra o modelo atual (ou "placeholder embutido")
- **Substituir**: lista objetos do catálogo para escolher
- **Eliminar**: remove o sourceObjectId (volta ao placeholder)

Funciona para: PersonalObject, NpcObject, RigidObject, StaticObject, StopObject, VisualObject.

---

## 7. FlirCode — Linguagem de Script

FlirCode é a linguagem de script da engine. É orientada a eventos, com sintaxe simplificada.

### 7.1 Sintaxe

| Constructo | Sintaxe |
|---|---|
| Comentário | `$$ isto é um comentário` |
| Bloco | `begincode ... endcode` |
| Função | `fun nome(parametros) begincode ... endcode` |
| Classe | `class Nome begincode ... endcode` |
| Herança | `class Nome extends Base begincode ... endcode` |
| Variável | `var nome = valor` |
| Atribuição | `nome = valor` |
| Condicional | `if (condicao) begincode ... endcode` |
| Ciclo count | `repeat in number(5, i) begincode ... endcode` |
| Ciclo incremento | `repeat +1 until 10 begincode ... endcode` |
| Ciclo decremento | `repeat -1 until 0 begincode ... endcode` |
| Switch | `switch (var) begincode ... endcode` |
| Case | `case valor begincode ... endcode` |
| Default | `default begincode ... endcode` |
| `this` | Referência ao instanceId do Conect |

**Operadores de condição**: `>`, `<`, `>=`, `<=`, `==`, `!=`

**Tipos de valor**: string (`"..."`), número, booleano (`true`/`false`), `this`, concatenação (`a + b`)

### 7.2 Eventos (19)

Os eventos são funções com prefixo `on` que são chamadas automaticamente:

| Função FlirCode | Quando dispara |
|---|---|
| `onStart` | Quando o jogo começa (uma vez) |
| `onTick` | A cada frame do jogo |
| `onCollide` | Quando colide com outro objeto |
| `onTouch` | Quando o joystick está ativo |
| `onSeePlayer` | Quando o NPC deteta o jogador |
| `onLoseSight` | Quando o NPC perde de vista o jogador |
| `onTimer` | Quando um TimerObject chega a zero |
| `onEnterZone` | Ao entrar num TriggerObject |
| `onExitZone` | Ao sair de um TriggerObject |
| `onClick` | Ao clicar num botão de UI |
| `onChange` | Ao mudar valor de input/checkbox/slider |
| `onSubmit` | Ao submeter um formulário |
| `onPlayerJoin` | Multiplayer: jogador entra |
| `onPlayerLeave` | Multiplayer: jogador sai |
| `onMessage` | Multiplayer: recebe mensagem |
| `onSignal` | Quando um sinal é emitido |
| `onDamage` | Quando recebe dano |
| `onPickup` | Quando apanha um item |
| `onGameStateChange` | Quando o estado do jogo muda |

### 7.3 Funções Embutidas (48)

#### Movimento e Transformação
| Função | Argumentos | Descrição |
|---|---|---|
| `move(x, y, z)` | Direção | Move o objeto |
| `rotate(x, y, z)` | Rotação em graus | Roda o objeto |
| `scale(x, y, z)` | Escala | Escala o objeto |
| `destroy()` | — | Esconde o objeto |
| `createObject(name, x, y, z)` | Nome + posição | Cria instância de objeto do catálogo |
| `changeScene(name)` | Nome da cena | Muda de cena |

#### Variáveis e Estado
| Função | Argumentos | Descrição |
|---|---|---|
| `setVar(name, value)` | Nome + valor | Define variável global |
| `getVar(name)` | Nome | Lê variável global |
| `setGameState(state)` | Estado | Muda o estado global e dispara `onGameStateChange` em todos os Conects |
| `getGameState()` | — | Retorna o estado global atual (default: 'menu') |
| `saveProgress(key, value)` | Chave + valor | Guarda valor no localStorage (persiste entre sessões) |
| `loadProgress(key)` | Chave | Lê valor do localStorage |

#### UI
| Função | Argumentos | Descrição |
|---|---|---|
| `showUI(name)` | Nome do ecrã | Mostra ecrã de UI |
| `hideUI(name)` | Nome do ecrã | Esconde ecrã de UI |
| `showUIScreen(name)` | Nome do ecrã | Mostra ecrã de UI |
| `hideUIScreen(name)` | Nome do ecrã | Esconde ecrã de UI |
| `getUIValue(name)` | Nome do elemento | Lê valor de elemento de UI |
| `setUIValue(name, value)` | Nome + valor | Define valor de elemento de UI |

#### Debug
| Função | Argumentos | Descrição |
|---|---|---|
| `print(msg)` | Mensagem | Log na consola de debug |
| `warn(msg)` | Mensagem | Aviso na consola de debug |
| `error(msg)` | Mensagem | Erro na consola de debug |

#### Colisões e Distâncias
| Função | Argumentos | Descrição |
|---|---|---|
| `collidingWith(type)` | Tipo de Conect | Retorna true se está a colidir |
| `distanceTo(name)` | Nome do objeto | Retorna distância |
| `isTouching()` | — | Retorna true se joystick ativo |

#### Multiplayer
| Função | Argumentos | Descrição |
|---|---|---|
| `sendMessage(data)` | Dados | Envia mensagem a outros jogadores |
| `getPlayers()` | — | Retorna nº de jogadores |
| `getPlayerState(playerId)` | ID do jogador | Retorna estado do jogador |

#### Sinais
| Função | Argumentos | Descrição |
|---|---|---|
| `emitSignal(name, data)` | Nome + dados | Emite sinal a todos os Conects |

#### Combate
| Função | Argumentos | Descrição |
|---|---|---|
| `shoot()` | — | Dispara arma equipada |
| `reload()` | — | Recarrega arma |
| `equipWeapon(name)` | Nome da arma | Equipa arma |
| `getAmmo()` | — | Retorna munição atual |
| `takeDamage(amount)` | Quantidade | Aplica dano ao objeto |
| `getHealth()` | — | Retorna vida atual |

#### Inventário
| Função | Argumentos | Descrição |
|---|---|---|
| `addToInventory(name, qty)` | Nome + quantidade | Adiciona item ao inventário |
| `removeFromInventory(name, qty)` | Nome + quantidade | Remove item do inventário |
| `getInventoryCount(name)` | Nome | Retorna quantidade |
| `hasItem(name)` | Nome | Retorna true se tem o item |

#### Navegação
| Função | Argumentos | Descrição |
|---|---|---|
| `linkTo(target, subTarget)` | "scene"/"screen"/"url" + alvo | Navegação automática |

#### Animação e Som
| Função | Argumentos | Descrição |
|---|---|---|
| `playAnim(name)` | Nome do clip | Reproduz animação |
| `playSound(name)` | Nome ou URL | Reproduz som |
| `playSequence(name)` | Nome | Executa autoload com esse nome ou emite sinal `sequence:name` |

#### Luzes
| Função | Argumentos | Descrição |
|---|---|---|
| `setLightIntensity(id, value)` | Nome/ID + valor | Ajusta intensidade de luz |
| `setLightColor(id, color)` | Nome/ID + cor hex | Ajusta cor de luz |
| `setLightVisible(id, visible)` | Nome/ID + booleano | Liga/desliga luz |

#### Data Assets
| Função | Argumentos | Descrição |
|---|---|---|
| `getDataAsset(name)` | Nome ou ID | Retorna dados de ScriptableObject |
| `getAutoload(name)` | Nome ou ID | Retorna autoload |

### 7.4 Exemplo de Script Completo

```
$$ NPC que persegue o jogador quando o vê
fun onSeePlayer begincode
  print("Vi o jogador!")
  setVar("chasing", true)
endcode

fun onLoseSight begincode
  print("Perdi o jogador")
  setVar("chasing", false)
endcode

fun onTick begincode
  if (getVar("chasing") == true) begincode
    move(1, 0, 0)
  endcode
endcode

fun onDamage(amount) begincode
  print("Recebi " + amount + " de dano!")
  if (getHealth() < 20) begincode
    emitSignal("fleeing", this)
  endcode
endcode
```

---

## 8. Ambientes (Sky, Water, Fog, Luzes)

### 8.1 SkyObject — Céu Procedural

O céu procedural usa um shader GLSL custom que **não depende do THREE.Sky nem do tone mapping**. As cores são calculadas diretamente em sRGB.

**Features do shader:**
1. Gradiente atmosférico (azul zénite → claro horizonte)
2. Sol com disco + halo + glow (cor muda com elevação)
3. Tons de pôr do sol (laranja/vermelho quando sol baixo)
4. Rayleigh scattering (intensidade do azul)
5. Turbidez (partículas → acinzentado)
6. Noite (escurecimento quando sol abaixo do horizonte)
7. Estrelas (com twinkle)
8. Nuvens procedurais (FBM noise com animação)

**Controlos:**
- `sunElevation` (0° = horizonte, 90° = zénite)
- `sunAzimuth` (0° = norte, 180° = sul)
- `rayleigh` (0–10): mais alto = céu mais azul
- `turbidity` (0–30): mais alto = mais partículas
- `starsEnabled`: ativa estrelas à noite

Quando o SkyObject é procedural, também adiciona uma `DirectionalLight` que simula o sol, com cor e intensidade que mudam com a elevação.

### 8.2 WaterObject

Plano de água com ondas animadas via vertex displacement no useFrame. Geometria com 32×32 subdivisões. Ondas calculadas com seno/cosseno combinados.

### 8.3 FogObject

Aplica `THREE.Fog` (linear) ou `THREE.FogExp2` (exponencial) ao `scene.fog`. Funciona no editor e no jogo.

### 8.4 Luzes

6 tipos de luz disponíveis (ver secção 6.2). Cada tipo tem um gizmo visual distinto:
- **SunObject**: esfera laranja + setas paralelas
- **PointObject**: esfera colorida + halo + wireframe (alcance)
- **SpotObject**: cone wireframe + esfera na fonte
- **AreaObject**: retângulo preenchido + wireframe
- **AmbientObject**: esfera cinza semi-transparente
- **LuminousObject**: esfera amarela + halo (genérico)

---

## 9. Física e Colisões

### 9.1 Sistema de Física

A engine usa **cannon-es** para física. O sistema suporta:
- Gravidade configurável por cena
- Corpos rígidos (RigidObject) com massa, atrito, ressalto
- Corpos estáticos (StaticObject)
- Corpos kinematic (StopObject) — movidos por script
- Controladores de personagem (PersonalObject) com deteção de chão
- Triggers (TriggerObject) — detetam entrada/saída sem colisão

### 9.2 Colisores

Cada Conect com física tem um colisor configurável:
- **model**: usa a geometria do modelo como colisor
- **box**: caixa alinhada com os eixos
- **sphere**: esfera
- **capsule**: cápsula (ideal para personagens)

### 9.3 Juntas

`JointObject` conecta dois objetos:
- **hinge**: articulação (porta)
- **ball**: rótula (cabeça)
- **spring**: mola
- **fixed**: fixo

---

## 10. Sistemas de Jogo

### 10.1 Armas e Combate

- `WeaponObject`: define dano, cadência, alcance, munição, tipo (raycast/projectile)
- `equipWeapon("nome")` equipa a arma no PersonalObject
- `shoot()` dispara (raycast do jogador para a frente)
- `takeDamage(amount)` aplica dano a um Conect (reduz health)
- `getHealth()` retorna a vida atual
- Mira (crosshair) aparece quando uma arma está equipada

### 10.2 Inventário

- `ItemObject`: item apanhável com auto-pickup
- `addToInventory("nome", qty)` / `removeFromInventory("nome", qty)`
- `getInventoryCount("nome")` / `hasItem("nome")`
- Evento `onPickup` dispara em todos os runtimes quando um item é apanhado

### 10.3 GameState

- `GameStateObject`: gere o estado global (menu/playing/paused/gameover/custom)
- ⚠️ `setGameState()` e `getGameState()` são stubs no runtime — as funções existem no FlirCode mas não têm implementação no gameContext

### 10.4 NavigatorObject (Portais)

- Colocado numa cena, transporta o jogador para outra cena
- `transitionType`: fade (escurece e abre) ou instant
- `triggerRadius`: raio de ativação
- `spawnPosition`: posição inicial na cena de destino

### 10.5 AnimationBoostObject

- Quando presente na cena, ativa blending suave entre clips
- `blendTime`: duração da transição (ex: 0.3s para idle → walk)
- O `animationController` avalia condições (speed > 0.5 → walk) e muda o clip automaticamente

---

## 11. Animação

### 11.1 Keyframes

- Cada osso pode ter keyframes em tempos diferentes
- Keyframes guardam posição, rotação e escala do osso
- Clips: idle, walk, run, jump, attack
- Interpolação: ease (smoothstep), linear, step

### 11.2 Animation Player

`createAnimationPlayer(animations, getMesh, getBones)`:
- `play(clipName, options)`: options = { loop, speed, onComplete, blendTime }
- `stop()`, `pause()`, `resume()`
- `update(deltaTime)`: avança o tempo e aplica a pose aos bones
- `setBoost(enabled, blendDur)`: ativa/desativa blending

### 11.3 Animation Controller

Máquina de estados com transições automáticas:
- Estados: idle, walk, run, jump, attack
- Transições baseadas em condições: `speed>0.5` → walk, `grounded==false` → jump
- `getContext()` retorna `{ speed, grounded, attacking }`
- O `speed` é calculado a partir do movimento do PersonalObject (hypot de mx, mz)

### 11.4 Shared Animation Cache

Otimização: 200+ NPCs que tocam o mesmo clip no mesmo tempo reutilizam a mesma pose calculada (uma vez por clip+tempo, não uma por NPC). O cache é limpo no início de cada frame.

---

## 12. Organização

### 12.1 Camadas (Layers)

- Criar, apagar, renomear camadas
- Cada camada tem cor identificadora, visível (👁️/🚫), bloqueado (🔒/🔓)
- Cada Conect pode ser atribuído a uma camada (no painel de propriedades)
- Camada "Padrão" não pode ser apagada

### 12.2 Grupos e Hierarquia

- **GroupObject**: agrupa Conects sem corpo físico/visual
- **Hierarquia pai-filho**: arrastar um Conect para dentro de outro no outliner torna-o filho
- Mover o pai move os filhos automaticamente (THREE.Group)
- Botão "Remover do pai" (🔓) no menu de contexto desassocia
- Prevenção de ciclos (não permite tornar-se filho de um descendente)

### 12.3 ReferenceObject

- Mostra o conteúdo de outra cena sem duplicar dados
- Editar o original atualiza automaticamente onde for referenciado

### 12.4 ScriptableObjects (Data Assets)

- Dados reutilizáveis partilhados entre Conects
- Cada Data Asset tem campos key-value editáveis
- `getDataAsset("nome")` no FlirCode retorna os dados

### 12.5 Autoloads

- Scripts globais sempre acessíveis
- `getAutoload("nome")` no FlirCode retorna o autoload

---

## 13. Configurações e Renderização

### 13.1 Configurações de Cena (tab Cena no painel esquerdo)

| Configuração | Descrição |
|---|---|
| Fundo | Cor sólida ou gradiente |
| Grelha | Visível, tamanho, divisões, cor |
| Iluminação | Ambiente (intensidade, cor) + Direcional (intensidade, cor, posição) |

### 13.2 Renderização Avançada

| Recurso | Custo | Descrição |
|---|---|---|
| Flir GI | Médio | Hemisphere light + point light (aproximação de luz indireta) |
| Flir Adaptive Mesh | Médio | LOD automático por distância (3 níveis: full/50%/25%) |
| Vertex AO | Zero (setup) | Oclusão ambiental pré-calculada por vértice |
| Parallax Occlusion Mapping | Moderado | Relevo sem polígonos (usa height map) |

### 13.3 Otimização de Sombras

| Configuração | Descrição |
|---|---|
| Shadow Distance Culling | Objetos além da distância não projetam sombras |
| Distância de sombra | 5–60 unidades |
| Resolução do shadow map | 1024 (performance) / 2048 (qualidade) / 4096 (máxima) |

### 13.4 Pós-Processamento

Efeitos disponíveis (no painel de Pós-Processamento):
- Bloom
- SSAO (Screen Space Ambient Occlusion)
- DoF (Depth of Field)
- Color Grading

---

## 14. Exportação e Persistência

### 14.1 Guardar Projeto

- **💾 .flirengine**: exporta o projeto completo como ficheiro JSON
- **Guardar**: persiste no localStorage (automático via Zustand persist)
- **Carregar**: importa projeto de ficheiro .flirengine
- **IndexedDB**: sync automático para armazenamento persistente

### 14.2 Exportar Jogo

- Exporta um build estático jogável (HTML + JS)
- Inclui PWA (funciona offline)
- O build é colocado na pasta `dist/`

### 14.3 Exportar Modelos

- **GLB/GLTF**: exporta objeto selecionado
- **OBJ**: exporta geometria
- **FBX**: importa modelos FBX (com animações)
- **JSON**: exporta/importa geometria

---

## 15. Modo Story (Gravação + Replay)

Sistema de gravação de ações do jogador durante "Executar Jogo":

1. Clicar em "🔴 Iniciar Gravação" (no painel Modo Story da aba Cena)
2. O jogo inicia e todas as ações do jogador (movimento, salto) são gravadas
3. Clicar em "⏹️ Parar Gravação" para guardar
4. Posteriormente, clicar em "▶️" para reproduzir a gravação

**Usos:**
- Teste de regressão visual: se uma alteração futura partir algo, o replay mostra onde
- Demo automática: deixar o jogo a jogar-se sozinho

**Dados gravados:** tipo de ação (move, jump, click, collision, sceneChange), dados da ação, timestamp

---

## 16. Limitações Conhecidas

### FlirCode

Todas as funções FlirCode estão agora implementadas. `wait(seconds)` regista delays no gameContext, `else if`/`else`/`switch`/`case`/`default` funcionam corretamente, e `setGameState`/`getGameState`/`saveProgress`/`loadProgress`/`playSequence` têm implementação completa no runtime.

### Renderização

| Limitação | Detalhe |
|---|---|
| Sky procedural tons de pôr do sol | Funcionam mas são subtis em algumas configurações de tone mapping |
| POM | Implementado mas precisa de um height map real para efeito visível |
| Flir GI | Não tem impacto mensurável em cenas simples (bottleneck são sombras, não luzes) |
| Shadow distance culling | Não tem impacto mensurável (browser limita FPS com vsync) |

### Performance

| Limitação | Detalhe |
|---|---|
| 200 NPCs animados | Otimizado com sharedAnimationCache (60 FPS confirmado) |
| Área Light (RectAreaLight) | Mais pesada — evitar mais de 2–3 em simultâneo |

---

## Estatísticas da Engine

| Métrica | Valor |
|---|---|
| Conects | 40 tipos em 7 categorias |
| Funções FlirCode | 48 (5 são stubs) |
| Eventos FlirCode | 19 |
| Modificadores | 5 |
| Primitivas | 6 |
| Funções do gameContext | 38 |
| Estados de animação (default) | 5 + 8 transições |
| Uniforms do shader de céu | 5 |
| Construtores | 2 (Edifícios + Veículos) |
| Abas principais | 4 (Modelagem, Cena, Construtores, UI) |
