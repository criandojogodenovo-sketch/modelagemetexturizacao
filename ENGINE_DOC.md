# Flir Engine — Documentação Completa

> Engine de jogos 3D mobile no navegador — funciona offline (PWA), sem instalar nada.

## Índice
1. [Visão Geral](#1-visão-geral)
2. [Modelagem](#2-modelagem)
3. [Texturização](#3-texturização)
4. [Cenas e Conects](#4-cenas-e-conects)
5. [FlirCode — Scripting](#5-flircode--scripting)
6. [Editor de UI](#6-editor-de-ui)
7. [Sistema de Links](#7-sistema-de-links)
8. [Física e Colisores](#8-física-e-colisores)
9. [Armas e Combate](#9-armas-e-combate)
10. [Inventário](#10-inventário)
11. [Classes FlirCode](#11-classes-flircode)
12. [Sinais](#12-sinais)
13. [Multiplayer](#13-multiplayer)
14. [Terrenos](#14-terrenos)
15. [Animação](#15-animação)
16. [Pós-Processamento](#16-pós-processamento)
17. [Exportação](#17-exportação)
18. [Referência FlirCode Completa](#18-referência-flircode-completa)

---

## 1. Visão Geral

A Flir Engine é uma engine 3D completa que corre no browser. Principais sistemas:

- **Modelagem**: 6 primitivas, edit mode, modificadores, booleanas, escultura
- **Texturização**: PBR completo, texturas, UV tiling, 12+ presets
- **Cenas**: Multi-cena, Conects (28+ tipos), física cannon-es
- **FlirCode**: Linguagem de scripting própria com 30+ funções
- **UI Editor**: Editor visual estilo Figma/Canva com zoom, layers, snapping
- **Terrenos**: Heightmap, 7 brushes, splatmap multi-camada, import/export PNG
- **Multiplayer**: WebSocket com criar/entrar em salas
- **Exportação**: HTML standalone jogável

---

## 2. Modelagem

### Primitivas
Cubo, Esfera, Cilindro, Cone, Plano, Torus — adicionar via painel esquerdo ou BottomBar.

### Edit Mode
Selecionar um objeto → tab "Editar" → operações: Extrude, Subdivide, Loop Cut, Bevel.

### Modificadores
Subdivision, Mirror, Array, Solidify — não destrutivos, empilháveis.

### Booleanas
União, Subtração, Interseção entre dois objetos.

### Escultura
Modo Sculpt com pincéis: Elevar, Rebaixar, Suavizar, Achatar.

---

## 3. Texturização

Aceder via Menu Principal → 🎨 Texturização.

### Material PBR
- **Cor base**: color picker
- **Roughness**: 0 (espelho) a 1 (fosco)
- **Metalness**: 0 (não-metal) a 1 (metal puro)
- **Opacidade**: 0 (invisível) a 1 (opaco)
- **Emissive**: cor + intensidade (para objetos que brilham)
- **Wireframe** e **Flat shading**: toggles

### Texturas
Slots: Difusa, Normal, Roughness, Metalness, Emissive.
Carregar via ficheiro (PNG/JPG) — fica guardada em base64 no projeto.

### UV Tiling
- Repeat X/Y: repetir textura
- Offset X/Y: deslocar textura
- Rotação UV: rodar textura

### Biblioteca
12 presets: Plástico, Metal, Madeira, Pedra, Vidro, Ouro, Cobre, Borracha, Gelo, Neon, Holograma, Carro.

### Copy/Paste
Copiar material de um objeto e colar noutro.

---

## 4. Cenas e Conects

### Cenas
Multi-cena com criar/duplicar/apagar/reordenar. Cada cena tem objetos + conects.

### Conects (28+ tipos)
| Categoria | Tipos |
|-----------|-------|
| Física | RigidObject, StaticObject, StopObject, PersonalObject, NpcObject, TriggerObject, JointObject |
| Visual | VisualObject, LuminousObject, ParticleObject, TrailObject, ReflectObject |
| Câmara/Áudio | ViewObject, SoundObject |
| Ambiente | SkyObject, TerrainObject, WaterObject, FogObject |
| UI | ButtonObject, JoystickObject, TextObject, ImageObject, PanelObject |
| Gameplay | TimerObject, PathObject, CheckpointObject, WeaponObject, ItemObject |
| Organização | GroupObject |

### Propriedades
Cada Conect tem propriedades específicas (massa, velocidade, cor, etc.) editáveis no painel direito.

---

## 5. FlirCode — Scripting

FlirCode é a linguagem de scripting da Flir Engine. Sintaxe simples baseada em blocos `begincode...endcode`.

### Estrutura
```
$$ Comentário
fun onStart() begincode
    print("Olá mundo!")
endcode

fun onTick() begincode
    move(0, 0, 1)
endcode
```

### Sintaxe
- `$$ comentário` — linha de comentário
- `var nome = valor` — declarar variável
- `if (condição) begincode ... endcode` — condicional
- `repeat in number(n, i) begincode ... endcode` — ciclo
- `"string" + var` — concatenação
- `this` — referência ao próprio objeto

---

## 6. Editor de UI

Editor visual estilo Figma/Canva.

### Funcionalidades
- **Zoom e pan**: scroll, alt+drag
- **Snapping**: encaixe automático a bordas/centro (threshold 5px)
- **Painel de camadas**: reordenar, esconder/mostrar
- **Seleção múltipla**: shift+clique
- **Alinhar**: esquerda/centro/direita/topo/meio/baixo
- **Resize handles**: 8 cantos/bordas (shift = manter proporção)
- **Painel de propriedades**: X/Y/W/H, cor, bordas, opacidade, tipografia
- **Duplicar**: Ctrl+D
- **Mobile**: panels como drawers com backdrop

### Elementos
Button, Label, Input, Checkbox, Slider, Text, Image, Panel.

---

## 7. Sistema de Links

Permite que botões de UI naveguem entre cenas ou telas.

### Função FlirCode
```
linkTo("scene", "Nível 2")    $$ muda para a cena "Nível 2"
linkTo("screen", "Menu")       $$ mostra a tela de UI "Menu"
linkTo("url", "https://...")   $$ abre URL externa
```

### Como usar
1. Criar múltiplas cenas ou telas de UI
2. Adicionar um ButtonObject ou elemento Button
3. No evento onClick, chamar `linkTo("scene", "nome_da_cena")`
4. Durante o jogo, clicar no botão muda de cena/tela

---

## 8. Física e Colisores

### Física
Integração com cannon-es. Tipos de body:
- **RigidObject**: corpo rígido com gravidade
- **StaticObject**: estático (chão, paredes)
- **StopObject**: cinemático (movido por script)
- **PersonalObject**: controlador de jogador (andar, saltar)
- **NpcObject**: IA (patrulhar, perseguir, fugir)
- **TriggerObject**: zona de gatilho sem colisão física

### Colisores Independentes
Cada Conect com física tem propriedades de colisor:
- `colliderShape`: model | box | sphere | capsule
- `colliderSize`: tamanho do colisor (X,Y,Z)
- `colliderOffset`: deslocamento do colisor
- `colliderRadius`: raio (esfera/cápsula)
- `colliderHeight`: altura (cápsula)

O gizmo verde (wireframe) mostra o colisor no editor, separado do modelo visual.

---

## 9. Armas e Combate

### WeaponObject
Conect com: dano, cadência, alcance, tipo (raycast/projectile), munição, recarga, mira.

### Funções FlirCode
| Função | Descrição |
|--------|-----------|
| `shoot()` | Dispara a arma equipada (raycast) |
| `reload()` | Recarrega a munição |
| `equipWeapon("nome")` | Equipa uma arma |
| `getAmmo()` | Retorna munição atual |
| `takeDamage(qtd)` | Aplica dano a este objeto |
| `getHealth()` | Retorna vida atual |

### Evento
```
fun onDamage(quantidade, origem) begincode
    print("recebeu " + quantidade + " de dano")
endcode
```

### Crosshair
Mira no centro do ecrã quando `showCrosshair = true` na arma.

---

## 10. Inventário

### ItemObject
Conect com: itemName, itemType, quantity, icon, pickupRadius, autoPickup.

### Funções FlirCode
| Função | Descrição |
|--------|-----------|
| `addToInventory("nome", qtd)` | Adiciona item ao inventário |
| `removeFromInventory("nome", qtd)` | Remove item |
| `getInventoryCount("nome")` | Quantidade de um item |
| `hasItem("nome")` | Verifica se tem pelo menos 1 |

### Evento
```
fun onPickup(nomeItem, quantidade) begincode
    print("apanhou: " + nomeItem)
endcode
```

### Auto-pickup
Quando `autoPickup = true`, o item é apanhado automaticamente quando o PersonalObject entra no raio.

### Painel de Inventário
Mostrado automaticamente no canto superior direito durante o jogo.

---

## 11. Classes FlirCode

### Sintaxe
```
class Inimigo begincode
    var vida = 100

    fun onStart() begincode
        print("inimigo criado")
    endcode

    fun receberDano(qtd) begincode
        vida = vida - qtd
    endcode
endcode

class Zombie extends Inimigo begincode
    fun onStart() begincode
        vida = 150
    endcode
endcode
```

### Herança
- `class Nome extends Base` — herda variáveis e funções
- Funções da subclasse fazem override das da base
- `this` refere-se ao próprio objeto

### Atribuir a Conects
No painel de propriedades → seletor "Classe FlirCode".

---

## 12. Sinais

Comunicação entre objetos sem ligação direta.

### Função
```
emitSignal("porta_aberta", "porta_1")
```

### Evento
```
fun onSignal(nome, dados) begincode
    if (nome == "porta_aberta") begincode
        print("porta abriu: " + dados)
    endcode
endcode
```

---

## 13. Multiplayer

Sistema básico via WebSocket.

### Criar/Entrar em Sala
- Menu Principal → 🌐 Multiplayer
- "Criar Sala" gera código de 6 caracteres
- "Entrar em Sala" com código

### Sincronização
Posição/rotação do PersonalObject sincronizada a 10Hz.

### Funções FlirCode
| Função | Descrição |
|--------|-----------|
| `sendMessage(dados)` | Envia dados customizados |
| `getPlayers()` | Número de jogadores ligados |
| `getPlayerState(id)` | Estado de um jogador |

### Eventos
- `onPlayerJoin(playerId)`
- `onPlayerLeave(playerId)`
- `onMessage(playerId, dados)`

### Nota
Sistema básico (sincronização simples), não anti-trapaça.

---

## 14. Terrenos

Editor com 4 tabs (estilo Unity):

### Escultura
7 brushes: Elevar, Rebaixar, Suavizar, Achatar, Definir Altura, Ruído, Rampa.
4 falloffs: Smooth, Linear, Constant, Sharp.
Drag painting com spacing.

### Textura
4 camadas com blending (relva, terra, pedra, neve).
Auto-textura por altura/inclinação.
Pintura manual com pincel.

### Detalhes
Dispersão de objetos (foliage) com regras de altura/inclinação.

### Definições
Dimensões, resolução, Perlin params, import/export PNG heightmap.

---

## 15. Animação

### Keyframes
Timeline com play/pause, keyframes por osso.

### FBX
Importar FBX com animações e esqueleto. Modelo fica no catálogo.

### Animation Controller
Máquina de estados com transições entre clips.

---

## 16. Pós-Processamento

4 efeitos configuráveis por cena:
- **Bloom**: brilho em zonas claras (intensidade, threshold)
- **SSAO**: oclusão ambiente (intensidade, raio)
- **Depth of Field**: desfoque de profundidade (foco, range, bokeh)
- **Color Grading**: correção de cor (brilho, contraste, saturação, matiz, tinta)

Avisos de desempenho quando efeitos pesados estão combinados.

---

## 17. Exportação

### HTML Standalone
Menu Principal → 🎮 Exportar Jogo. Gera um ficheiro HTML único jogável em qualquer browser.

### .flirengine
Guardar/abrir projeto como ficheiro .flirengine (JSON com todo o estado).

### Formatos
- Importar: GLB, GLTF, OBJ, FBX, JSON
- Exportar: GLB, OBJ, JSON, HTML standalone

---

## 18. Referência FlirCode Completa

### Funções Embutidas

| Função | Descrição | Funciona no Editor | Funciona no Export |
|--------|-----------|:---:|:---:|
| `print(msg)` | Log na consola de debug | ✅ | ✅ |
| `warn(msg)` | Log de aviso | ✅ | ✅ |
| `error(msg)` | Log de erro | ✅ | ✅ |
| `move(x,y,z)` | Mover objeto | ✅ | ✅ |
| `rotate(x,y,z)` | Rotacionar objeto | ✅ | ✅ |
| `scale(x,y,z)` | Escalar objeto | ✅ | ✅ |
| `destroy(obj)` | Destruir objeto | ✅ | ✅ |
| `createObject("nome",x,y,z)` | Criar instância | ✅ | ✅ |
| `changeScene("nome")` | Mudar de cena | ✅ | ✅ |
| `wait(segundos)` | Aguardar (log apenas) | ✅ | ✅ |
| `setVar("nome",val)` | Definir variável global | ✅ | ✅ |
| `getVar("nome")` | Obter variável global | ✅ | ✅ |
| `showUIScreen("nome")` | Mostrar tela de UI | ✅ | ✅ |
| `hideUIScreen("nome")` | Esconder tela de UI | ✅ | ✅ |
| `showUI("nome")` | Alias de showUIScreen | ✅ | ✅ |
| `hideUI("nome")` | Alias de hideUIScreen | ✅ | ✅ |
| `getUIValue("nome")` | Obter valor de elemento UI | ✅ | ✅ |
| `setUIValue("nome",val)` | Definir valor de elemento UI | ✅ | ✅ |
| `playSound("nome")` | Tocar som | ✅ | ✅ |
| `playAnim("clip")` | Tocar animação | ✅ | ✅ |
| `collidingWith("tipo")` | Verificar colisão | ✅ | ✅ |
| `distanceTo("nome")` | Distância a outro objeto | ✅ | ✅ |
| `isTouching()` | Ecrã a ser tocado | ✅ | ✅ |
| `emitSignal("nome",dados)` | Emitir sinal | ✅ | ✅ |
| `linkTo("tipo","alvo")` | Navegar (scene/screen/url) | ✅ | ✅ |
| `shoot()` | Disparar arma | ✅ | ✅ |
| `reload()` | Recarregar arma | ✅ | ✅ |
| `equipWeapon("nome")` | Equipar arma | ✅ | ✅ |
| `getAmmo()` | Munição atual | ✅ | ✅ |
| `takeDamage(qtd)` | Receber dano | ✅ | ✅ |
| `getHealth()` | Vida atual | ✅ | ✅ |
| `addToInventory("nome",qtd)` | Adicionar item | ✅ | ✅ |
| `removeFromInventory("nome",qtd)` | Remover item | ✅ | ✅ |
| `getInventoryCount("nome")` | Quantidade de item | ✅ | ✅ |
| `hasItem("nome")` | Verificar se tem item | ✅ | ✅ |
| `sendMessage(dados)` | Enviar mensagem multiplayer | ✅ | ✅ |
| `getPlayers()` | Número de jogadores | ✅ | ✅ |
| `getPlayerState(id)` | Estado de jogador | ✅ | ✅ |

### Eventos

| Evento | Descrição |
|--------|-----------|
| `onStart()` | Início do jogo |
| `onTick()` | A cada frame |
| `onCollide(outro)` | Colisão |
| `onTouch()` | Toque/clique |
| `onSeePlayer()` | NPC vê jogador |
| `onLoseSight()` | NPC perde jogador |
| `onTimer()` | Timer termina |
| `onEnterZone()` | Entrar em trigger |
| `onExitZone()` | Sair de trigger |
| `onClick()` | Clique em botão UI |
| `onChange()` | Mudança em input UI |
| `onSubmit()` | Submit de form UI |
| `onPlayerJoin(playerId)` | Jogador entra no multiplayer |
| `onPlayerLeave(playerId)` | Jogador sai do multiplayer |
| `onMessage(playerId,dados)` | Mensagem multiplayer |
| `onSignal(nome,dados)` | Sinal recebido |
| `onDamage(quantidade,origem)` | Dano recebido |
| `onPickup(nomeItem,quantidade)` | Item apanhado |

### Palavras-chave
`fun`, `var`, `if`, `else`, `repeat`, `switch`, `case`, `default`, `begincode`, `endcode`, `in`, `number`, `until`, `class`, `extends`, `this`

### Syntax Highlighting
O editor FlirCode tem cores:
- **Keywords** (fun, var, if): vermelho-rosa
- **Builtins** (print, move): roxo
- **Events** (onStart, onTick): laranja
- **Strings**: azul claro
- **Numbers**: azul
- **Comments** ($$): cinzento itálico

---

*Documentação gerada para Flir Engine — MOBILE • WEB • POWERFUL*
