# Modelagem & Texturização 3D

Aplicação web completa de modelagem e texturização 3D no navegador, construída com **React + Vite + Three.js**. Inspirada em ferramentas como Blender e Spline, com interface escura e responsiva (desktop + telemóvel/tablet).

> Todo o código corre 100% no browser (client-side). Não há backend obrigatório.

## ✨ Funcionalidades

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
