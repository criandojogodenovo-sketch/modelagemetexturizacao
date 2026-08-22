/**
 * Timeline — barra de timeline fixa em baixo do ecrã.
 *
 * Mostra:
 *  - Controlos: play/pause, tempo atual, duração, loop
 *  - Faixas (tracks) coloridas por osso, com a selecionada destacada
 *  - Barra de progresso (clique para posicionar)
 *  - Marcadores de keyframes do clip ativo
 *  - Seletor de clip
 *  - Fase 7 — Seletor de interpolação (linear, ease-in, ease-out, ease-in-out)
 *
 * Aparece sempre que há um objeto selecionado com skeleton ou animações.
 * Em mobile, ocupa largura total; em desktop, ocupa o centro.
 */
import { useStore, useSelectedObject } from '../../store/useStore'
import { IconPlay, IconPause, IconKey } from '../ui/Icons'
import { useRef, useState, useMemo } from 'react'

const DEFAULT_CLIPS = ['idle', 'walk', 'run', 'jump', 'attack']

// Fase 7 — Modos de interpolação para keyframes
const INTERPOLATION_MODES = [
  { id: 'linear', label: 'Linear', icon: '─' },
  { id: 'easeIn', label: 'Ease In', icon: '◐' },
  { id: 'easeOut', label: 'Ease Out', icon: '◑' },
  { id: 'easeInOut', label: 'Ease In-Out', icon: '◐◑' },
]

// Cores para faixas (ciclo)
const TRACK_COLORS = [
  '#3b82f6', // azul
  '#10b981', // verde
  '#f59e0b', // amarelo
  '#ef4444', // vermelho
  '#8b5cf6', // roxo
  '#ec4899', // rosa
  '#06b6d4', // cyan
  '#84cc16', // lime
]

export default function Timeline() {
  const selected = useSelectedObject()
  const animation = useStore((s) => s.animation)
  const setAnimation = useStore((s) => s.setAnimation)
  const playAnimation = useStore((s) => s.playAnimation)
  const pauseAnimation = useStore((s) => s.pauseAnimation)
  const addKeyframe = useStore((s) => s.addKeyframe)
  const trackRef = useRef(null)
  const [selectedBoneId, setSelectedBoneId] = useState(null)
  // Fase 7 — Modo de interpolação ativo para novos keyframes
  const [interpolation, setInterpolation] = useState('easeInOut')

  if (!selected) return null
  const hasSkeleton = selected.skeleton && selected.skeleton.bones.length > 0
  if (!hasSkeleton) return null

  const activeClip = animation.activeClip
  const allKeyframes = selected.animations?.[activeClip] || []

  // Agrupar keyframes por osso
  const keyframesByBone = useMemo(() => {
    const map = new Map()
    for (const kf of allKeyframes) {
      if (!map.has(kf.boneId)) map.set(kf.boneId, [])
      map.get(kf.boneId).push(kf)
    }
    return map
  }, [allKeyframes])

  const bones = selected.skeleton.bones
  const progress = animation.duration > 0 ? animation.currentTime / animation.duration : 0

  const handleTrackClick = (e) => {
    const rect = trackRef.current.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const newTime = Math.max(0, Math.min(animation.duration, x * animation.duration))
    setAnimation({ currentTime: newTime })
  }

  const handleTrackClickBone = (e, boneId) => {
    setSelectedBoneId(boneId)
    // Click na faixa posiciona o cursor
    const rect = e.currentTarget.getBoundingClientRect()
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
            const targetBone = selectedBoneId
              ? selected.skeleton.bones.find(b => b.id === selectedBoneId)
              : selected.skeleton.bones[0]
            if (targetBone) {
              addKeyframe(selected.id, activeClip, targetBone.id, animation.currentTime, {
                position: [...targetBone.position],
                rotation: [...targetBone.rotation],
                scale: [...targetBone.scale],
                interpolation, // Fase 7 — passa o modo de interpolação
              })
            }
          }}
          title="Adicionar keyframe no osso selecionado"
        >
          <IconKey width={14} height={14} />
        </button>
        <div className="timeline-time">
          {animation.currentTime.toFixed(1)} / {animation.duration}
        </div>
        {/* Fase 7 — Seletor de interpolação */}
        <select
          value={interpolation}
          onChange={(e) => setInterpolation(e.target.value)}
          title="Modo de interpolação para novos keyframes"
          style={{ width: 'auto', maxWidth: 80, fontSize: 10 }}
        >
          {INTERPOLATION_MODES.map(mode => (
            <option key={mode.id} value={mode.id}>
              {mode.icon} {mode.label}
            </option>
          ))}
        </select>
      </div>

      {/* Faixas por osso — cada uma com cor distinta */}
      <div className="timeline-tracks-list">
        {bones.slice(0, 8).map((bone, idx) => {
          const kfs = keyframesByBone.get(bone.id) || []
          const color = TRACK_COLORS[idx % TRACK_COLORS.length]
          const isSelected = selectedBoneId === bone.id
          return (
            <div
              key={bone.id}
              className={`timeline-track-row ${isSelected ? 'selected' : ''}`}
              onClick={(e) => handleTrackClickBone(e, bone.id)}
              style={{
                '--track-color': color,
                borderLeftColor: isSelected ? color : 'transparent',
                background: isSelected ? `${color}1a` : (idx % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent'),
              }}
            >
              <div className="timeline-track-label" style={{ color }}>
                {bone.name?.slice(0, 8) || bone.id.slice(0, 6)}
              </div>
              <div className="timeline-track-bar">
                {kfs.map((kf) => {
                  const kfp = animation.duration > 0 ? kf.time / animation.duration : 0
                  return (
                    <div
                      key={kf.id}
                      className="timeline-keyframe"
                      style={{
                        left: `${kfp * 100}%`,
                        background: color,
                        borderColor: isSelected ? '#fff' : color,
                      }}
                      title={`t=${kf.time.toFixed(1)}`}
                    />
                  )
                })}
                {/* Cursor só na faixa selecionada */}
                {isSelected && (
                  <div
                    className="timeline-cursor"
                    style={{ left: `${progress * 100}%` }}
                  />
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Barra de progresso global (click para posicionar) */}
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
        {/* Fase 11 — Controles profissionais de animação */}
        <select
          value={animation.speed || 1}
          onChange={(e) => setAnimation({ speed: Number(e.target.value) })}
          title="Velocidade de reprodução"
          style={{ width: 'auto', maxWidth: 60, fontSize: 10 }}
        >
          <option value={0.25}>0.25x</option>
          <option value={0.5}>0.5x</option>
          <option value={1}>1x</option>
          <option value={1.5}>1.5x</option>
          <option value={2}>2x</option>
        </select>
        <button
          onClick={() => setAnimation({ currentTime: 0 })}
          title="Ir para início"
          style={{ padding: '2px 4px', fontSize: 10 }}
        >⏮</button>
        <button
          onClick={() => setAnimation({ currentTime: Math.max(0, animation.currentTime - 0.5) })}
          title="Recuar 0.5s"
          style={{ padding: '2px 4px', fontSize: 10 }}
        >◀</button>
        <button
          onClick={() => setAnimation({ currentTime: Math.min(animation.duration, animation.currentTime + 0.5) })}
          title="Avançar 0.5s"
          style={{ padding: '2px 4px', fontSize: 10 }}
        >▶</button>
        <button
          onClick={() => setAnimation({ currentTime: animation.duration })}
          title="Ir para fim"
          style={{ padding: '2px 4px', fontSize: 10 }}
        >⏭</button>
      </div>
    </div>
  )
}
