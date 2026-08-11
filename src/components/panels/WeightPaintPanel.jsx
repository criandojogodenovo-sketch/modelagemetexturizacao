/**
 * WeightPaintPanel — sistema de pintura de peso (weight painting).
 *
 * Funcionalidades:
 *  - Pincel para pintar influência de cada osso sobre a malha (0 a 1)
 *  - Visualização em mapa de calor (azul → verde → amarelo → vermelho)
 *  - Auto-peso inicial por proximidade (heat map)
 *  - Suavizar pesos, normalizar (soma = 1)
 *
 * Acedido via LeftPanel → tab "Pintar Peso"
 */
import { useState, useRef, useEffect } from 'react'
import * as THREE from 'three'
import { useStore, useSelectedObject } from '../../store/useStore'
import { IconTrash } from '../ui/Icons'

const BRUSH_MODES = [
  { id: 'paint', label: 'Pintar', icon: '🖌️', desc: 'Aplicar peso' },
  { id: 'smooth', label: 'Suavizar', icon: 'waves', desc: 'Suavizar pesos vizinhos' },
  { id: 'normalize', label: 'Normalizar', icon: '⚖️', desc: 'Garantir soma = 1' },
]

export default function WeightPaintPanel() {
  const selected = useSelectedObject()
  const updateObject = useStore((s) => s.updateObject)
  const toast = useStore((s) => s.toast)
  const [brush, setBrush] = useState({ mode: 'paint', size: 0.3, strength: 0.5 })
  const [activeBoneId, setActiveBoneId] = useState(null)

  // Sync brush/bone state with window for the WeightPaintRaycaster
  useEffect(() => {
    window._weightPaintActiveBone = activeBoneId
    window._weightPaintBrushSize = brush.size
    window._weightPaintBrushStrength = brush.strength
  }, [activeBoneId, brush])

  // Set mode to 'weight' when panel is active
  useEffect(() => {
    const setMode = useStore.getState().setMode
    setMode('weight')
    return () => setMode('object')
  }, [])

  if (!selected) {
    return (
      <div className="panel-section">
        <div className="empty-state small">Seleciona um objeto com esqueleto.</div>
      </div>
    )
  }

  const skeleton = selected.skeleton
  const bones = skeleton?.bones || []
  const skinWeights = selected.skinWeights || {} // { vertexIndex: { boneId: weight } }

  // Auto-peso: calcular pesos por proximidade (heat map simplificado)
  const autoWeight = () => {
    try {
    if (!bones.length) {
      toast('Precisa de esqueleto', 'error')
      return
    }
    toast('A calcular auto-peso...', 'info')
    // Obter posições dos vértices (customGeometry OU primitiva)
    let positions = []
    if (selected.customGeometry) {
      positions = selected.customGeometry.positions || selected.customGeometry.vertices || []
    } else {
      // Para primitivas, gerar posições a partir do tipo
      const PRIMITIVES = {
        cube: () => Array.from(new THREE.BoxGeometry(1,1,1).attributes.position.array),
        sphere: () => Array.from(new THREE.SphereGeometry(0.6,16,12).attributes.position.array),
        cylinder: () => Array.from(new THREE.CylinderGeometry(0.5,0.5,1.2,16).attributes.position.array),
        cone: () => Array.from(new THREE.ConeGeometry(0.6,1.2,16).attributes.position.array),
        plane: () => Array.from(new THREE.PlaneGeometry(1.5,1.5).attributes.position.array),
        torus: () => Array.from(new THREE.TorusGeometry(0.6,0.2,16,32).attributes.position.array),
      }
      const gen = PRIMITIVES[selected.type]
      if (gen) {
        positions = gen()
        // Guardar como customGeometry para uso futuro (normaliza para array regular)
        updateObject(selected.id, { customGeometry: { positions, normals: [], uvs: [] } })
      }
    }
    if (!positions || positions.length === 0) {
      toast('Não foi possível obter geometria', 'error')
      return
    }
    const vertCount = positions.length / 3
    const weights = {}

    for (let v = 0; v < vertCount; v++) {
      const vx = positions[v * 3]
      const vy = positions[v * 3 + 1]
      const vz = positions[v * 3 + 2]

      // Calcular distância a cada osso
      const distances = bones.map((bone, idx) => {
        if (!bone || !bone.position) {
          console.warn('Bone inválido at index', idx, 'bone=', bone)
          return { boneId: bone?.id || null, dist: Infinity }
        }
        const bx = bone.position[0]
        const by = bone.position[1]
        const bz = bone.position[2]
        const dx = vx - bx, dy = vy - by, dz = vz - bz
        return { boneId: bone.id, dist: Math.sqrt(dx * dx + dy * dy + dz * dz) }
      })

      // Ordenar por distância e atribuir pesos (os 4 mais próximos)
      distances.sort((a, b) => a.dist - b.dist)
      const top4 = distances.slice(0, 4)
      const totalDist = top4.reduce((sum, d) => sum + 1 / (d.dist + 0.01), 0)

      weights[v] = {}
      for (const d of top4) {
        weights[v][d.boneId] = (1 / (d.dist + 0.01)) / totalDist
      }
    }

    updateObject(selected.id, { skinWeights: weights })
    toast(`Auto-peso calculado para ${vertCount} vértices`, 'success')
    } catch (err) {
      toast('Erro auto-peso: ' + err.message, 'error')
      console.error('Auto-peso error:', err, { selected, bones, hasSkeleton: !!selected?.skeleton })
    }
  }

  const clearWeights = () => {
    updateObject(selected.id, { skinWeights: {} })
    toast('Pesos limpos', 'info')
  }

  const activeBone = bones.find(b => b.id === activeBoneId)

  return (
    <div className="panel-section">
      <h4>Pintar Peso</h4>

      {/* Selecionar osso ativo */}
      <div className="prop-row">
        <label>Osso ativo</label>
        <select value={activeBoneId || ''} onChange={(e) => setActiveBoneId(e.target.value || null)}>
          <option value="">— Selecionar —</option>
          {bones.map((bone, i) => (
            <option key={bone.id} value={bone.id}>{bone.name || `Osso ${i + 1}`}</option>
          ))}
        </select>
      </div>

      {activeBone && (
        <div className="small muted mb-2">
          Pintando: <strong style={{ color: '#f4a261' }}>{activeBone.name}</strong>
        </div>
      )}

      {/* Modo do pincel */}
      <div className="prop-row">
        <label>Modo</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
          {BRUSH_MODES.map(m => (
            <button
              key={m.id}
              className={brush.mode === m.id ? 'active' : ''}
              onClick={() => setBrush({ ...brush, mode: m.id })}
              style={{ fontSize: 9, padding: '4px 2px', flexDirection: 'column', gap: 2 }}
              title={m.desc}
            >
              <span style={{ fontSize: 14 }}>{m.icon}</span>
              <span>{m.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tamanho do pincel */}
      <div className="prop-row">
        <label>Raio: {brush.size.toFixed(2)}</label>
        <input type="range" min="0.05" max="1" step="0.05" value={brush.size}
          onChange={(e) => setBrush({ ...brush, size: Number(e.target.value) })} />
      </div>

      {/* Força */}
      <div className="prop-row">
        <label>Força: {brush.strength.toFixed(2)}</label>
        <input type="range" min="0.05" max="1" step="0.05" value={brush.strength}
          onChange={(e) => setBrush({ ...brush, strength: Number(e.target.value) })} />
      </div>

      {/* Ações */}
      <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
        <button onClick={autoWeight} style={{ flex: 1 }} title="Calcular pesos automáticos por proximidade">Auto-peso
        </button>
        <button className="danger" onClick={clearWeights} style={{ flex: 1 }} title="Limpar todos os pesos">
          <IconTrash width={12} height={12} /> Limpar
        </button>
      </div>

      {/* Info */}
      <div className="small muted mt-2">
        Auto-peso calcula a influência de cada osso por distância aos vértices.
        Depois usa o pincel para ajustar manualmente.
        Vértices vermelhos = influência total, azuis = sem influência.
      </div>

      {/* Estatísticas */}
      {Object.keys(skinWeights).length > 0 && (
        <div className="small muted mt-2">
          {Object.keys(skinWeights).length} vértices com pesos definidos
        </div>
      )}
    </div>
  )
}
