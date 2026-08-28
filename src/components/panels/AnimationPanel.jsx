/**
 * AnimationPanel — painel de animação com timeline.
 *
 * Permite:
 *  - Ver e gerir clips de animação (idle, walk, run, jump)
 *  - Adicionar keyframes para o osso selecionado
 *  - Reproduzir/pausar animação
 *  - Configurar FPS, duração, loop
 *  - S20/Parte D: Animation Layers (pesos + máscaras), Spring Bones
 *    (física secundária) e Motion Values (spring physics persistente)
 */
import { useEffect, useState } from 'react'
import { useStore, useSelectedObject } from '../../store/useStore'
import { IconPlay, IconPause, IconKey, IconBone, IconTrash } from '../ui/Icons'
import {
  getLayerSystem, listLayers, getSpringSystem, listSpringChains,
  getMotionValue, listMotionValues, feedLayerAnimations,
} from '../../utils/animation/animationRuntime'

const DEFAULT_CLIPS = ['idle', 'walk', 'run', 'jump', 'attack']
const MASK_OPTIONS = ['all', 'upper', 'lower', 'arms', 'legs']

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

  // S20/D: estado local das seções avançadas (refresh a 10Hz para valores live)
  const [, setTick] = useState(0)
  const [newLayer, setNewLayer] = useState({ name: 'upper', clipName: 'attack', mode: 'override', mask: 'arms', weight: 1 })
  const [springCfg, setSpringCfg] = useState({ rootBoneName: '', stiffness: 0.5, drag: 0.4, windForce: 0 })
  const [mvCfg, setMvCfg] = useState({ name: '', target: 0, stiffness: 120, damping: 14 })
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 100)
    return () => clearInterval(id)
  }, [])

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
    const firstBone = skeleton.bones[0]
    addKeyframe(selected.id, activeClip, firstBone.id, animation.currentTime, {
      position: [...firstBone.position],
      rotation: [...firstBone.rotation],
      scale: [...firstBone.scale],
    })
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
        </div>
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

      {/* ============ S20/Parte D1: ANIMATION LAYERS ============ */}
      <div className="panel-section">
        <h4>Animation Layers (S20)</h4>
        <div className="small muted mb-2">
          Layers em paralelo com pesos e máscaras por ossos — ex.: base walk + upper body attack.
        </div>
        {/* Adicionar layer */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
          <input className="input" style={{ fontSize: 11 }} placeholder="Nome da layer (ex.: upper)"
            value={newLayer.name} onChange={(e) => setNewLayer({ ...newLayer, name: e.target.value })} />
          <div style={{ display: 'flex', gap: 4 }}>
            <select className="input" style={{ flex: 1, fontSize: 11 }} value={newLayer.clipName}
              onChange={(e) => setNewLayer({ ...newLayer, clipName: e.target.value })}>
              {[...new Set([...DEFAULT_CLIPS, ...Object.keys(animations)])].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <select className="input" style={{ width: 92, fontSize: 11 }} value={newLayer.mode}
              onChange={(e) => setNewLayer({ ...newLayer, mode: e.target.value })}>
              <option value="override">override</option>
              <option value="additive">additive</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <select className="input" style={{ flex: 1, fontSize: 11 }} value={newLayer.mask}
              onChange={(e) => setNewLayer({ ...newLayer, mask: e.target.value })}>
              {MASK_OPTIONS.map((m) => <option key={m} value={m}>máscara: {m}</option>)}
            </select>
            <button className="primary" style={{ fontSize: 11, padding: '4px 10px' }}
              onClick={() => {
                const sys = getLayerSystem(selected.id, () => null, () => null)
                if (sys.getLayer(newLayer.name)) { toast('Layer já existe', 'error'); return }
                sys.addLayer(newLayer)
                feedLayerAnimations(selected.id, animations, () => null)
                toast(`Layer "${newLayer.name}" criada`, 'success')
              }}>+ Layer</button>
          </div>
        </div>
        {/* Listar layers */}
        {(() => {
          const layers = listLayers(selected.id)
          if (layers.length === 0) return <div className="small muted">Sem layers.</div>
          const sys = getLayerSystem(selected.id, () => null, () => null)
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {layers.map((l) => (
                <div key={l.name} style={{ padding: '4px 8px', background: 'var(--bg-panel-2)', borderRadius: 'var(--radius-sm)', fontSize: 11 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <strong style={{ color: l.mode === 'additive' ? '#d63384' : 'var(--accent)' }}>{l.name}</strong>
                    <span className="muted">{l.clipName} · {l.mode} · {l.mask}</span>
                    <span style={{ flex: 1 }} />
                    <button className="danger" style={{ padding: '1px 4px', fontSize: 10 }}
                      onClick={() => { sys.removeLayer(l.name); setTick((t) => t + 1) }}>✕</button>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <span className="muted" style={{ width: 54 }}>peso {l.weight.toFixed(2)}</span>
                    <input type="range" min="0" max="1" step="0.01" value={l.weight} style={{ flex: 1 }}
                      onChange={(e) => { sys.setWeight(l.name, Number(e.target.value)); setTick((t) => t + 1) }} />
                    <button style={{ padding: '1px 6px', fontSize: 10 }}
                      onClick={() => { sys.fadeTo(l.name, l.weight > 0.5 ? 0 : 1, 0.4); setTick((t) => t + 1) }}>fade</button>
                  </div>
                </div>
              ))}
            </div>
          )
        })()}
      </div>

      {/* ============ S20/Parte D2: SPRING BONES ============ */}
      <div className="panel-section">
        <h4>Spring Bones (S20)</h4>
        <div className="small muted mb-2">
          Física secundária para cabelo/caudas/tecidos — verlet com gravidade, vento e rigidez.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
          <input className="input" style={{ fontSize: 11 }} placeholder="Nome do osso raiz (ex.: hair_01)"
            value={springCfg.rootBoneName} onChange={(e) => setSpringCfg({ ...springCfg, rootBoneName: e.target.value })} />
          <div className="prop-row" style={{ margin: 0 }}>
            <label style={{ fontSize: 11 }}>Rigidez: {springCfg.stiffness.toFixed(2)}</label>
            <input type="range" min="0" max="1" step="0.05" value={springCfg.stiffness}
              onChange={(e) => setSpringCfg({ ...springCfg, stiffness: Number(e.target.value) })} />
          </div>
          <div className="prop-row" style={{ margin: 0 }}>
            <label style={{ fontSize: 11 }}>Amortecimento: {springCfg.drag.toFixed(2)}</label>
            <input type="range" min="0" max="0.95" step="0.05" value={springCfg.drag}
              onChange={(e) => setSpringCfg({ ...springCfg, drag: Number(e.target.value) })} />
          </div>
          <div className="prop-row" style={{ margin: 0 }}>
            <label style={{ fontSize: 11 }}>Vento: {springCfg.windForce.toFixed(2)}</label>
            <input type="range" min="0" max="3" step="0.1" value={springCfg.windForce}
              onChange={(e) => setSpringCfg({ ...springCfg, windForce: Number(e.target.value) })} />
          </div>
          <button className="primary" style={{ fontSize: 11 }}
            onClick={() => {
              if (!springCfg.rootBoneName.trim()) { toast('Indica o nome do osso raiz', 'error'); return }
              const sys = getSpringSystem('main')
              if (!sys) { toast('Sistema de spring bones indisponível (sem cena)', 'error'); return }
              const chain = sys.addChain({ rootBoneName: springCfg.rootBoneName.trim(), ...springCfg })
              if (!chain) { toast('Osso não encontrado na cena', 'error'); return }
              sys.setWind({ force: springCfg.windForce })
              toast(`Cadeia "${chain.name}" criada (${chain.bones.length} ossos)`, 'success')
              setTick((t) => t + 1)
            }}>+ Adicionar cadeia</button>
        </div>
        {(() => {
          const chains = listSpringChains('main')
          const sys = getSpringSystem('main')
          if (chains.length === 0) return <div className="small muted">Sem cadeias de spring bones.</div>
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {chains.map((c) => (
                <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', background: 'var(--bg-panel-2)', borderRadius: 'var(--radius-sm)', fontSize: 11 }}>
                  <span style={{ color: '#2a9d8f' }}>◆</span>
                  <span style={{ flex: 1 }}>{c.name} ({c.bones} ossos)</span>
                  <span className="muted">rig {c.stiffness?.toFixed(2)}</span>
                  <button className="danger" style={{ padding: '1px 4px', fontSize: 10 }}
                    onClick={() => { sys.removeChain(c.name); setTick((t) => t + 1) }}>✕</button>
                </div>
              ))}
            </div>
          )
        })()}
      </div>

      {/* ============ S20/Parte D3: MOTION VALUES ============ */}
      <div className="panel-section">
        <h4>Motion Values (S20)</h4>
        <div className="small muted mb-2">
          Valores persistentes com spring physics — interrupções naturais (sem snap).
        </div>
        <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
          <input className="input" style={{ flex: 1, fontSize: 11 }} placeholder="nome (ex.: door)"
            value={mvCfg.name} onChange={(e) => setMvCfg({ ...mvCfg, name: e.target.value })} />
          <button className="primary" style={{ fontSize: 11, padding: '4px 10px' }}
            onClick={() => {
              if (!mvCfg.name.trim()) { toast('Indica um nome', 'error'); return }
              getMotionValue(mvCfg.name.trim(), 0, { stiffness: mvCfg.stiffness, damping: mvCfg.damping })
              toast(`Motion value "${mvCfg.name}" criado`, 'success')
              setTick((t) => t + 1)
            }}>+ MV</button>
        </div>
        {(() => {
          const mvs = listMotionValues()
          if (mvs.length === 0) return <div className="small muted">Sem motion values.</div>
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {mvs.map((mv) => (
                <div key={mv.name} style={{ padding: '4px 8px', background: 'var(--bg-panel-2)', borderRadius: 'var(--radius-sm)', fontSize: 11 }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <strong>{mv.name}</strong>
                    <span className="muted" style={{ flex: 1 }}>
                      valor {mv.value.toFixed(3)} → alvo {mv.target.toFixed(2)} · v {mv.velocity.toFixed(2)}
                      {mv.settled ? ' · ✓' : ''}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 4, marginTop: 2, alignItems: 'center' }}>
                    <input type="range" min="-5" max="5" step="0.05" value={mv.target} style={{ flex: 1 }}
                      onChange={(e) => {
                        getMotionValue(mv.name).to(Number(e.target.value))
                        setTick((t) => t + 1)
                      }} />
                    <button style={{ padding: '1px 6px', fontSize: 10 }}
                      onClick={() => { getMotionValue(mv.name).jump(0); setTick((t) => t + 1) }}>reset</button>
                  </div>
                </div>
              ))}
            </div>
          )
        })()}
      </div>
    </>
  )
}
