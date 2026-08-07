/**
 * AnimationStudio — aba dedicada a animação com todos os recursos.
 *
 * Funcionalidades:
 *  - Upload de animações FBX (com parse de skeletal animation)
 *  - Criar animações por keyframes (sistema existente)
 *  - Controlador de Animação (máquina de estados)
 *  - Timeline com play/pause/keyframes
 *  - Lista de clips de animação
 *  - Aplicar animação a PersonalObject/NpcObject
 *  - Guardar animações no projeto (IndexedDB + localStorage)
 *
 * Acessível via botão na TopBar.
 */
import { useState, useRef, useEffect } from 'react'
import { useStore, useSelectedObject } from '../../store/useStore'
import { IconClose, IconPlay, IconPause, IconKey, IconBone, IconTrash, IconPlus } from '../ui/Icons'
import { fileToArrayBuffer } from '../../utils/helpers'

// Parser simples para FBX — usa FBXLoader do three.js
async function parseFBX(arrayBuffer) {
  const THREE = await import('three')
  const { FBXLoader } = await import('three/examples/jsm/loaders/FBXLoader.js')
  const loader = new FBXLoader()
  const object = loader.parse(arrayBuffer, '')
  // Extrair animações
  const animations = {}
  if (object.animations && object.animations.length > 0) {
    for (const clip of object.animations) {
      animations[clip.name || 'anim'] = {
        duration: clip.duration,
        tracks: clip.tracks.map((t) => ({
          name: t.name,
          type: t.ValueTypeName || 'number',
          times: Array.from(t.times),
          values: Array.from(t.values),
        })),
        fps: 30,
      }
    }
  }
  return { object, animations }
}

export default function AnimationStudio({ onClose }) {
  const selected = useSelectedObject()
  const animation = useStore((s) => s.animation)
  const setAnimation = useStore((s) => s.setAnimation)
  const playAnimation = useStore((s) => s.playAnimation)
  const pauseAnimation = useStore((s) => s.pauseAnimation)
  const addKeyframe = useStore((s) => s.addKeyframe)
  const removeKeyframe = useStore((s) => s.removeKeyframe)
  const addBone = useStore((s) => s.addBone)
  const removeBone = useStore((s) => s.removeBone)
  const updateBone = useStore((s) => s.updateBone)
  const toast = useStore((s) => s.toast)
  const fileInputRef = useRef()

  const [activeTab, setActiveTab] = useState('clips') // clips | keyframes | controller | fbx

  if (!selected) {
    return (
      <>
        {onClose && <div className="drawer-backdrop show" onClick={onClose} />}
        <aside className={`anim-studio ${onClose ? 'open' : ''}`}>
          <div className="panel-header">
            <span>🏃 Estúdio de Animação</span>
            {onClose && <button className="icon" onClick={onClose}><IconClose width={14} height={14} /></button>}
          </div>
          <div className="panel-body">
            <div className="empty-state">
              <div style={{ fontSize: 32, opacity: 0.4 }}>🏃</div>
              <div className="mt-2">Seleciona um objeto para animar.</div>
            </div>
          </div>
        </aside>
      </>
    )
  }

  const skeleton = selected.skeleton
  const animations = selected.animations || {}
  const activeClip = animation.activeClip
  const keyframes = animations[activeClip] || []

  const handleUploadFBX = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.fbx')) {
      toast('Apenas ficheiros .fbx são suportados', 'error')
      return
    }
    toast('A importar FBX...', 'info')
    try {
      const buffer = await fileToArrayBuffer(file)
      const { animations: fbxAnimations } = await parseFBX(buffer)
      if (Object.keys(fbxAnimations).length === 0) {
        toast('FBX sem animações', 'warning')
        return
      }
      // Adicionar animações ao objeto selecionado
      const newAnimations = { ...animations, ...fbxAnimations }
      useStore.getState().updateObject(selected.id, { animations: newAnimations })
      toast(`${Object.keys(fbxAnimations).length} animação(ões) importada(s) do FBX`, 'success')
    } catch (err) {
      toast('Erro ao importar FBX: ' + err.message, 'error')
    }
    e.target.value = ''
  }

  const handleAddKeyframe = () => {
    const bone = skeleton?.bones?.[0]
    addKeyframe(selected.id, activeClip, bone?.id || 'object', animation.currentTime, {
      position: bone ? [...bone.position] : [...selected.position],
      rotation: bone ? [...bone.rotation] : [...selected.rotation],
      scale: bone ? [...bone.scale] : [...selected.scale],
    })
  }

  return (
    <>
      {onClose && <div className="drawer-backdrop show" onClick={onClose} />}
      <aside className={`anim-studio ${onClose ? 'open' : ''}`}>
        <div className="panel-header">
          <span>🏃 Estúdio de Animação</span>
          {onClose && <button className="icon" onClick={onClose}><IconClose width={14} height={14} /></button>}
        </div>

        {/* Tabs */}
        <div className="tabs-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          <button className={`tab-btn ${activeTab === 'clips' ? 'active' : ''}`} onClick={() => setActiveTab('clips')}>
            <span>Clips</span>
          </button>
          <button className={`tab-btn ${activeTab === 'keyframes' ? 'active' : ''}`} onClick={() => setActiveTab('keyframes')}>
            <span>Keyframes</span>
          </button>
          <button className={`tab-btn ${activeTab === 'controller' ? 'active' : ''}`} onClick={() => setActiveTab('controller')}>
            <span>Controlador</span>
          </button>
          <button className={`tab-btn ${activeTab === 'fbx' ? 'active' : ''}`} onClick={() => setActiveTab('fbx')}>
            <span>Import FBX</span>
          </button>
        </div>

        <div className="panel-body">
          {/* Info do objeto */}
          <div className="panel-section">
            <div className="small muted">
              Objeto: <strong>{selected.name}</strong> ({selected.type})
            </div>
          </div>

          {activeTab === 'clips' && (
            <div className="panel-section">
              <h4>Clips de Animação</h4>
              <div className="row" style={{ gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
                {['idle', 'walk', 'run', 'jump', 'attack'].map((clip) => (
                  <button
                    key={clip}
                    className={activeClip === clip ? 'active' : ''}
                    onClick={() => setAnimation({ activeClip: clip, currentTime: 0 })}
                    style={{ fontSize: 10, padding: '4px 8px' }}
                  >
                    {clip}
                  </button>
                ))}
              </div>
              <div className="small muted">
                Clip ativo: <strong>{activeClip}</strong> — {keyframes.length} keyframe(s)
              </div>
            </div>
          )}

          {activeTab === 'keyframes' && (
            <>
              <div className="panel-section">
                <h4>Esqueleto (Rigging)</h4>
                <button onClick={() => addBone(selected.id, [0, 0.5, 0])} style={{ width: '100%' }}>
                  <IconBone width={14} height={14} /> Adicionar Osso
                </button>
                {skeleton?.bones?.length > 0 && (
                  <div className="mt-2" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {skeleton.bones.map((bone, i) => (
                      <div key={bone.id} className="outliner-item">
                        <span style={{ color: 'var(--accent)' }}>●</span>
                        <span style={{ flex: 1 }}>{bone.name || `Osso ${i + 1}`}</span>
                        <button className="danger icon" style={{ padding: '2px 4px' }}
                          onClick={() => removeBone(selected.id, bone.id)}>
                          <IconTrash width={11} height={11} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="panel-section">
                <h4>Timeline — {activeClip}</h4>
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
                  <button onClick={handleAddKeyframe} title="Adicionar keyframe">
                    <IconKey width={14} height={14} /> Key
                  </button>
                </div>
                <div className="prop-row">
                  <label>Tempo: {animation.currentTime.toFixed(1)} / {animation.duration}</label>
                  <input type="range" min="0" max={animation.duration} step={1 / animation.fps}
                    value={animation.currentTime}
                    onChange={(e) => setAnimation({ currentTime: Number(e.target.value) })} />
                </div>
                <div className="prop-row">
                  <label>Duração: {animation.duration} frames</label>
                  <input type="range" min="10" max="240" step="10"
                    value={animation.duration}
                    onChange={(e) => setAnimation({ duration: Number(e.target.value) })} />
                </div>
                <div className="prop-row">
                  <label>FPS: {animation.fps}</label>
                  <input type="range" min="12" max="60" step="6"
                    value={animation.fps}
                    onChange={(e) => setAnimation({ fps: Number(e.target.value) })} />
                </div>
                <label className="checkbox-row mt-2">
                  <input type="checkbox" checked={animation.loop}
                    onChange={(e) => setAnimation({ loop: e.target.checked })} />
                  Repetir em loop
                </label>
              </div>

              {keyframes.length > 0 && (
                <div className="panel-section">
                  <h4>Keyframes ({keyframes.length})</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {keyframes.map((kf) => (
                      <div key={kf.id} className="outliner-item">
                        <IconKey width={12} height={12} />
                        <span style={{ flex: 1 }}>t={kf.time.toFixed(1)}</span>
                        <button className="danger icon" style={{ padding: '2px 4px' }}
                          onClick={() => removeKeyframe(selected.id, activeClip, kf.id)}>
                          <IconTrash width={11} height={11} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {activeTab === 'controller' && (
            <div className="panel-section">
              <h4>Controlador de Animação</h4>
              <div className="small muted mb-2">
                Máquina de estados que mistura animações automaticamente conforme as condições.
              </div>
              {selected.animationController ? (
                <div className="small muted">
                  <div>Estados: {selected.animationController.states?.length || 0}</div>
                  <div>Transições: {selected.animationController.transitions?.length || 0}</div>
                </div>
              ) : (
                <div className="small muted mb-2">Sem controlador. Cria um via ⋯ → Controlador de Animação.</div>
              )}
              <button
                style={{ width: '100%', marginTop: 8 }}
                onClick={() => useStore.getState().openAnimController(selected.id)}
              >
                Abrir Editor de Controlador
              </button>
            </div>
          )}

          {activeTab === 'fbx' && (
            <div className="panel-section">
              <h4>Importar Animação FBX</h4>
              <div className="small muted mb-2">
                Importa animações de um ficheiro .fbx. As animações serão adicionadas ao objeto selecionado
                e poderão ser usadas no Controlador de Animação ou via FlirScript.
              </div>
              <div className="file-input-wrap">
                <button onClick={() => fileInputRef.current?.click()}>
                  📁 Carregar ficheiro .fbx
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".fbx"
                  style={{ display: 'none' }}
                  onChange={handleUploadFBX}
                />
              </div>
              {Object.keys(animations).length > 0 && (
                <div className="mt-2">
                  <h4>Animações no objeto:</h4>
                  {Object.entries(animations).map(([name, clip]) => (
                    <div key={name} className="outliner-item">
                      <span style={{ flex: 1 }}>{name}</span>
                      <span className="small muted">
                        {clip.tracks?.length || clip.length || '?'} tracks · {clip.duration?.toFixed(1) || '?'}s
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </aside>
    </>
  )
}
