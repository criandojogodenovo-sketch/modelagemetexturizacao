/**
 * GameSplash — ecrã splash oficial da Flir Engine.
 *
 * Mostra o logo SVG centrado no ecrã com fundo escuro (#0a0e1a),
 * animação de entrada (fade in + pop) e fade out antes do jogo começar.
 * Duração: ~2 segundos.
 *
 * Usado tanto no editor como no jogo exportado (HTML standalone).
 */
import { useState, useEffect } from 'react'
import FlirEngineLogo from './FlirEngineLogo'

export default function GameSplash({ onDone }) {
  const [phase, setPhase] = useState('enter') // enter | hold | exit

  useEffect(() => {
    // Fade in (200ms)
    const t1 = setTimeout(() => setPhase('hold'), 200)
    // Manter (1.3s)
    const t2 = setTimeout(() => setPhase('exit'), 1500)
    // Fade out + done (500ms)
    const t3 = setTimeout(() => onDone?.(), 2000)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [onDone])

  const opacity = phase === 'enter' ? 0 : phase === 'exit' ? 0 : 1
  const scale = phase === 'enter' ? 0.85 : phase === 'exit' ? 1.05 : 1

  return (
    <div
      className="game-splash"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: '#0a0e1a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 0,
        opacity,
        transform: `scale(${scale})`,
        transition: 'opacity 0.4s ease, transform 0.4s ease',
      }}
    >
      <FlirEngineLogo size={220} showText={true} />
    </div>
  )
}
