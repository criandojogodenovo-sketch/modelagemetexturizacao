/**
 * GameSplash — ecrã splash inicial mostrado ao executar o jogo.
 *
 * Mostra "Feito com Flir Engine" durante 2 segundos antes de o jogo começar.
 */
import { useState, useEffect } from 'react'

export default function GameSplash({ onDone }) {
  const [opacity, setOpacity] = useState(0)

  useEffect(() => {
    // Fade in
    const t1 = setTimeout(() => setOpacity(1), 50)
    // Fade out após 1.5s
    const t2 = setTimeout(() => setOpacity(0), 1500)
    // Done após 2s
    const t3 = setTimeout(() => onDone?.(), 2000)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [onDone])

  return (
    <div
      className="game-splash"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: '#0d1117',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 20,
        opacity,
        transition: 'opacity 0.4s ease',
      }}
    >
      <div style={{ fontSize: 64, animation: 'pulse 1.5s ease-in-out infinite' }}></div>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{
          margin: 0,
          fontSize: 32,
          fontWeight: 700,
          background: 'linear-gradient(135deg, #2f81f7, #8957e5)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}>
          Flir Engine
        </h1>
        <p style={{
          margin: '8px 0 0 0',
          fontSize: 14,
          color: '#8b949e',
          letterSpacing: 2,
          textTransform: 'uppercase',
        }}>
          Feito com Flir Engine
        </p>
      </div>
      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 0.8; }
          50% { transform: scale(1.1); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
