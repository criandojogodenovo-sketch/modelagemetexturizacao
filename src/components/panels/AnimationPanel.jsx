/**
 * AnimationPanel — painel de animação com timeline.
 *
 * Permite:
 *  - Ver e gerir clips de animação (idle, walk, run, jump)
 *  - Adicionar keyframes para o osso selecionado
 *  - Reproduzir/pausar animação
 *  - Configurar FPS, duração, loop
 *
 * A timeline é uma barra fixa em baixo do ecrã (renderizada em App.jsx).
 * Este painel mostra os controlos detalhados.
 */
import { useStore, useSelectedObject } from '../../store/useStore'
import { IconPlay, IconPause, IconKey, IconBone, IconTrash } from '../ui/Icons'

const DEFAULT_CLIPS = ['idle', 'walk', 'run', 'jump', 'attack']

export default function AnimationPanel() {
  const selected = useSelectedObject()
  const animation = useStore((s) => s.animation)
  const setAnimation = useStore((s) => s.setAnimation)
  const playAnimation = useStore((s) => s.playAnimation)
  const pauseAnimation = useStore((s) => s.pauseAnimation)
  const addBone = useStore((s) => s.addBone)
  const addKeyframe = useStore((s) => s.addKeyframe)
  const removeKeyframe = useStore((s) => s.removeKeyframe)
  const toast = useStore((s) => s.toast)

  if (!selected) {
    return (
      <div className="empty-state">
        <div>Selecione um objeto para animar.</div>
      </div>
    )
  }

  const skeleton = selected.skeleton
  const animations = selected.animations || {}
  const activeClip = animation.activeClip
  const keyframes = animations[activeClip] || []

  const handleAddKeyframe = () => {
    if (!skeleton || skeleton.bones.length === 0) {
      toast('Adicione um osso primeiro', 'error')
      return
    }
    // Adicionar keyframe para TODOS os ossos no tempo atual
    for (const bone of skeleton.bones) {
      addKeyframe(selected.id, activeClip, bone.id, animation.currentTime, {
        position: [...bone.position],
        rotation: [...bone.rotation],
        scale: [...bone.scale],
      })
    }
    toast(`${skeleton.bones.length} keyframes adicionados (todos os ossos) no tempo ${animation.currentTime.toFixed(1)}`, 'success')
  }

  return (
    <>
      <div className="panel-section">
        <h4>Esqueleto (Rigging)</h4>
        {skeleton && skeleton.bones.length > 0 ? (
          <div className="small muted mb-2">
            {skeleton.bones.length} osso(s) no esqueleto.
          </div>
        ) : (
          <div className="small muted mb-2">
            Sem esqueleto. Adicione ossos para animar o objeto.
          </div>
        )}
        <button
          onClick={() => addBone(selected.id, [0, 0.5, 0])}
          style={{ width: '100%' }}
        >
          <IconBone width={14} height={14} /> Adicionar Osso
        </button>
        {skeleton && skeleton.bones.length > 0 && (
          <div className="mt-2" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {skeleton.bones.map((bone, i) => (
              <div
                key={bone.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 8px',
                  background: 'var(--bg-panel-2)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 11,
                }}
              >
                <span style={{ color: 'var(--accent)' }}>●</span>
                <span style={{ flex: 1 }}>{bone.name || `Osso ${i + 1}`}</span>
                <button
                  className="danger"
                  style={{ padding: '2px 4px' }}
                  onClick={() => useStore.getState().removeBone(selected.id, bone.id)}
                >
                  <IconTrash width={11} height={11} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="panel-section">
        <h4>Clips de Animação</h4>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
          {DEFAULT_CLIPS.map((clip) => (
            <button
              key={clip}
              onClick={() => setAnimation({ activeClip: clip, currentTime: 0 })}
              className={activeClip === clip ? 'active' : ''}
              style={{
                padding: '4px 8px',
                fontSize: 11,
                background: activeClip === clip ? 'var(--accent-soft)' : 'var(--bg-elevated)',
                border: activeClip === clip ? '1px solid var(--accent)' : '1px solid var(--border)',
                color: activeClip === clip ? 'var(--accent)' : 'var(--text-secondary)',
              }}
            >
              {clip}
            </button>
          ))}
        </div>
        <div className="small muted">
          Clip ativo: <strong>{activeClip}</strong> — {keyframes.length} keyframe(s)
          ({new Set(keyframes.map(k => k.boneId)).size} ossos animados)
        </div>

        {/* Lista de keyframes por osso */}
        {keyframes.length > 0 && skeleton && (
          <div className="mt-2" style={{ maxHeight: 120, overflowY: 'auto' }}>
            {skeleton.bones.map(bone => {
              const boneKfs = keyframes.filter(k => k.boneId === bone.id)
              if (boneKfs.length === 0) return null
              return (
                <div key={bone.id} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 0', fontSize: 10 }}>
                  <span style={{ color: '#f4a261', minWidth: 60 }}>{bone.name || bone.id.slice(-6)}</span>
                  <span style={{ color: 'var(--text-muted)' }}>{boneKfs.length} kf</span>
                  <span style={{ color: 'var(--text-muted)' }}>@ {boneKfs.map(k => k.time.toFixed(1)).join(', ')}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="panel-section">
        <h4>Reprodução</h4>
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          {animation.playing ? (
            <button onClick={pauseAnimation} className="primary" style={{ flex: 1 }}>
              <IconPause width={14} height={14} /> Pausar
            </button>
          ) : (
            <button onClick={playAnimation} className="primary" style={{ flex: 1 }}>
              <IconPlay width={14} height={14} /> Reproduzir
            </button>
          )}
          <button
            onClick={handleAddKeyframe}
            title="Adicionar keyframe no tempo atual"
          >
            <IconKey width={14} height={14} /> Key
          </button>
        </div>

        <div className="prop-row">
          <label>Tempo: {animation.currentTime.toFixed(1)} / {animation.duration}</label>
          <input
            type="range"
            min="0"
            max={animation.duration}
            step={1 / animation.fps}
            value={animation.currentTime}
            onChange={(e) => setAnimation({ currentTime: Number(e.target.value) })}
          />
        </div>

        <div className="prop-row">
          <label>Duração: {animation.duration} frames</label>
          <input
            type="range"
            min="10"
            max="240"
            step="10"
            value={animation.duration}
            onChange={(e) => setAnimation({ duration: Number(e.target.value) })}
          />
        </div>

        <div className="prop-row">
          <label>FPS: {animation.fps}</label>
          <input
            type="range"
            min="12"
            max="60"
            step="6"
            value={animation.fps}
            onChange={(e) => setAnimation({ fps: Number(e.target.value) })}
          />
        </div>

        <label className="checkbox-row mt-2">
          <input
            type="checkbox"
            checked={animation.loop}
            onChange={(e) => setAnimation({ loop: e.target.checked })}
          />
          Repetir em loop
        </label>
      </div>

      {keyframes.length > 0 && (
        <div className="panel-section">
          <h4>Keyframes do Clip "{activeClip}"</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {keyframes.map((kf) => (
              <div
                key={kf.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 8px',
                  background: 'var(--bg-panel-2)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 11,
                }}
              >
                <IconKey width={12} height={12} />
                <span style={{ flex: 1 }}>
                  t={kf.time.toFixed(1)} — osso {kf.boneId?.slice(-4)}
                </span>
                <button
                  className="danger"
                  style={{ padding: '2px 4px' }}
                  onClick={() => removeKeyframe(selected.id, activeClip, kf.id)}
                >
                  <IconTrash width={11} height={11} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
