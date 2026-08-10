/**
 * iconMap.jsx — Mapa central de ícones para a Flir Engine.
 *
 * Substitui emojis por ícones SVG consistentes (lucide-react).
 * Permite usar nomes semânticos em vez de emojis em toda a app.
 *
 * Uso:
 *   import { Icon } from './iconMap'
 *   <Icon name="home" size={16} />
 *   <Icon name="cube" color="var(--accent)" />
 *
 * Para Conects (taxonomy.js), usar o nome do ícone em vez de emoji:
 *   icon: 'cube'  // em vez de '📦'
 */

import {
  Home, FileText, Mountain, Play, Save, FolderOpen, Package,
  Box, Globe, Cylinder, Cone, Plane as PlaneIcon, Donut,
  Settings, Menu, X, Plus, Trash2, Copy, Eye, EyeOff,
  Undo2, Redo2, Download, Upload, Image as ImageIcon,
  Layers, Edit3, Brush, Grid3x3, Bone, Film, PlayCircle, Pause, Key,
  Boxes, GitBranch, CircleDot, Square, Spline, Search,
  Camera, Volume2, Sun, Cloud, MountainSnow, Waves, Wind,
  Sparkles, Zap, Target, Link2, Lightbulb, Flashlight,
  Gamepad2, PackageCheck, Gift, MapPin, Flag, Timer, Route,
  MousePointer2, Joystick, Type, Image, PanelBottom,
  Smartphone, Rainbow, Wrench, Cog, Brush as BrushIcon,
  Move3d, RotateCw, Maximize2, Scan, Grid2x2,
  ChevronDown, ChevronRight, ChevronLeft, MoreHorizontal,
  PanelLeft, PanelRight, ArrowUp, ArrowDown, ArrowLeft, ArrowRight,
  Lock, Unlock, Eye as EyeIcon, Settings2, Sliders,
  RefreshCw, Power, AlertCircle, CheckCircle2, Info,
  Maximize, Minimize, ExternalLink, Link,
  Hand, MousePointer, Crop, Scissors,
  Workflow, Network, Share2, GitFork,
  Bookmark, Star, Heart, Bell,
  Database, HardDrive, CloudOff, Wifi, WifiOff,
  Triangle, Hexagon, Pentagon, Octagon,
  CircuitBoard, Bot, Users, User, UserPlus,
  Droplet, Droplets, Thermometer,
  Flame, Snowflake, CloudRain, CloudSnow,
  TreePalm, TreeDeciduous, Flower, Leaf,
  Car, Truck, Plane as PlaneIcon2, Ship,
  Sword, Shield, Heart as HeartIcon, Coins,
  Clock, Calendar, Hourglass,
  FolderTree, Palette, Puzzle, Map, MapPinned, Navigation, Compass,
  Terminal, Bug, Activity, Gauge, Cpu,
  HelpCircle, Dice5,
} from 'lucide-react'

// Mapa: nome semântico → componente lucide
const ICON_MAP = {
  // ===== Navegação / Menu =====
  home: Home,
  menu: Menu,
  close: X,
  'folder-open': FolderOpen,
  folder: FolderTree,
  file: FileText,
  'file-box': FileText,
  package: Package,
  search: Search,
  'more-horizontal': MoreHorizontal,
  'chevron-down': ChevronDown,
  'chevron-right': ChevronRight,
  'chevron-left': ChevronLeft,
  'arrow-up': ArrowUp,
  'arrow-down': ArrowDown,
  'arrow-left': ArrowLeft,
  'arrow-right': ArrowRight,

  // ===== Ações =====
  save: Save,
  import: Upload,
  export: Download,
  upload: Upload,
  download: Download,
  plus: Plus,
  trash: Trash2,
  duplicate: Copy,
  'eye': Eye,
  'eye-off': EyeOff,
  undo: Undo2,
  redo: Redo2,
  edit: Edit3,
  settings: Settings,
  'settings-2': Settings2,
  sliders: Sliders,
  refresh: RefreshCw,
  power: Power,
  lock: Lock,
  unlock: Unlock,

  // ===== Primitivas 3D =====
  cube: Box,
  box: Box,
  sphere: Globe,
  cylinder: Cylinder,
  cone: Cone,
  plane: PlaneIcon,
  torus: Donut,

  // ===== Modos de edição =====
  layers: Layers,
  sculpt: Brush,
  brush: Brush,
  uv: Grid3x3,
  bone: Bone,
  animation: Film,
  play: Play,
  'play-circle': PlayCircle,
  pause: Pause,
  key: Key,
  film: Film,

  // ===== Transform =====
  move: Move3d,
  rotate: RotateCw,
  scale: Maximize2,
  'transform': Move3d,

  // ===== Conects — Física =====
  physics: Cog,
  rigid: Box,
  static: Square,
  stop: Octagon,
  personal: User,
  npc: Bot,
  'checkpoint': Flag,
  'target': Target,
  trigger: CircleDot,
  joint: Link2,
  'physics-2': Wrench,

  // ===== Conects — Visual =====
  visual: Palette,
  model: Box,
  light: Lightbulb,
  'light-2': Lightbulb,
  luminous: Sun,
  sky: Cloud,
  'sky-2': Sun,
  particle: Sparkles,
  water: Waves,
  fog: Wind,
  mirror: GitBranch,
  boost: Zap,
  reference: Link,
  navigator: Navigation,
  portal: Compass,
  path: Spline,
  'path-2': MapPin,

  // ===== Conects — Câmara/Áudio =====
  camera: Camera,
  'camera-audio': Camera,
  sound: Volume2,
  'view': Camera,
  'touch-zone': MousePointer2,
  joystick: Joystick,

  // ===== Conects — Ambiente =====
  environment: Mountain,
  terrain: Mountain,
  sun: Sun,
  moon: Cloud,
  wind: Wind,
  cloud: Cloud,
  rain: CloudRain,
  snow: CloudSnow,

  // ===== Conects — UI =====
  ui: Smartphone,
  button: MousePointer2,
  text: Type,
  image: Image,
  panel: PanelBottom,

  // ===== Conects — Gameplay =====
  gameplay: Gamepad2,
  weapon: Sword,
  inventory: PackageCheck,
  item: Gift,
  'game-state': Cpu,
  'game-controller': Gamepad2,

  // ===== Conects — Organização =====
  organization: FolderTree,
  group: Boxes,
  prefab: Package,
  'prefab-instance': Package,
  'roguelike': Dice5,
  'layer': Layers,

  // ===== Status / Feedback =====
  'alert': AlertCircle,
  'check': CheckCircle2,
  'info': Info,
  'warning': AlertCircle,
  'error': AlertCircle,
  'success': CheckCircle2,

  // ===== Debug =====
  terminal: Terminal,
  bug: Bug,
  activity: Activity,
  gauge: Gauge,
  cpu: Cpu,
  database: Database,
  'hard-drive': HardDrive,

  // ===== Diversos =====
  'more-grid': Grid2x2,
  'grid': Grid2x2,
  'scan': Scan,
  'network': Network,
  'workflow': Workflow,
  'share': Share2,
  'git-fork': GitFork,
  'bookmark': Bookmark,
  'star': Star,
  'heart': Heart,
  'bell': Bell,
  'wifi': Wifi,
  'wifi-off': WifiOff,
  'maximize': Maximize,
  'minimize': Minimize,
  'external-link': ExternalLink,
  'hand': Hand,
  'crop': Crop,
  'scissors': Scissors,
  'users': Users,
  'user-plus': UserPlus,
  'map': Map,
  'compass': Compass,
  'droplet': Droplet,
  'droplets': Droplets,
  'thermometer': Thermometer,
  'flame': Flame,
  'snowflake': Snowflake,
  'tree': TreeDeciduous,
  'palm': TreePalm,
  'flower': Flower,
  'leaf': Leaf,
  'car': Car,
  'truck': Truck,
  'ship': Ship,
  'sword': Sword,
  'shield': Shield,
  'coins': Coins,
  'clock': Clock,
  'calendar': Calendar,
  'hourglass': Hourglass,
}

// Fallback para ícones não mapeados (HelpCircle já importado acima)
const FALLBACK_ICON = HelpCircle

/**
 * Componente Icon — renderiza um ícone lucide pelo nome.
 *
 * @param {Object} props
 *   - name: nome do ícone (ex: 'home', 'cube', 'settings')
 *   - size: tamanho em px (default 16)
 *   - color: cor (default 'currentColor')
 *   - strokeWidth: espessura do traço (default 1.8)
 *   - ...props: outras props passadas ao SVG
 */
export function Icon({ name, size = 16, color = 'currentColor', strokeWidth = 1.8, ...props }) {
  const IconComponent = ICON_MAP[name] || FALLBACK_ICON
  return (
    <IconComponent
      size={size}
      color={color}
      strokeWidth={strokeWidth}
      {...props}
    />
  )
}

/**
 * Helper para obter o componente de ícone diretamente (sem JSX).
 * Útil para mapas de ícones (ex: PRIMITIVE_ICONS).
 */
export function getIcon(name) {
  return ICON_MAP[name] || FALLBACK_ICON
}

/**
 * Lista de todos os nomes de ícones disponíveis.
 */
export const ICON_NAMES = Object.keys(ICON_MAP)
