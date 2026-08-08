/**
 * FlirEngineLogo — logo vetorial SVG da Flir Engine.
 *
 * Componente reutilizável, nítido em qualquer resolução.
 * Usado no splash screen e no jogo exportado.
 *
 * Props:
 *  - size: número (px) ou string — largura do logo (default 200)
 *  - showText: boolean — mostrar texto "FLIR ENGINE" (default true)
 */
export default function FlirEngineLogo({ size = 200, showText = true }) {
  return (
    <svg
      width={size}
      height={size * (showText ? 1.1 : 0.85)}
      viewBox="0 0 240 264"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block' }}
    >
      <defs>
        {/* Gradiente azul→roxo para o escudo e letra F */}
        <linearGradient id="flirShield" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="50%" stopColor="#5b8def" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
        {/* Gradiente prateado para FLIR */}
        <linearGradient id="flirSilver" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f3f4f6" />
          <stop offset="50%" stopColor="#e5e7eb" />
          <stop offset="100%" stopColor="#9ca3af" />
        </linearGradient>
        {/* Gradiente para linha horizontal */}
        <linearGradient id="flirLine" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0" />
          <stop offset="50%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
        </linearGradient>
        {/* Sombra 3D subtil para a letra F */}
        <filter id="flirShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#000" floodOpacity="0.4" />
        </filter>
        {/* Filtro para brilho do escudo */}
        <filter id="flirGlow" x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* ===== Escudo/Hexágono com contorno em gradiente ===== */}
      <g filter="url(#flirGlow)">
        {/* Hexágono exterior (contorno) */}
        <path
          d="M120 18 L198 56 L198 152 L120 190 L42 152 L42 56 Z"
          stroke="url(#flirShield)"
          strokeWidth="3"
          fill="none"
          strokeLinejoin="round"
        />
        {/* Hexágono interior (preenchimento subtil) */}
        <path
          d="M120 28 L188 61 L188 147 L120 180 L52 147 L52 61 Z"
          stroke="url(#flirShield)"
          strokeWidth="1.5"
          fill="#0a0e1a"
          fillOpacity="0.6"
          strokeLinejoin="round"
        />
      </g>

      {/* ===== Letra F estilizada e angular ===== */}
      <g filter="url(#flirShadow)">
        {/* F — corpo principal */}
        <path
          d="M88 68 L88 142 L100 142 L100 112 L128 112 L128 100 L100 100 L100 80 L132 80 L132 68 Z"
          fill="url(#flirShield)"
        />
        {/* Chanfro 3D — borda superior clara */}
        <path
          d="M88 68 L132 68 L132 73 L88 73 Z"
          fill="#ffffff"
          fillOpacity="0.3"
        />
        {/* Chanfro 3D — borda esquerda escura */}
        <path
          d="M88 68 L93 68 L93 142 L88 142 Z"
          fill="#000"
          fillOpacity="0.2"
        />
      </g>

      {showText && (
        <>
          {/* ===== "FLIR" em letras grandes ===== */}
          <g>
            {/* F */}
            <rect x="52" y="205" width="8" height="28" fill="url(#flirSilver)" />
            <rect x="52" y="205" width="18" height="7" fill="url(#flirSilver)" />
            <rect x="52" y="218" width="15" height="6" fill="url(#flirSilver)" />
            {/* L */}
            <rect x="78" y="205" width="8" height="28" fill="url(#flirSilver)" />
            <rect x="78" y="226" width="16" height="7" fill="url(#flirSilver)" />
            {/* I — ponto substituído por triângulo roxo */}
            <rect x="103" y="213" width="7" height="20" fill="url(#flirSilver)" />
            {/* Triângulo/seta roxo no ponto do I */}
            <path d="M106.5 204 L112 210 L101 210 Z" fill="#8b5cf6" />
            {/* R — vertical bar + bowl + diagonal leg */}
            <rect x="118" y="205" width="7" height="28" fill="url(#flirSilver)" />
            {/* Top of bowl */}
            <rect x="118" y="205" width="14" height="6" fill="url(#flirSilver)" />
            {/* Right side of bowl (top half) */}
            <rect x="125" y="205" width="7" height="12" fill="url(#flirSilver)" />
            {/* Bottom of bowl */}
            <rect x="118" y="211" width="14" height="6" fill="url(#flirSilver)" />
            {/* Diagonal leg of R */}
            <path d="M125 217 L133 233 L141 233 L133 217 Z" fill="url(#flirSilver)" />
          </g>

          {/* ===== "ENGINE" em letras mais pequenas ===== */}
          <g>
            <text
              x="120"
              y="253"
              textAnchor="middle"
              fontSize="13"
              fontWeight="700"
              letterSpacing="4"
              fill="#3b82f6"
              fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Arial, sans-serif"
            >
              ENGINE
            </text>
          </g>

          {/* Linhas horizontais em gradiente de cada lado de ENGINE */}
          <rect x="50" y="248" width="50" height="1.5" fill="url(#flirLine)" />
          <rect x="140" y="248" width="50" height="1.5" fill="url(#flirLine)" />

          {/* ===== Tagline ===== */}
          <text
            x="120"
            y="268"
            textAnchor="middle"
            fontSize="7"
            fontWeight="500"
            letterSpacing="2"
            fill="#6b7280"
            fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Arial, sans-serif"
          >
            MOBILE • WEB • POWERFUL
          </text>
        </>
      )}
    </svg>
  )
}
