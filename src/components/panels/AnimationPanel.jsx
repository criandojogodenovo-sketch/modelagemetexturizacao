/**
 * AnimationPanel — painel de animação com timeline.
 *
 * Permite:
 *  - Ver e gerir clips de animação (idle, walk, run, jump)
 *  - Selecionar um osso específico para animar
 *  - Adicionar keyframes para o osso selecionado (ou todos)
 *  - Ver keyframes por osso na timeline
 *  - Reproduzir/pausar animação
 *  - Configurar FPS, duração, loop
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
  const selectedBoneId = useStore((s) => s.selectedBoneId)
  const selectBone = useStore((s) => s.selectBone)
  const clearBoneSelection = useStore((s) => s.clearBoneSelection)
  const setMode = useStore((s) => s.setMode)

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

  // Osso selecionado (do store global)
  const selectedBone = skeleton?.bones?.find(b => b.id === selectedBoneId) || null

  const handleAddKeyframe = () => {
    if (!skeleton || skeleton.bones.length === 0) {
      toast('Adicione um osso primeiro', 'error')
      return
    }
    if (selectedBone) {
      // Gravar keyframe SÓ para o osso selecionado
      addKeyframe(selected.id, activeClip, selectedBone.id, animation.currentTime, {
        position: [...selectedBone.position],
        rotation: [...selectedBone.rotation],
        scale: [...selectedBone.scale],
      })
      toast(`Keyframe gravado para "${selectedBone.name || selectedBone.id.slice(-6)}" no tempo ${animation.currentTime.toFixed(1)}`, 'success')
    } else {
      // Sem osso selecionado — gravar para todos
      for (const bone of skeleton.bones) {
        addKeyframe(selected.id, activeClip, bone.id, animation.currentTime, {
          position: [...bone.position],
          rotation: [...bone.rotation],
          scale: [...bone.scale],
        })
      }
      toast(`${skeleton.bones.length} keyframes adicionados (todos os ossos) no tempo ${animation.currentTime.toFixed(1)}`, 'success')
    }
  }

  // Ativar modo animate quando o painel abre
  // (apenas se não estiver já em modo animate/rig/weight)
  // — feito via setMode no useEffect abaixo seria melhor, mas para simplicidade
  //   deixamos o utilizador ativar manualmente via botão "Animar"

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

        {/* Botão para ativar modo de animação (permite mover osso com gizmo) */}
        {skeleton && skeleton.bones.length > 0 && (
          <button
            onClick={() => setMode('animate')}
            style={{ width: '100%', marginTop: 4 }}
            className={useStore.getState().mode === 'animate' ? 'active' : ''}
            title="Ativa o gizmo de transformação nos ossos. Clica num osso no viewport ou na lista abaixo para o selecionar."
          >
            🎬 Modo Animar
          </button>
        )}

        {skeleton && skeleton.bones.length > 0 && (
          <div className="mt-2" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {skeleton.bones.map((bone, i) => {
              const isSelected = bone.id === selectedBoneId
              const boneKfs = keyframes.filter(k => k.boneId === bone.id)
              return (
                <div
                  key={bone.id}
                  onClick={() => selectBone(isSelected ? null : bone.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 8px',
                    background: isSelected ? 'var(--accent-soft)' : 'var(--bg-panel-2)',
                    border: isSelected ? '1px solid var(--accent)' : '1px solid transparent',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: 11,
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ color: isSelected ? 'var(--accent)' : '#f4a261' }}>
                    {isSelected ? '▶' : '●'}
                  </span>
                  <span style={{ flex: 1 }}>
                    {bone.name || `Osso ${i + 1}`}
                    {boneKfs.length > 0 && (
                      <span style={{ color: 'var(--text-muted)', marginLeft: 4 }}>
                        ({boneKfs.length} kf)
                      </span>
                    )}
                  </span>
                  <button
                    className="danger"
                    style={{ padding: '2px 4px' }}
                    onClick={(e) => {
                      e.stopPropagation()
                      useStore.getState().removeBone(selected.id, bone.id)
                      if (isSelected) clearBoneSelection()
                    }}
                  >
                    <IconTrash width={11} height={11} />
                  </button>
                </div>
              )
            })}
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

        {/* Info do osso selecionado */}
        {selectedBone ? (
          <div className="small muted mb-2" style={{
            padding: '6px 8px',
            background: 'var(--accent-soft)',
            border: '1px solid var(--accent)',
            borderRadius: 'var(--radius-sm)',
          }}>
            <strong style={{ color: 'var(--accent)' }}>▶ {selectedBone.name || selectedBone.id.slice(-6)}</strong>
            <div style={{ fontSize: 10, marginTop: 2 }}>
              Pos: [{selectedBone.position.map(v => v.toFixed(2)).join(', ')}]
            </div>
            <div style={{ fontSize: 10 }}>
              Rot: [{selectedBone.rotation.map(v => (v * 180 / Math.PI).toFixed(0) + '°').join(', ')}]
            </div>
            <div style={{ fontSize: 10, marginTop: 2, color: 'var(--text-muted)' }}>
              💡 Move o osso com o gizmo e depois carrega em "Gravar Keyframe"
            </div>
          </div>
        ) : (
          <div className="small muted mb-2">
            💡 Seleciona um osso (na lista acima ou no viewport) para gravar keyframes individuais.
            Sem osso selecionado, grava para todos.
          </div>
        )}

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
            title={selectedBone ? `Gravar keyframe para ${selectedBone.name} no tempo ${animation.currentTime.toFixed(1)}` : 'Gravar keyframe para todos os ossos'}
            style={{ flex: 1 }}
          >
            <IconKey width={14} height={14} /> Gravar Keyframe
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
