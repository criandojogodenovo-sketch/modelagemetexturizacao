/**
 * Ebook — ebook interativo sobre a FlirScript Engine.
 *
 * Capítulos:
 *  1. Introdução à Engine
 *  2. Modelagem 3D
 *  3. Texturização e Materiais
 *  4. Animação
 *  5. Cenas e Níveis
 *  6. Conects (Física, Visual, UI, etc.)
 *  7. FlirScript (scripting visual)
 *  8. Controlador de Animação
 *  9. Editor de UI
 *  10. Editor de Shaders
 *  11. Editor de Terrenos
 *  12. Exportação de Jogos
 *
 * Cada capítulo tem ilustrações SVG inline (sem imagens externas).
 * Botão de download gera um HTML standalone do ebook.
 */
import { useState } from 'react'
import { IconClose, IconSave } from '../ui/Icons'
import { downloadText } from '../../utils/helpers'

const CHAPTERS = [
  {
    id: 'intro',
    title: '1. Introdução à Engine',
    icon: '🎮',
    content: (
      <>
        <h3>Bem-vindo à FlirScript Engine</h3>
        <p>A FlirScript Engine é uma engine de jogos 3D mobile que corre inteiramente no navegador. Não precisas de instalar nada — abre a app e começa a criar.</p>
        <h4>O que podes fazer:</h4>
        <ul>
          <li><strong>Modelar</strong> objetos 3D com primitivas, edit de vértices e modificadores</li>
          <li><strong>Texturizar</strong> com materiais PBR, biblioteca predefinida e texturas carregadas</li>
          <li><strong>Animar</strong> com keyframes e ossos (rigging)</li>
          <li><strong>Montar cenas</strong> com física, iluminação e câmaras</li>
          <li><strong>Programar</strong> lógica com nós visuais FlirScript (estilo Blueprints)</li>
          <li><strong>Exportar</strong> jogos standalone ou APK Android</li>
        </ul>
        <Illustration type="engine-overview" />
      </>
    ),
  },
  {
    id: 'modeling',
    title: '2. Modelagem 3D',
    icon: '🧊',
    content: (
      <>
        <h3>Modelagem de Objetos</h3>
        <p>No <strong>Modo Modelagem</strong> podes criar formas primitivas (cubo, esfera, cilindro, cone, plano, torus) e editá-las profissionalmente.</p>
        <h4>Ferramentas disponíveis:</h4>
        <ul>
          <li><strong>Edit Mode</strong>: selecionar vértices, arestas e faces; extrude, inset, bevel, loop cut, merge</li>
          <li><strong>Modificadores</strong>: Subdivision Surface, Mirror, Array, Solidify (não destrutivos)</li>
          <li><strong>Booleanas</strong>: união, subtração, interseção entre objetos</li>
          <li><strong>Sculpt Mode</strong>: pincel para elevar, rebaixar, suavizar, achatar</li>
        </ul>
        <p>Os objetos criados ficam no <strong>catálogo</strong> e podem ser usados em qualquer cena.</p>
        <Illustration type="modeling" />
      </>
    ),
  },
  {
    id: 'texturing',
    title: '3. Texturização e Materiais',
    icon: '🎨',
    content: (
      <>
        <h3>Materiais PBR</h3>
        <p>A engine usa materiais PBR (Physically Based Rendering) com cor, roughness, metalness, opacity, emissive e texturas.</p>
        <h4>Biblioteca de materiais predefinidos:</h4>
        <ul>
          <li><strong>Metais</strong>: Cromado, Ouro, Cobre, Aço Escovado</li>
          <li><strong>Madeiras</strong>: Carvalho, Nogueira (texturas procedurais)</li>
          <li><strong>Pedras</strong>: Mármore, Granito, Arenosa</li>
          <li><strong>Panos</strong>: Algodão, Veludo</li>
          <li><strong>Vidros</strong>: Transparente, Fosco</li>
          <li><strong>Emissivos</strong>: Neon Azul, Neon Rosa, Lava</li>
        </ul>
        <h4>Texturas personalizadas:</h4>
        <p>Podes carregar PNG/JPG para textura difusa, normal map e emissive. Ajusta tiling (repeat U/V) e offset.</p>
        <Illustration type="materials" />
      </>
    ),
  },
  {
    id: 'animation',
    title: '4. Animação',
    icon: '🏃',
    content: (
      <>
        <h3>Sistema de Animação</h3>
        <p>Cria animações com <strong>keyframes</strong> numa timeline visual.</p>
        <h4>Passos:</h4>
        <ol>
          <li>Adiciona ossos ao objeto (rigging)</li>
          <li>Posiciona o cursor da timeline num tempo</li>
          <li>Move o objeto/osso e clica em "Key" para adicionar keyframe</li>
          <li>Repete para outros tempos</li>
          <li>Clica em "Reproduzir" para ver a animação</li>
        </ol>
        <h4>Clips de animação:</h4>
        <p>Cria múltiplos clips (idle, walk, run, jump) que podes depois usar no Controlador de Animação.</p>
        <Illustration type="animation" />
      </>
    ),
  },
  {
    id: 'scenes',
    title: '5. Cenas e Níveis',
    icon: '🎬',
    content: (
      <>
        <h3>Editor de Cenas</h3>
        <p>No <strong>Modo Cena</strong> montas o teu jogo completo. Uma cena contém:</p>
        <ul>
          <li>Objetos do catálogo (instâncias posicionadas)</li>
          <li>Conects (física, visual, UI, áudio, ambiente)</li>
          <li>Câmara de jogo configurável</li>
          <li>Iluminação, fundo, grelha</li>
        </ul>
        <h4>Como usar:</h4>
        <ol>
          <li>Cria uma cena (ex: "Nível 1")</li>
          <li>Arrasta objetos do catálogo para a viewport</li>
          <li>Adiciona Conects (física, etc.) via janela de Conects</li>
          <li>Posiciona tudo com os gizmos (mover/rodar/escalar)</li>
          <li>Clica em "Pré-visualizar" para testar</li>
        </ol>
        <Illustration type="scene" />
      </>
    ),
  },
  {
    id: 'conects',
    title: '6. Conects',
    icon: '🧩',
    content: (
      <>
        <h3>Conects — a unidade base da cena</h3>
        <p>Conects são como "GameObjects" na Unity ou "Nodes" na Godot. Cada Conect tem um tipo específico:</p>
        <h4>Física:</h4>
        <ul>
          <li><strong>RigidObject</strong>: corpo com gravidade, massa, atrito</li>
          <li><strong>StaticObject</strong>: chão, paredes (não se move)</li>
          <li><strong>StopObject</strong>: kinematic (movido por script)</li>
          <li><strong>PersonalObject</strong>: controlador de jogador</li>
          <li><strong>NpcObject</strong>: IA (patrulhar, perseguir, fugir)</li>
          <li><strong>TriggerObject</strong>: zona de deteção sem colisão</li>
        </ul>
        <h4>Visual:</h4>
        <ul>
          <li><strong>VisualObject</strong>: modelo 3D</li>
          <li><strong>LuminousObject</strong>: luz (pontual, direcional, spot)</li>
          <li><strong>ParticleObject</strong>: partículas (fumo, fogo)</li>
        </ul>
        <h4>UI:</h4>
        <ul>
          <li><strong>ButtonObject</strong>, <strong>TextObject</strong>, <strong>JoystickObject</strong></li>
        </ul>
        <Illustration type="conects" />
      </>
    ),
  },
  {
    id: 'flirscript',
    title: '7. FlirScript',
    icon: '🧩',
    content: (
      <>
        <h3>Scripting Visual com FlirScript</h3>
        <p>O FlirScript é um sistema de nós visuais (como Blueprints da Unreal) para programar lógica de jogo sem escrever código.</p>
        <h4>Categorias de nós:</h4>
        <ul>
          <li><strong>Eventos</strong>: BeginPlay, Tick, OnCollision, OnTouch, OnEnterZone</li>
          <li><strong>Ações</strong>: Move, Rotate, PlayAnimation, PlaySound, Destroy, Spawn, ChangeScene</li>
          <li><strong>Lógica</strong>: Branch (Se/Senão), Compare, Math, Loop, Delay</li>
          <li><strong>Variáveis</strong>: GetVar/SetVar, Health, Score, Speed</li>
          <li><strong>Input</strong>: OnTouchScreen, OnSwipe, VirtualButton</li>
          <li><strong>Debug</strong>: Imprimir/Log, Aviso, Erro</li>
        </ul>
        <h4>Como usar:</h4>
        <ol>
          <li>Seleciona um Conect e clica no botão 🧩</li>
          <li>No editor, adiciona nós (botão "Nó")</li>
          <li>Liga os pinos arrastando de um para outro</li>
          <li>Configura as propriedades de cada nó</li>
          <li>Clica em "Validar" antes de executar</li>
        </ol>
        <Illustration type="flirscript" />
      </>
    ),
  },
  {
    id: 'anim-controller',
    title: '8. Controlador de Animação',
    icon: '🏃',
    content: (
      <>
        <h3>Máquina de Estados de Animação</h3>
        <p>Para personagens (PersonalObject/NpcObject) podes criar um controlador que mistura animações automaticamente.</p>
        <h4>Estados predefinidos:</h4>
        <ul>
          <li>idle (parado)</li>
          <li>walk (a andar)</li>
          <li>run (a correr)</li>
          <li>jump (no ar)</li>
          <li>attack (a atacar)</li>
        </ul>
        <h4>Transições automáticas:</h4>
        <ul>
          <li><code>speed &gt; 0.5</code> → walk</li>
          <li><code>speed &gt; 5</code> → run</li>
          <li><code>grounded == false</code> → jump</li>
        </ul>
        <p>A transição entre estados é suave (blend), sem cortes bruscos.</p>
        <Illustration type="anim-controller" />
      </>
    ),
  },
  {
    id: 'ui-editor',
    title: '9. Editor de UI',
    icon: '📱',
    content: (
      <>
        <h3>Editor de Interface</h3>
        <p>Cria interfaces de jogo (HUD, menus, botões) numa tela 2D dedicada.</p>
        <h4>Elementos disponíveis:</h4>
        <ul>
          <li>ButtonObject — botão clicável</li>
          <li>TextObject — texto (pontuação, vida)</li>
          <li>ImageObject — imagem/ícone</li>
          <li>PanelObject — painel de fundo</li>
          <li>JoystickObject — joystick virtual</li>
        </ul>
        <h4>Ancoragem:</h4>
        <p>Os elementos são posicionados em percentagem, por isso adaptam-se a qualquer tamanho de ecrã.</p>
        <h4>Camadas:</h4>
        <ul>
          <li>HUD — interface do jogo</li>
          <li>Menu Pausa — menu de pausa</li>
          <li>Game Over — ecrã de fim de jogo</li>
        </ul>
        <Illustration type="ui-editor" />
      </>
    ),
  },
  {
    id: 'shaders',
    title: '10. Editor de Shaders',
    icon: '🌈',
    content: (
      <>
        <h3>Shaders Personalizados</h3>
        <p>Cria efeitos visuais avançados com GLSL ou com a biblioteca predefinida.</p>
        <h4>Biblioteca de shaders:</h4>
        <ul>
          <li><strong>Água</strong> — superfície com ondas e reflexo</li>
          <li><strong>Vidro</strong> — transparência com refração</li>
          <li><strong>Metal</strong> — reflexos especulares</li>
          <li><strong>Dissolver</strong> — desaparecer progressivo</li>
          <li><strong>Holograma</strong> — efeito holográfico com scanlines</li>
        </ul>
        <p>Modo Código GLSL para utilizadores avançados que queiram escrever shaders diretamente.</p>
        <Illustration type="shaders" />
      </>
    ),
  },
  {
    id: 'terrain',
    title: '11. Editor de Terrenos',
    icon: '⛰️',
    content: (
      <>
        <h3>Criação de Terrenos</h3>
        <p>O editor de terrenos permite criar relevos naturais para os teus jogos.</p>
        <h4>Funcionalidades:</h4>
        <ul>
          <li>Heightmap procedural (gerado com seed)</li>
          <li>Pincel com 4 modos: Elevar, Rebaixar, Suavizar, Achatar</li>
          <li>Configuração de tamanho, resolução, escala de altura</li>
          <li>Pré-visualização 2D do heightmap (top-down)</li>
          <li>Exportar para a cena como TerrainObject</li>
        </ul>
        <h4>Como usar:</h4>
        <ol>
          <li>Configura tamanho e resolução</li>
          <li>Gera um heightmap procedural ou pinta manualmente</li>
          <li>Ajusta o pincel (tamanho, força, modo)</li>
          <li>Clica na pré-visualização para editar</li>
          <li>Exporta para a cena</li>
        </ol>
        <Illustration type="terrain" />
      </>
    ),
  },
  {
    id: 'export',
    title: '12. Exportação de Jogos',
    icon: '🚀',
    content: (
      <>
        <h3>Exporta o teu jogo</h3>
        <p>Quando o jogo estiver pronto, podes exportá-lo de várias formas.</p>
        <h4>Opções de exportação:</h4>
        <ul>
          <li><strong>HTML Standalone</strong> — um ficheiro HTML que abre em qualquer browser</li>
          <li><strong>APK Android</strong> — via Capacitor (config incluído)</li>
          <li><strong>URL de partilha</strong> — rota /play/&lt;id&gt; no mesmo domínio</li>
        </ul>
        <h4>Otimizações para mobile:</h4>
        <ul>
          <li>Texturas redimensionadas para potências de 2</li>
          <li>Limite configurável de partículas e luzes</li>
          <li>Simplificação opcional de malhas</li>
        </ul>
        <h4>Passo a passo:</h4>
        <ol>
          <li>No Modo Cena, clica em "🎮 Exportar"</li>
          <li>Dá um nome ao jogo</li>
          <li>Ajusta as otimizações</li>
          <li>Clica em "Exportar Jogo"</li>
          <li>Descarrega o HTML e o capacitor.config.json</li>
        </ol>
        <Illustration type="export" />
      </>
    ),
  },
]

// Ilustrações SVG inline (sem imagens externas)
function Illustration({ type }) {
  const illustrations = {
    'engine-overview': (
      <svg viewBox="0 0 400 200" className="ebook-illustration">
        <rect x="10" y="10" width="380" height="180" rx="10" fill="#161b22" stroke="#30363d" />
        <rect x="20" y="40" width="80" height="140" fill="#1c2128" stroke="#2f81f7" />
        <text x="60" y="30" textAnchor="middle" fill="#8b949e" fontSize="10">Modelagem</text>
        <rect x="110" y="40" width="180" height="100" fill="#1c2128" stroke="#3fb950" />
        <text x="200" y="30" textAnchor="middle" fill="#8b949e" fontSize="10">Viewport 3D</text>
        <rect x="110" y="150" width="180" height="30" fill="#1c2128" stroke="#d29922" />
        <text x="200" y="170" textAnchor="middle" fill="#8b949e" fontSize="10">Timeline</text>
        <rect x="300" y="40" width="80" height="140" fill="#1c2128" stroke="#8957e5" />
        <text x="340" y="30" textAnchor="middle" fill="#8b949e" fontSize="10">Propriedades</text>
      </svg>
    ),
    'modeling': (
      <svg viewBox="0 0 400 200" className="ebook-illustration">
        <rect x="10" y="10" width="380" height="180" rx="10" fill="#161b22" stroke="#30363d" />
        <polygon points="200,50 130,90 130,150 200,180 270,150 270,90" fill="none" stroke="#2f81f7" strokeWidth="2" />
        <line x1="200" y1="50" x2="200" y2="180" stroke="#2f81f7" strokeWidth="1" strokeDasharray="3" />
        <line x1="130" y1="90" x2="270" y2="150" stroke="#2f81f7" strokeWidth="1" strokeDasharray="3" />
        <circle cx="200" cy="50" r="4" fill="#3fb950" />
        <circle cx="130" cy="90" r="4" fill="#3fb950" />
        <circle cx="270" cy="90" r="4" fill="#3fb950" />
        <circle cx="130" cy="150" r="4" fill="#3fb950" />
        <circle cx="270" cy="150" r="4" fill="#3fb950" />
        <circle cx="200" cy="180" r="4" fill="#3fb950" />
        <text x="200" y="195" textAnchor="middle" fill="#8b949e" fontSize="10">Edit Mode — vértices selecionáveis</text>
      </svg>
    ),
    'materials': (
      <svg viewBox="0 0 400 200" className="ebook-illustration">
        <rect x="10" y="10" width="380" height="180" rx="10" fill="#161b22" stroke="#30363d" />
        {[0,1,2,3,4].map(i => (
          <g key={i}>
            <circle cx={70 + i * 70} cy="80" r="30" fill={['#c8c8c8','#ffb84d','#b87333','#e8e8e8','#5a1a3a'][i]} stroke="#30363d" />
            <text x={70 + i * 70} y="130" textAnchor="middle" fill="#8b949e" fontSize="10">
              {['Cromado','Ouro','Cobre','Mármore','Veludo'][i]}
            </text>
          </g>
        ))}
      </svg>
    ),
    'animation': (
      <svg viewBox="0 0 400 200" className="ebook-illustration">
        <rect x="10" y="10" width="380" height="180" rx="10" fill="#161b22" stroke="#30363d" />
        <line x1="20" y1="100" x2="380" y2="100" stroke="#30363d" />
        {[0,1,2,3,4].map(i => (
          <g key={i}>
            <circle cx={50 + i * 80} cy="100" r="8" fill="#d29922" />
            <text x={50 + i * 80} y="125" textAnchor="middle" fill="#8b949e" fontSize="10">{i * 0.5}s</text>
          </g>
        ))}
        <path d="M 50 100 Q 90 60 130 100 Q 170 140 210 100 Q 250 60 290 100 Q 330 140 370 100"
              fill="none" stroke="#2f81f7" strokeWidth="2" />
        <text x="200" y="170" textAnchor="middle" fill="#8b949e" fontSize="10">Timeline com keyframes (losangos)</text>
      </svg>
    ),
    'scene': (
      <svg viewBox="0 0 400 200" className="ebook-illustration">
        <rect x="10" y="10" width="380" height="180" rx="10" fill="#161b22" stroke="#30363d" />
        <rect x="20" y="150" width="360" height="30" fill="#1c2128" stroke="#30363d" />
        <text x="200" y="170" textAnchor="middle" fill="#6e7681" fontSize="10">Chão (grelha)</text>
        <rect x="80" y="100" width="40" height="50" fill="#2f81f7" opacity="0.7" />
        <text x="100" y="95" textAnchor="middle" fill="#8b949e" fontSize="9">Cubo</text>
        <circle cx="200" cy="120" r="25" fill="#3fb950" opacity="0.7" />
        <text x="200" y="95" textAnchor="middle" fill="#8b949e" fontSize="9">Jogador</text>
        <polygon points="300,150 280,100 320,100" fill="#f4a261" opacity="0.7" />
        <text x="300" y="95" textAnchor="middle" fill="#8b949e" fontSize="9">Cone</text>
      </svg>
    ),
    'conects': (
      <svg viewBox="0 0 400 200" className="ebook-illustration">
        <rect x="10" y="10" width="380" height="180" rx="10" fill="#161b22" stroke="#30363d" />
        {[
          {x: 50, y: 50, icon: '📦', label: 'Rigid'},
          {x: 130, y: 50, icon: '🧱', label: 'Static'},
          {x: 210, y: 50, icon: '🚶', label: 'Player'},
          {x: 290, y: 50, icon: '🤖', label: 'NPC'},
          {x: 50, y: 130, icon: '💡', label: 'Luz'},
          {x: 130, y: 130, icon: '✨', label: 'Partículas'},
          {x: 210, y: 130, icon: '🔊', label: 'Som'},
          {x: 290, y: 130, icon: '🕹️', label: 'Joystick'},
        ].map((c, i) => (
          <g key={i}>
            <rect x={c.x - 30} y={c.y - 20} width="60" height="40" rx="6" fill="#1c2128" stroke="#2f81f7" />
            <text x={c.x} y={c.y + 5} textAnchor="middle" fontSize="16">{c.icon}</text>
            <text x={c.x} y={c.y + 35} textAnchor="middle" fill="#8b949e" fontSize="9">{c.label}</text>
          </g>
        ))}
      </svg>
    ),
    'flirscript': (
      <svg viewBox="0 0 400 200" className="ebook-illustration">
        <rect x="10" y="10" width="380" height="180" rx="10" fill="#161b22" stroke="#30363d" />
        <rect x="40" y="60" width="100" height="40" rx="6" fill="#f4a261" opacity="0.3" stroke="#f4a261" />
        <text x="90" y="85" textAnchor="middle" fill="#f4a261" fontSize="10">BeginPlay</text>
        <rect x="180" y="60" width="100" height="40" rx="6" fill="#2a9d8f" opacity="0.3" stroke="#2a9d8f" />
        <text x="230" y="85" textAnchor="middle" fill="#2a9d8f" fontSize="10">Move</text>
        <rect x="180" y="120" width="100" height="40" rx="6" fill="#8957e5" opacity="0.3" stroke="#8957e5" />
        <text x="230" y="145" textAnchor="middle" fill="#8957e5" fontSize="10">Branch</text>
        <line x1="140" y1="80" x2="180" y2="80" stroke="#2f81f7" strokeWidth="2" />
        <line x1="230" y1="100" x2="230" y2="120" stroke="#2f81f7" strokeWidth="2" />
        <circle cx="140" cy="80" r="4" fill="#2f81f7" />
        <circle cx="180" cy="80" r="4" fill="#2f81f7" />
        <circle cx="230" cy="100" r="4" fill="#2f81f7" />
        <circle cx="230" cy="120" r="4" fill="#2f81f7" />
      </svg>
    ),
    'anim-controller': (
      <svg viewBox="0 0 400 200" className="ebook-illustration">
        <rect x="10" y="10" width="380" height="180" rx="10" fill="#161b22" stroke="#30363d" />
        <circle cx="80" cy="100" r="25" fill="#3fb950" opacity="0.3" stroke="#3fb950" />
        <text x="80" y="105" textAnchor="middle" fill="#3fb950" fontSize="10">idle</text>
        <circle cx="200" cy="100" r="25" fill="#2f81f7" opacity="0.3" stroke="#2f81f7" />
        <text x="200" y="105" textAnchor="middle" fill="#2f81f7" fontSize="10">walk</text>
        <circle cx="320" cy="100" r="25" fill="#f4a261" opacity="0.3" stroke="#f4a261" />
        <text x="320" y="105" textAnchor="middle" fill="#f4a261" fontSize="10">run</text>
        <line x1="105" y1="100" x2="175" y2="100" stroke="#8b949e" strokeWidth="1" markerEnd="url(#arrow)" />
        <line x1="225" y1="100" x2="295" y2="100" stroke="#8b949e" strokeWidth="1" />
        <text x="140" y="90" textAnchor="middle" fill="#8b949e" fontSize="8">speed&gt;0</text>
        <text x="260" y="90" textAnchor="middle" fill="#8b949e" fontSize="8">speed&gt;5</text>
      </svg>
    ),
    'ui-editor': (
      <svg viewBox="0 0 400 200" className="ebook-illustration">
        <rect x="10" y="10" width="380" height="180" rx="10" fill="#161b22" stroke="#30363d" />
        <rect x="60" y="30" width="280" height="140" rx="8" fill="#0d1117" stroke="#30363d" />
        <rect x="80" y="50" width="80" height="30" rx="4" fill="#2f81f7" />
        <text x="120" y="70" textAnchor="middle" fill="#fff" fontSize="10">Botão</text>
        <rect x="200" y="50" width="120" height="20" rx="3" fill="#1c2128" />
        <text x="260" y="65" textAnchor="middle" fill="#fff" fontSize="9">Pontuação: 100</text>
        <circle cx="100" cy="140" r="20" fill="none" stroke="#2f81f7" strokeWidth="2" />
        <circle cx="100" cy="140" r="8" fill="#2f81f7" />
      </svg>
    ),
    'shaders': (
      <svg viewBox="0 0 400 200" className="ebook-illustration">
        <rect x="10" y="10" width="380" height="180" rx="10" fill="#161b22" stroke="#30363d" />
        <rect x="40" y="40" width="70" height="50" rx="4" fill="#2f81f7" opacity="0.5" />
        <text x="75" y="105" textAnchor="middle" fill="#8b949e" fontSize="9">Água</text>
        <rect x="130" y="40" width="70" height="50" rx="4" fill="#a8d8ea" opacity="0.5" />
        <text x="165" y="105" textAnchor="middle" fill="#8b949e" fontSize="9">Vidro</text>
        <rect x="220" y="40" width="70" height="50" rx="4" fill="#c8c8c8" opacity="0.8" />
        <text x="255" y="105" textAnchor="middle" fill="#8b949e" fontSize="9">Metal</text>
        <rect x="310" y="40" width="60" height="50" rx="4" fill="#ff4500" opacity="0.5" />
        <text x="340" y="105" textAnchor="middle" fill="#8b949e" fontSize="9">Lava</text>
        <rect x="100" y="130" width="200" height="20" rx="3" fill="#1c2128" stroke="#2f81f7" />
        <text x="200" y="145" textAnchor="middle" fill="#2f81f7" fontSize="9" fontFamily="monospace">void main() {'{ ... }'}</text>
      </svg>
    ),
    'terrain': (
      <svg viewBox="0 0 400 200" className="ebook-illustration">
        <rect x="10" y="10" width="380" height="180" rx="10" fill="#161b22" stroke="#30363d" />
        <path d="M 30 170 L 80 100 L 130 130 L 180 60 L 230 110 L 280 80 L 330 140 L 370 120 L 370 170 Z"
              fill="#5a7d3a" opacity="0.7" stroke="#5a7d3a" />
        <path d="M 30 170 L 80 100 L 130 130 L 180 60 L 230 110 L 280 80 L 330 140 L 370 120"
              fill="none" stroke="#3a5d1a" strokeWidth="2" />
        <text x="200" y="195" textAnchor="middle" fill="#8b949e" fontSize="10">Terreno com heightmap</text>
      </svg>
    ),
    'export': (
      <svg viewBox="0 0 400 200" className="ebook-illustration">
        <rect x="10" y="10" width="380" height="180" rx="10" fill="#161b22" stroke="#30363d" />
        <rect x="60" y="60" width="100" height="80" rx="6" fill="#1c2128" stroke="#3fb950" />
        <text x="110" y="100" textAnchor="middle" fill="#3fb950" fontSize="20">📱</text>
        <text x="110" y="125" textAnchor="middle" fill="#8b949e" fontSize="9">HTML</text>
        <rect x="180" y="60" width="100" height="80" rx="6" fill="#1c2128" stroke="#2f81f7" />
        <text x="230" y="100" textAnchor="middle" fill="#2f81f7" fontSize="20">🤖</text>
        <text x="230" y="125" textAnchor="middle" fill="#8b949e" fontSize="9">APK</text>
        <rect x="300" y="60" width="80" height="80" rx="6" fill="#1c2128" stroke="#f4a261" />
        <text x="340" y="100" textAnchor="middle" fill="#f4a261" fontSize="20">🔗</text>
        <text x="340" y="125" textAnchor="middle" fill="#8b949e" fontSize="9">URL</text>
      </svg>
    ),
  }
  return illustrations[type] || null
}

export default function Ebook({ onClose }) {
  const [activeChapter, setActiveChapter] = useState(0)

  const handleDownload = () => {
    // Gerar HTML standalone do ebook
    const html = `<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="UTF-8">
<title>FlirScript Engine — Ebook</title>
<style>
body { font-family: sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; background: #0d1117; color: #e6edf3; }
h1, h2, h3 { color: #2f81f7; }
code { background: #1c2128; padding: 2px 6px; border-radius: 3px; color: #f4a261; }
ul, ol { line-height: 1.6; }
</style>
</head>
<body>
<h1>FlirScript Engine — Guia Completo</h1>
${CHAPTERS.map((c) => `<h2>${c.icon} ${c.title}</h2>`).join('')}
</body>
</html>`
    downloadText(html, 'flirscript-engine-ebook.html', 'text/html')
  }

  return (
    <div className="ebook-container">
      <header className="ebook-header">
        <button onClick={onClose} className="icon">← Voltar</button>
        <h1>📚 Ebook da FlirScript Engine</h1>
        <button onClick={handleDownload} className="icon" title="Descarregar ebook">
          <IconSave width={14} height={14} /> Descarregar
        </button>
      </header>

      <div className="ebook-body">
        <nav className="ebook-toc">
          {CHAPTERS.map((ch, i) => (
            <button
              key={ch.id}
              className={`ebook-toc-item ${activeChapter === i ? 'active' : ''}`}
              onClick={() => setActiveChapter(i)}
            >
              <span className="ebook-toc-icon">{ch.icon}</span>
              <span>{ch.title}</span>
            </button>
          ))}
        </nav>

        <div className="ebook-content">
          {CHAPTERS[activeChapter].content}
        </div>
      </div>
    </div>
  )
}
