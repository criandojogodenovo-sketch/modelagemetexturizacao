/**
 * SkeletonEditor — editor de esqueletos (Armature) estilo Blender.
 *
 * Funcionalidades:
 *  - Adicionar ossos clicando na malha
 *  - Hierarquia pai/filho
 *  - Editar posição, rotação, comprimento, nome
 *  - Preset "Esqueleto Humanoide Base"
 *  - Visualização 3D sobreposta ao modelo
 *
 * Acessível via LeftPanel → tab "Esqueleto" (quando um objeto está selecionado)
 */
import { useState } from 'react'
import { useStore, useSelectedObject } from '../../store/useStore'
import {
  IconPlus, IconTrash, IconBone, IconClose,
} from '../ui/Icons'

// Preset: esqueleto humanoide base
const HUMANOID_BONES = [
  // Coluna
  { name: 'root',     position: [0, 0, 0],     parentId: null,        length: 0.3 },
  { name: 'spine',    position: [0, 0.3, 0],   parentId: 'root',      length: 0.4 },
  { name: 'chest',    position: [0, 0.7, 0],   parentId: 'spine',     length: 0.3 },
  { name: 'neck',     position: [0, 1.0, 0],   parentId: 'chest',     length: 0.15 },
  { name: 'head',     position: [0, 1.2, 0],   parentId: 'neck',      length: 0.25 },
  // Braço esquerdo
  { name: 'shoulder.L', position: [0.15, 0.95, 0], parentId: 'chest',  length: 0.2 },
  { name: 'upperarm.L', position: [0.35, 0.9, 0], parentId: 'shoulder.L', length: 0.3 },
  { name: 'forearm.L',  position: [0.65, 0.85, 0], parentId: 'upperarm.L', length: 0.3 },
  { name: 'hand.L',     position: [0.95, 0.8, 0],  parentId: 'forearm.L',  length: 0.15 },
  // Braço direito
  { name: 'shoulder.R', position: [-0.15, 0.95, 0], parentId: 'chest',  length: 0.2 },
  { name: 'upperarm.R', position: [-0.35, 0.9, 0], parentId: 'shoulder.R', length: 0.3 },
  { name: 'forearm.R',  position: [-0.65, 0.85, 0], parentId: 'upperarm.R', length: 0.3 },
  { name: 'hand.R',     position: [-0.95, 0.8, 0],  parentId: 'forearm.R',  length: 0.15 },
  // Perna esquerda
  { name: 'thigh.L',  position: [0.12, 0, 0],   parentId: 'root',     length: 0.5 },
  { name: 'calf.L',   position: [0.12, -0.5, 0], parentId: 'thigh.L', length: 0.5 },
  { name: 'foot.L',   position: [0.12, -1.0, 0.05], parentId: 'calf.L', length: 0.2 },
  // Perna direita
  { name: 'thigh.R',  position: [-0.12, 0, 0],   parentId: 'root',     length: 0.5 },
  { name: 'calf.R',   position: [-0.12, -0.5, 0], parentId: 'thigh.R', length: 0.5 },
  { name: 'foot.R',   position: [-0.12, -1.0, 0.05], parentId: 'calf.R', length: 0.2 },
]

export default function SkeletonEditor() {
  const selected = useSelectedObject()
  const addBone = useStore((s) => s.addBone)
  const updateBone = useStore((s) => s.updateBone)
  const removeBone = useStore((s) => s.removeBone)
  const toast = useStore((s) => s.toast)
  const [selectedBoneId, setSelectedBoneId] = useState(null)

  if (!selected) {
    return (
      <div className="panel-section">
        <div className="empty-state small">Seleciona um objeto para editar o esqueleto.</div>
      </div>
    )
  }

  const skeleton = selected.skeleton
  const bones = skeleton?.bones || []

  const handleAddBone = () => {
    // Adicionar osso na origem do objeto, ligado ao último osso selecionado ou ao root
    const parentId = selectedBoneId || (bones.length > 0 ? bones[bones.length - 1].id : null)
    const lastBone = bones.find(b => b.id === parentId)
    const position = lastBone ? [
      lastBone.position[0],
      lastBone.position[1] + (lastBone.length || 0.5),
      lastBone.position[2],
    ] : [0, 0.5, 0]
    addBone(selected.id, position)
    if (parentId) {
      // Set parent on the newly added bone
      const newBones = useStore.getState().objects.find(o => o.id === selected.id)?.skeleton?.bones || []
      const newBone = newBones[newBones.length - 1]
      if (newBone) updateBone(selected.id, newBone.id, { parentId })
    }
  }

  const handleAddHumanoid = () => {
    // Limpar esqueleto existente
    for (const bone of bones) {
      removeBone(selected.id, bone.id)
    }
    // Adicionar ossos humanoide
    const boneIdMap = {} // name → id
    for (const def of HUMANOID_BONES) {
      const parentId = def.parentId ? boneIdMap[def.parentId] : null
      addBone(selected.id, def.position)
      // Obter o osso acabado de adicionar
      const currentBones = useStore.getState().objects.find(o => o.id === selected.id)?.skeleton?.bones || []
      const newBone = currentBones[currentBones.length - 1]
      if (newBone) {
        boneIdMap[def.name] = newBone.id
        updateBone(selected.id, newBone.id, {
          name: def.name,
          parentId,
          length: def.length,
        })
      }
    }
    toast('Esqueleto humanoide base criado (20 ossos)', 'success')
  }

  const selectedBone = bones.find(b => b.id === selectedBoneId)

  return (
    <div className="panel-section">
      <h4>Esqueleto ({bones.length} ossos)</h4>

      {/* Botões de ação */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        <button onClick={handleAddBone} style={{ flex: 1 }} title="Adicionar osso">
          <IconPlus width={12} height={12} /> Osso
        </button>
        <button onClick={handleAddHumanoid} style={{ flex: 1 }} title="Gerar esqueleto humanoide base">
          🧍 Humanoide
        </button>
      </div>

      {/* Lista de ossos (hierarquia) */}
      {bones.length > 0 ? (
        <div className="outliner" style={{ maxHeight: 200, overflowY: 'auto' }}>
          {bones.map((bone, i) => {
            const parent = bone.parentId ? bones.find(b => b.id === bone.parentId) : null
            const depth = parent ? 1 : 0
            return (
              <div
                key={bone.id}
                className={`outliner-item ${selectedBoneId === bone.id ? 'selected' : ''}`}
                onClick={() => setSelectedBoneId(bone.id)}
                style={{ paddingLeft: 8 + depth * 12 }}
              >
                <span className="icon-dot" style={{ background: '#f4a261' }} />
                <span style={{ flex: 1 }}>{bone.name || `Osso ${i + 1}`}</span>
                <button
                  className="icon"
                  style={{ padding: '2px 4px', minWidth: 'auto' }}
                  onClick={(e) => { e.stopPropagation(); removeBone(selected.id, bone.id); if (selectedBoneId === bone.id) setSelectedBoneId(null) }}
                  title="Remover osso"
                >
                  <IconTrash width={10} height={10} />
                </button>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="empty-state small">Sem ossos. Adiciona um ou usa o preset Humanoide.</div>
      )}

      {/* Propriedades do osso selecionado */}
      {selectedBone && (
        <div className="mt-2" style={{ borderTop: '1px solid var(--border-soft)', paddingTop: 8 }}>
          <div className="prop-row">
            <label>Nome</label>
            <input type="text" value={selectedBone.name || ''} onChange={(e) => updateBone(selected.id, selectedBone.id, { name: e.target.value })} />
          </div>
          <div className="prop-row">
            <label>Posição</label>
            <div className="vec3-input">
              <div className="axis x" data-axis="X">
                <input type="number" value={selectedBone.position[0].toFixed(2)} step="0.1"
                  onChange={(e) => updateBone(selected.id, selectedBone.id, { position: [Number(e.target.value), selectedBone.position[1], selectedBone.position[2]] })} />
              </div>
              <div className="axis y" data-axis="Y">
                <input type="number" value={selectedBone.position[1].toFixed(2)} step="0.1"
                  onChange={(e) => updateBone(selected.id, selectedBone.id, { position: [selectedBone.position[0], Number(e.target.value), selectedBone.position[2]] })} />
              </div>
              <div className="axis z" data-axis="Z">
                <input type="number" value={selectedBone.position[2].toFixed(2)} step="0.1"
                  onChange={(e) => updateBone(selected.id, selectedBone.id, { position: [selectedBone.position[0], selectedBone.position[1], Number(e.target.value)] })} />
              </div>
            </div>
          </div>
          <div className="prop-row">
            <label>Comprimento: {selectedBone.length?.toFixed(2) || 0.5}</label>
            <input type="range" min="0.05" max="2" step="0.05" value={selectedBone.length || 0.5}
              onChange={(e) => updateBone(selected.id, selectedBone.id, { length: Number(e.target.value) })} />
          </div>
          <div className="prop-row">
            <label>Pai</label>
            <select value={selectedBone.parentId || ''} onChange={(e) => updateBone(selected.id, selectedBone.id, { parentId: e.target.value || null })}>
              <option value="">— Nenhum (root) —</option>
              {bones.filter(b => b.id !== selectedBone.id).map(b => (
                <option key={b.id} value={b.id}>{b.name || b.id.slice(-6)}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Informação sobre weight painting */}
      <div className="small muted mt-2" style={{ borderTop: '1px solid var(--border-soft)', paddingTop: 8 }}>
        Depois de criar o esqueleto, usa o modo "Pintar Peso" para definir
        a influência de cada osso sobre a malha.
      </div>
    </div>
  )
}
