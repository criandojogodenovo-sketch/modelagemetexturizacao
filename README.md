# Modelagem & Texturização 3D

Aplicação web completa de modelagem e texturização 3D no navegador, construída com **React + Vite + Three.js**. Inspirada em ferramentas como Blender e Spline, com interface escura e responsiva (desktop + telemóvel/tablet).

> Todo o código corre 100% no browser (client-side). Não há backend obrigatório.

## ✨ Funcionalidades

### Modelagem
- Formas primitivas: cubo, esfera, cilindro, cone, plano, torus
- Selecionar, mover, rodar e escalar objetos (gizmos tipo Blender)
- Extrude simples, duplicar e apagar
- Outliner com nomes editáveis
- Undo / Redo (com atalhos de teclado)

### Texturização
- Aplicar texturas (upload PNG/JPG) a qualquer objeto
- Editor de material: cor base, roughness, metalness, opacity, wireframe, flat shading
- Textura normal opcional
- Tiling (repeat U/V) e offset UV
- Pré-visualização em tempo real com iluminação ajustável

### Cena
- Câmara orbital (rodar, zoom, pan com rato ou toque)
- Grelha de chão configurável
- Fundo configurável (cor sólida ou gradiente)
- Iluminação: ambiente + direcional ajustável + sombras

### Importar / Exportar
- Exportar cena/modelo em **.glb** ou **.obj**
- Importar modelos **.glb** / **.gltf** / **.obj**
- Guardar / carregar projeto em **JSON** (via localStorage ou ficheiro)

### Interface
- Painel esquerdo: ferramentas de modelagem + outliner + configurações de cena
- Painel direito: propriedades do objeto selecionado (transform + material)
- Barra superior: novo projeto, importar, exportar, guardar, undo/redo
- Design escuro, limpo, responsivo
- Em ecrãs pequenos: painéis colapsáveis em drawers + gestos de toque

## 🚀 Stack Técnica

- **React 19** + **Vite 8** (build estático)
- **three.js** + **@react-three/fiber** + **@react-three/drei**
- **zustand** (state manager com persistência em localStorage)
- CSS nativo (sem framework externo)

## 📁 Estrutura de Pastas

```
modelagemetexturizacao/
├── public/
├── src/
│   ├── components/
│   │   ├── 3d/
│   │   │   ├── Scene3D.jsx          # Canvas + câmara + luzes + grelha
│   │   │   └── SceneObject.jsx      # Mesh individual + material + texturas
│   │   ├── panels/
│   │   │   ├── TopBar.jsx           # Barra superior (import/export/save/undo)
│   │   │   ├── LeftPanel.jsx        # Painel ferramentas + outliner + cena
│   │   │   ├── RightPanel.jsx       # Painel propriedades do objeto
│   │   │   ├── Outliner.jsx         # Lista de objetos com nomes editáveis
│   │   │   ├── SceneSettings.jsx    # Configurações de fundo/grelha/luzes
│   │   │   ├── MaterialEditor.jsx   # Cor + texturas + tiling UV
│   │   │   └── Viewport.jsx         # Wrapper do canvas + overlays
│   │   └── ui/
│   │       ├── Icons.jsx            # Ícones SVG inline
│   │       ├── Toasts.jsx
│   │       └── LoadingOverlay.jsx
│   ├── hooks/
│   │   └── useHotkeys.js
│   ├── store/
│   │   └── useStore.js              # Zustand (estado + undo/redo + persistência)
│   ├── utils/
│   │   ├── primitives.js            # Definição das formas primitivas
│   │   ├── exporters.js             # Import/export GLB/OBJ/JSON
│   │   └── helpers.js               # Utilitários gerais
│   ├── styles/
│   │   └── global.css
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

## 🌐 Deploy na Netlify

1. Faz push do projeto para o repositório GitHub
2. Em app.netlify.com → "Add new site" → "Import an existing project"
3. Liga ao repositório GitHub
4. Configurações (auto-detectadas pelo `netlify.toml`):
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
5. Deploy automático a cada push

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

## 📝 Licença

MIT — usa livremente.
