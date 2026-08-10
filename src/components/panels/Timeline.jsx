/**
 * Timeline — barra de timeline fixa em baixo do ecrã.
 *
 * Mostra:
 *  - Controlos: play/pause, tempo atual, duração, loop
 *  - Barra de progresso (clique para posicionar)
 *  - Marcadores de keyframes do clip ativo
 *  - Seletor de clip
 *
 * Aparece sempre que há um objeto selecionado com skeleton ou animações.
 * Em mobile, ocupa largura total; em desktop, ocupa o centro.
 */
import { useStore, useSelectedObject } from '../../store/useStore'
import { IconPlay, IconPause, IconKey } from '../ui/Icons'
import { useRef } from 'react'

const DEFAULT_CLIPS = ['idle', 'walk', 'run', 'jump', 'attack']

export default function Timeline() {
  const selected = useSelectedObject()
  const animation = useStore((s) => s.animation)
  const setAnimation = useStore((s) => s.setAnimation)
  const playAnimation = useStore((s) => s.playAnimation)
  const pauseAnimation = useStore((s) => s.pauseAnimation)
  const addKeyframe = useStore((s) => s.addKeyframe)
  const trackRef = useRef(null)

  // Loop de animação (requestAnimationFrame)
  // — implementado em App.jsx para evitar múltiplos loops

  if (!selected) return null
  const hasSkeleton = selected.skeleton && selected.skeleton.bones.length > 0
  if (!hasSkeleton) return null

  const activeClip = animation.activeClip
  const keyframes = selected.animations?.[activeClip] || []
  const progress = animation.duration > 0 ? animation.currentTime / animation.duration : 0

  const handleTrackClick = (e) => {
    const rect = trackRef.current.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const newTime = Math.max(0, Math.min(animation.duration, x * animation.duration))
    setAnimation({ currentTime: newTime })
  }

  return (
    <div className="timeline visible">
      <div className="timeline-controls">
        <button
          className="icon primary"
          onClick={animation.playing ? pauseAnimation : playAnimation}
          title={animation.playing ? 'Pausar' : 'Reproduzir'}
        >
          {animation.playing ? <IconPause width={14} height={14} /> : <IconPlay width={14} height={14} />}
        </button>
        <button
          className="icon"
          onClick={() => {
            const firstBone = selected.skeleton.bones[0]
            if (firstBone) {
              addKeyframe(selected.id, activeClip, firstBone.id, animation.currentTime, {
                position: [...firstBone.position],
                rotation: [...firstBone.rotation],
                scale: [...firstBone.scale],
              })
            }
          }}
          title="Adicionar keyframe"
        >
          <IconKey width={14} height={14} />
        </button>
        <div className="timeline-time">
          {animation.currentTime.toFixed(1)} / {animation.duration}
        </div>
      </div>

      <div className="timeline-track-wrap">
        <div
          ref={trackRef}
          className="timeline-track"
          onClick={handleTrackClick}
        >
          <div
            className="timeline-progress"
            style={{ width: `${progress * 100}%` }}
          />
          {keyframes.map((kf) => {
            const kfp = animation.duration > 0 ? kf.time / animation.duration : 0
            return (
              <div
                key={kf.id}
                className="timeline-keyframe"
                style={{ left: `${kfp * 100}%` }}
                title={`t=${kf.time.toFixed(1)}`}
              />
            )
          })}
          <div
            className="timeline-cursor"
            style={{ left: `${progress * 100}%` }}
          />
        </div>
      </div>

      <div className="timeline-clips">
        <select
          value={activeClip}
          onChange={(e) => setAnimation({ activeClip: e.target.value, currentTime: 0 })}
          style={{ width: 'auto', maxWidth: 100 }}
        >
          {DEFAULT_CLIPS.map((clip) => (
            <option key={clip} value={clip}>
              {clip}
            </option>
          ))}
        </select>
        <label className="checkbox-row" style={{ fontSize: 10 }}>
          <input
            type="checkbox"
            checked={animation.loop}
            onChange={(e) => setAnimation({ loop: e.target.checked })}
          />
          Loop
        </label>
      </div>
    </div>
  )
}
