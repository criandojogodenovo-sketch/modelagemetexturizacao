/**
 * Ícones SVG inline (sem dependências externas).
 * Cada ícone é um componente React que aceita props padrão de SVG.
 */

const base = (props) => ({
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  ...props,
})

export const IconCube = (p) => (
  <svg {...base(p)}>
    <path d="M12 2 3 7v10l9 5 9-5V7l-9-5z" />
    <path d="M3 7l9 5 9-5" />
    <path d="M12 12v10" />
  </svg>
)

export const IconSphere = (p) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <ellipse cx="12" cy="12" rx="9" ry="3.5" />
    <path d="M12 3v18" />
  </svg>
)

export const IconCylinder = (p) => (
  <svg {...base(p)}>
    <ellipse cx="12" cy="5" rx="7" ry="2.5" />
    <path d="M5 5v14" />
    <path d="M19 5v14" />
    <ellipse cx="12" cy="19" rx="7" ry="2.5" />
  </svg>
)

export const IconCone = (p) => (
  <svg {...base(p)}>
    <path d="M12 3 4 19" />
    <path d="M12 3l8 16" />
    <ellipse cx="12" cy="19" rx="8" ry="2.5" />
  </svg>
)

export const IconPlane = (p) => (
  <svg {...base(p)}>
    <path d="M3 17 17 3l4 4L7 21z" />
  </svg>
)

export const IconTorus = (p) => (
  <svg {...base(p)}>
    <ellipse cx="12" cy="12" rx="9" ry="5" />
    <ellipse cx="12" cy="12" rx="4" ry="2" />
  </svg>
)

export const IconTranslate = (p) => (
  <svg {...base(p)}>
    <path d="M5 9l-3 3 3 3" />
    <path d="M9 5l3-3 3 3" />
    <path d="M15 19l-3 3-3-3" />
    <path d="M19 9l3 3-3 3" />
    <path d="M2 12h20" />
    <path d="M12 2v20" />
    <circle cx="12" cy="12" r="2" fill="currentColor" />
  </svg>
)

export const IconRotate = (p) => (
  <svg {...base(p)}>
    <path d="M21 12a9 9 0 1 1-3-6.7" />
    <path d="M21 4v5h-5" />
  </svg>
)

export const IconScale = (p) => (
  <svg {...base(p)}>
    <path d="M14 3h7v7" />
    <path d="M21 3l-9 9" />
    <path d="M3 21l6-6" />
    <path d="M3 14v7h7" />
  </svg>
)

export const IconUndo = (p) => (
  <svg {...base(p)}>
    <path d="M9 14L4 9l5-5" />
    <path d="M4 9h11a5 5 0 0 1 0 10H8" />
  </svg>
)

export const IconRedo = (p) => (
  <svg {...base(p)}>
    <path d="M15 14l5-5-5-5" />
    <path d="M20 9H9a5 5 0 0 0 0 10h7" />
  </svg>
)

export const IconTrash = (p) => (
  <svg {...base(p)}>
    <path d="M3 6h18" />
    <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
  </svg>
)

export const IconDuplicate = (p) => (
  <svg {...base(p)}>
    <rect x="8" y="8" width="12" height="12" rx="2" />
    <path d="M4 16V6a2 2 0 0 1 2-2h10" />
  </svg>
)

export const IconVisible = (p) => (
  <svg {...base(p)}>
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)

export const IconHidden = (p) => (
  <svg {...base(p)}>
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
)

export const IconMenu = (p) => (
  <svg {...base(p)}>
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </svg>
)

export const IconClose = (p) => (
  <svg {...base(p)}>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

export const IconPlus = (p) => (
  <svg {...base(p)}>
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
)

export const IconFile = (p) => (
  <svg {...base(p)}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
)

export const IconImport = (p) => (
  <svg {...base(p)}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
)

export const IconExport = (p) => (
  <svg {...base(p)}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
)

export const IconSave = (p) => (
  <svg {...base(p)}>
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
    <polyline points="17 21 17 13 7 13 7 21" />
    <polyline points="7 3 7 8 15 8" />
  </svg>
)

export const IconImage = (p) => (
  <svg {...base(p)}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <polyline points="21 15 16 10 5 21" />
  </svg>
)

export const IconExtrude = (p) => (
  <svg {...base(p)}>
    <path d="M12 2v20" />
    <path d="M5 9l7-7 7 7" />
    <path d="M5 15l7-7 7 7" />
  </svg>
)

export const IconLayers = (p) => (
  <svg {...base(p)}>
    <polygon points="12 2 2 7 12 12 22 7 12 2" />
    <polyline points="2 17 12 22 22 17" />
    <polyline points="2 12 12 17 22 12" />
  </svg>
)

export const IconSettings = (p) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
)

// Mapa de ícones de primitivas (usado pelo painel de ferramentas)
export const PRIMITIVE_ICONS = {
  cube: IconCube,
  sphere: IconSphere,
  cylinder: IconCylinder,
  cone: IconCone,
  plane: IconPlane,
  torus: IconTorus,
}

// ===== Ícones para novas funcionalidades profissionais =====

export const IconEdit = (p) => (
  <svg {...base(p)}>
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
)

export const IconSculpt = (p) => (
  <svg {...base(p)}>
    <path d="M12 19l7-7 3 3-7 7-3-3z" />
    <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
    <path d="M2 2l7.586 7.586" />
    <circle cx="11" cy="11" r="2" />
  </svg>
)

export const IconBrush = (p) => (
  <svg {...base(p)}>
    <path d="M9.06 11.9l8.07-8.06a2.85 2.85 0 1 1 4.03 4.03l-8.06 8.08" />
    <path d="M7.07 14.94c-1.66 0-3 1.35-3 3.02 0 1.33-2.5 1.52-2 2.02 1.08 1.1 2.49 2.02 4 2.02 2.2 0 4-1.8 4-4.04a3.01 3.01 0 0 0-3-3.02z" />
  </svg>
)

export const IconUV = (p) => (
  <svg {...base(p)}>
    <rect x="3" y="3" width="18" height="18" rx="1" />
    <path d="M3 9h18" />
    <path d="M9 3v18" />
    <path d="M3 15h18" />
    <path d="M15 3v18" />
  </svg>
)

export const IconBone = (p) => (
  <svg {...base(p)}>
    <path d="M17 10c.7-.7 1.69-1 2.5-1 .81 0 1.5.69 1.5 1.5 0 .81-.69 1.5-1.5 1.5-.81 0-1.5.69-1.5 1.5 0 .81.69 1.5 1.5 1.5h.5a2 2 0 0 1 2 2c0 1.1-.9 2-2 2-1.1 0-2-.9-2-2v-.5c0-.81-.69-1.5-1.5-1.5-.81 0-1.5.69-1.5 1.5 0 .81-.69 1.5-1.5 1.5-.81 0-1.5-.69-1.5-1.5 0-.81.69-1.5 1.5-1.5.81 0 1.5-.69 1.5-1.5 0-.81-.69-1.5-1.5-1.5H7a2 2 0 0 1-2-2c0-1.1.9-2 2-2 1.1 0 2 .9 2 2v.5c0 .81.69 1.5 1.5 1.5.81 0 1.5-.69 1.5-1.5 0-.81.69-1.5 1.5-1.5.81 0 1.5.69 1.5 1.5" />
  </svg>
)

export const IconAnimation = (p) => (
  <svg {...base(p)}>
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>
)

export const IconPlay = (p) => (
  <svg {...base(p)}>
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>
)

export const IconPause = (p) => (
  <svg {...base(p)}>
    <rect x="6" y="4" width="4" height="16" />
    <rect x="14" y="4" width="4" height="16" />
  </svg>
)

export const IconKey = (p) => (
  <svg {...base(p)}>
    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3" />
  </svg>
)

export const IconSubdivide = (p) => (
  <svg {...base(p)}>
    <path d="M3 3h18v18H3z" />
    <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
  </svg>
)

export const IconMirror = (p) => (
  <svg {...base(p)}>
    <line x1="12" y1="3" x2="12" y2="21" strokeDasharray="2 2" />
    <path d="M3 12h6l-3-3m0 6l3-3" />
    <path d="M21 12h-6l3-3m0 6l-3-3" />
  </svg>
)

export const IconArray = (p) => (
  <svg {...base(p)}>
    <rect x="2" y="8" width="6" height="8" rx="1" />
    <rect x="9" y="8" width="6" height="8" rx="1" />
    <rect x="16" y="8" width="6" height="8" rx="1" />
  </svg>
)

export const IconSolidify = (p) => (
  <svg {...base(p)}>
    <path d="M3 8h18M3 16h18" />
    <rect x="3" y="8" width="18" height="8" />
    <path d="M7 12h10" strokeDasharray="2 2" />
  </svg>
)

export const IconBoolean = (p) => (
  <svg {...base(p)}>
    <circle cx="9" cy="12" r="6" />
    <circle cx="15" cy="12" r="6" />
  </svg>
)

export const IconVertex = (p) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="3" fill="currentColor" />
    <circle cx="4" cy="4" r="2" fill="currentColor" />
    <circle cx="20" cy="4" r="2" fill="currentColor" />
    <circle cx="4" cy="20" r="2" fill="currentColor" />
    <circle cx="20" cy="20" r="2" fill="currentColor" />
  </svg>
)

export const IconEdge = (p) => (
  <svg {...base(p)}>
    <line x1="4" y1="4" x2="20" y2="20" />
    <circle cx="4" cy="4" r="2" fill="currentColor" />
    <circle cx="20" cy="20" r="2" fill="currentColor" />
  </svg>
)

export const IconFace = (p) => (
  <svg {...base(p)}>
    <polygon points="12 3 22 8.5 22 15.5 12 21 2 15.5 2 8.5 12 3" />
    <polygon points="12 3 22 8.5 22 15.5 12 21 2 15.5 2 8.5 12 3" fill="currentColor" fillOpacity="0.2" />
  </svg>
)

export const IconLibrary = (p) => (
  <svg {...base(p)}>
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
  </svg>
)

export const IconCheck = (p) => (
  <svg {...base(p)}>
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

export const IconMoreGrid = (p) => (
  <svg {...base(p)}>
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
)

export const IconBottomBar = (p) => (
  <svg {...base(p)}>
    <rect x="2" y="3" width="20" height="14" rx="2" />
    <line x1="2" y1="14" x2="22" y2="14" />
    <rect x="6" y="20" width="12" height="2" rx="1" />
  </svg>
)

export const IconGroup = (p) => (
  <svg {...base(p)}>
    <rect x="2" y="2" width="8" height="8" rx="1" />
    <rect x="14" y="2" width="8" height="8" rx="1" />
    <rect x="2" y="14" width="8" height="8" rx="1" />
    <rect x="14" y="14" width="8" height="8" rx="1" />
  </svg>
)

export const IconUnwrap = (p) => (
  <svg {...base(p)}>
    <path d="M3 6l9-3 9 3-9 3-9-3z" />
    <path d="M3 6v6l9 3 9-3V6" />
  </svg>
)

