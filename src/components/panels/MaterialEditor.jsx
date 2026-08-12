/**
 * MaterialEditor — editor de material do objeto selecionado.
 *
 * Funcionalidades:
 *  - Cor base (color picker + swatches rápidos)
 *  - Roughness (slider 0-1)
 *  - Metalness (slider 0-1)
 *  - Opacidade (slider 0-1) + checkbox transparent
 *  - Wireframe + flat shading
 *  - Upload de textura difusa (PNG/JPG)
 *  - Upload de textura normal (PNG/JPG)
 *  - Tiling UV (repeat X/Y) e offset (X/Y)
 *  - Remover texturas
 */
import { useRef } from 'react'
import * as THREE from 'three'
import { useStore } from '../../store/useStore'
import { fileToDataURL } from '../../utils/helpers'
import { IconImage, IconTrash } from '../ui/Icons'
import CollapseSection from '../ui/CollapseSection'
import { applyPOMPro, removePOMPro } from '../../utils/parallaxOcclusionMappingPro'

const SWATCHES = [
  '#ffffff', '#cccccc', '#888888', '#444444', '#000000',
  '#e63946', '#f4a261', '#e9c46a', '#2a9d8f', '#264653',
  '#2f81f7', '#8957e5', '#d63384', '#fd7e14', '#20c997',
]

export default function MaterialEditor({ obj }) {
  const updateMaterial = useStore((s) => s.updateMaterial)
  const commitMaterial = useStore((s) => s.commitMaterial)
  const _pushHistory = useStore((s) => s._pushHistory)
  const toast = useStore((s) => s.toast)
  const mapInputRef = useRef()
  const normalInputRef = useRef()
  const heightInputRef = useRef()

  const m = obj.material

  // Atualiza um campo do material (em tempo real, sem histórico)
  const set = (patch) => updateMaterial(obj.id, patch)

  // Commit com histórico (ao terminar de arrastar slider / sair do campo)
  const commit = (patch) => commitMaterial(obj.id, patch)

  // Upload de textura difusa
  const handleMapUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.match(/^image\/(png|jpe?g)$/i)) {
      toast('Apenas PNG ou JPG', 'error')
      return
    }
    _pushHistory()
    const dataURL = await fileToDataURL(file)
    commitMaterial(obj.id, { map: dataURL })
    toast('Textura aplicada', 'success')
    e.target.value = ''
  }

  // Upload de textura normal
  const handleNormalUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.match(/^image\/(png|jpe?g)$/i)) {
      toast('Apenas PNG ou JPG', 'error')
      return
    }
    _pushHistory()
    const dataURL = await fileToDataURL(file)
    commitMaterial(obj.id, { normalMap: dataURL })
    toast('Textura normal aplicada', 'success')
    e.target.value = ''
  }

  const handleHeightUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.match(/^image\/(png|jpe?g)$/i)) {
      toast('Apenas PNG ou JPG', 'error')
      return
    }
    _pushHistory()
    const dataURL = await fileToDataURL(file)
    commitMaterial(obj.id, { heightMap: dataURL })
    toast('Height map carregado', 'success')
    e.target.value = ''
  }

  return (
    <div>
      <CollapseSection title="Material" icon="palette" storageKey="mat_basic">
        {/* Cor base */}
        <div className="prop-row">
          <label>Cor Base</label>
          <input
            type="color"
            value={m.color}
            onFocus={_pushHistory}
            onChange={(e) => set({ color: e.target.value })}
            onBlur={(e) => commit({ color: e.target.value })}
          />
          <div className="swatch-row mt-2">
            {SWATCHES.map((c) => (
              <div
                key={c}
                className="swatch"
                style={{ background: c }}
                onClick={() => { _pushHistory(); commit({ color: c }) }}
                title={c}
              />
            ))}
          </div>
        </div>

        {/* Roughness */}
        <div className="prop-row">
          <label>Brilho (Roughness): {m.roughness.toFixed(2)}</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={m.roughness}
            onFocus={_pushHistory}
            onChange={(e) => set({ roughness: Number(e.target.value) })}
            onMouseUp={(e) => commit({ roughness: Number(e.target.value) })}
          />
          <div className="small muted row between">
            <span>Mate</span>
            <span>Espelhado</span>
          </div>
        </div>

        {/* Metalness */}
        <div className="prop-row">
          <label>Metalicidade: {m.metalness.toFixed(2)}</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={m.metalness}
            onFocus={_pushHistory}
            onChange={(e) => set({ metalness: Number(e.target.value) })}
            onMouseUp={(e) => commit({ metalness: Number(e.target.value) })}
          />
          <div className="small muted row between">
            <span>Dielétrico</span>
            <span>Metal</span>
          </div>
        </div>

        {/* Opacidade */}
        <div className="prop-row">
          <label>Opacidade: {m.opacity.toFixed(2)}</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={m.opacity}
            onFocus={_pushHistory}
            onChange={(e) => set({ opacity: Number(e.target.value), transparent: Number(e.target.value) < 1 })}
            onMouseUp={(e) => commit({ opacity: Number(e.target.value), transparent: Number(e.target.value) < 1 })}
          />
        </div>

        {/* Flags */}
        <div className="prop-row">
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={m.wireframe}
                onChange={(e) => { _pushHistory(); commit({ wireframe: e.target.checked }) }}
              />
              Wireframe
            </label>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={m.flatShading}
                onChange={(e) => { _pushHistory(); commit({ flatShading: e.target.checked }) }}
              />
              Flat shading
            </label>
          </div>
        </div>

        {/* Emissive */}
        <div className="prop-row">
          <label>Emissive (cor de emissão)</label>
          <input
            type="color"
            value={m.emissive || '#000000'}
            onChange={(e) => set({ emissive: e.target.value })}
            onBlur={(e) => commit({ emissive: e.target.value })}
          />
        </div>
        {m.emissive && m.emissive !== '#000000' && (
          <div className="prop-row">
            <label>Intensidade Emissive: {(m.emissiveIntensity ?? 0).toFixed(2)}</label>
            <input
              type="range"
              min="0"
              max="5"
              step="0.1"
              value={m.emissiveIntensity ?? 0}
              onChange={(e) => set({ emissiveIntensity: Number(e.target.value) })}
              onMouseUp={(e) => commit({ emissiveIntensity: Number(e.target.value) })}
            />
          </div>
        )}
      </CollapseSection>

      <CollapseSection title="Textura Difusa" icon="image" defaultOpen={false} storageKey="mat_diffuse">
        <div className="prop-row">
          <div className="file-input-wrap">
            <button onClick={() => mapInputRef.current?.click()}>
              <IconImage width={14} height={14} /> {m.map ? 'Substituir textura' : 'Carregar PNG/JPG'}
            </button>
            <input
              ref={mapInputRef}
              type="file"
              accept="image/png,image/jpeg"
              onChange={handleMapUpload}
            />
          </div>
        </div>

        {m.map && (
          <>
            <div className="prop-row">
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <img
                  src={m.map}
                  alt="preview"
                  style={{
                    width: 48,
                    height: 48,
                    objectFit: 'cover',
                    borderRadius: 4,
                    border: '1px solid var(--border)',
                  }}
                />
                <button
                  className="danger"
                  onClick={() => { _pushHistory(); commitMaterial(obj.id, { map: null }) }}
                  style={{ flex: 1 }}
                >
                  <IconTrash width={14} height={14} /> Remover
                </button>
              </div>
            </div>

            <div className="prop-row">
              <label>Tiling U (repetição horizontal): {m.repeat[0]}</label>
              <input
                type="range"
                min="0.1"
                max="10"
                step="0.1"
                value={m.repeat[0]}
                onChange={(e) => set({ repeat: [Number(e.target.value), m.repeat[1]] })}
              />
            </div>
            <div className="prop-row">
              <label>Tiling V (repetição vertical): {m.repeat[1]}</label>
              <input
                type="range"
                min="0.1"
                max="10"
                step="0.1"
                value={m.repeat[1]}
                onChange={(e) => set({ repeat: [m.repeat[0], Number(e.target.value)] })}
              />
            </div>
            <div className="prop-row">
              <label>Offset U: {m.offset[0].toFixed(2)}</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={m.offset[0]}
                onChange={(e) => set({ offset: [Number(e.target.value), m.offset[1]] })}
              />
            </div>
            <div className="prop-row">
              <label>Offset V: {m.offset[1].toFixed(2)}</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={m.offset[1]}
                onChange={(e) => set({ offset: [m.offset[0], Number(e.target.value)] })}
              />
            </div>
          </>
        )}
      </CollapseSection>

      <CollapseSection title="Textura Normal" icon="image" defaultOpen={false} storageKey="mat_normal">
        <div className="prop-row">
          <div className="file-input-wrap">
            <button onClick={() => normalInputRef.current?.click()}>
              <IconImage width={14} height={14} /> {m.normalMap ? 'Substituir normal' : 'Carregar normal map'}
            </button>
            <input
              ref={normalInputRef}
              type="file"
              accept="image/png,image/jpeg"
              onChange={handleNormalUpload}
            />
          </div>
        </div>
        {m.normalMap && (
          <div className="prop-row">
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <img
                src={m.normalMap}
                alt="normal preview"
                style={{
                  width: 48,
                  height: 48,
                  objectFit: 'cover',
                  borderRadius: 4,
                  border: '1px solid var(--border)',
                }}
              />
              <button
                className="danger"
                onClick={() => { _pushHistory(); commitMaterial(obj.id, { normalMap: null }) }}
                style={{ flex: 1 }}
              >
                <IconTrash width={14} height={14} /> Remover
              </button>
            </div>
          </div>
        )}
      </CollapseSection>

      {/* POM — Parallax Occlusion Mapping Pro */}
      <CollapseSection title="POM (Parallax Occlusion)" icon="layers" defaultOpen={false} storageKey="mat_pom">
        <div className="small muted mb-2">
          Raymarching no height map para relevo real. Requer textura difusa + height map.
        </div>
        <div className="prop-row">
          <label>Height Map (textura de altura)</label>
          <div className="file-input-wrap">
            <button onClick={() => heightInputRef.current?.click()}>
              <IconImage width={14} height={14} /> {m.heightMap ? 'Substituir' : 'Carregar PNG/JPG'}
            </button>
            <input
              ref={heightInputRef}
              type="file"
              accept="image/png,image/jpeg"
              onChange={handleHeightUpload}
            />
          </div>
        </div>
        {m.heightMap && (
          <>
            <div className="prop-row">
              <label>Escala POM: {(m.pomScale ?? 0.04).toFixed(3)}</label>
              <input type="range" min="0" max="0.2" step="0.005"
                value={m.pomScale ?? 0.04}
                onChange={(e) => {
                  set({ pomScale: Number(e.target.value) })
                  _pushHistory()
                }}
              />
            </div>
            <div className="prop-row">
              <label>Passos: {m.pomSteps ?? 8}</label>
              <input type="range" min="2" max="32" step="1"
                value={m.pomSteps ?? 8}
                onChange={(e) => set({ pomSteps: Number(e.target.value) })}
              />
            </div>
            <div className="prop-row">
              <label>Self-shadow: {m.pomSelfShadow !== false ? 'ON' : 'OFF'}</label>
              <input type="checkbox"
                checked={m.pomSelfShadow !== false}
                onChange={(e) => set({ pomSelfShadow: e.target.checked })}
              />
            </div>
            <button
              className="primary"
              style={{ width: '100%', marginTop: 8 }}
              onClick={() => {
                // Aplicar POM ao material three.js real
                // Nota: obj precisa de ter bufferGeometry com UVs
                const tex = new THREE.TextureLoader().load(m.heightMap)
                applyPOMPro(obj.material?._threeMaterial || obj.material, tex, {
                  scale: m.pomScale ?? 0.04,
                  steps: m.pomSteps ?? 8,
                  selfShadow: m.pomSelfShadow !== false,
                })
                toast('POM aplicado!', 'success')
              }}
            >
              Aplicar POM
            </button>
            <button
              style={{ width: '100%', marginTop: 4 }}
              onClick={() => {
                removePOMPro(obj.material?._threeMaterial || obj.material)
                toast('POM removido', 'info')
              }}
            >
              Remover POM
            </button>
          </>
        )}
      </CollapseSection>
    </div>
  )
}
