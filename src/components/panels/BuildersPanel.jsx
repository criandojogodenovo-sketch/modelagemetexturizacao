/**
 * BuildersPanel — painel modal para construtores profissionais.
 *
 * Fase 2 — Construtores Profissionais.
 *
 * Permite gerar cenas complexas (cidades, edifícios, carros, mobiliário)
 * de forma visual, com configuração de parâmetros.
 *
 * Acesso: VerticalRail → "Construtores" (abre este painel)
 */
import { useState } from 'react'
import { useStore } from '../../store/useStore'
import { IconClose } from '../ui/Icons'
import {
  generateCity,
  generateBuilding,
  generateCar,
  generateStreetFurniture,
  BUILDER_LIST,
} from '../../utils/proceduralBuilders'

export default function BuildersPanel({ onClose }) {
  const store = useStore
  const [selectedBuilder, setSelectedBuilder] = useState(null)
  const [options, setOptions] = useState({})

  const handleGenerate = () => {
    const state = store.getState()
    if (!state.activeSceneId) {
      state.toast('Crie uma cena primeiro', 'error')
      return
    }

    const position = [0, 0, 0]

    switch (selectedBuilder) {
      case 'city':
        generateCity(state, {
          blocks: Number(options.blocks) || 2,
          buildingsPerBlock: Number(options.buildingsPerBlock) || 2,
          blockSize: Number(options.blockSize) || 12,
          streetWidth: Number(options.streetWidth) || 4,
        })
        break
      case 'building':
        generateBuilding(state, {
          position,
          floors: Number(options.floors) || 3,
          width: Number(options.width) || 4,
          depth: Number(options.depth) || 4,
          floorHeight: Number(options.floorHeight) || 3,
          style: options.style || 'modern',
        })
        break
      case 'car':
        generateCar(state, {
          position,
          bodyType: options.bodyType || 'sedan',
          color: options.color || undefined,
        })
        break
      case 'streetFurniture':
        generateStreetFurniture(state, {
          position,
          count: Number(options.count) || 5,
          area: Number(options.area) || 20,
        })
        break
    }

    onClose()
  }

  const renderOptions = () => {
    if (!selectedBuilder) return null

    switch (selectedBuilder) {
      case 'city':
        return (
          <>
            <OptionRow label="Quarteirões por lado" value={options.blocks ?? 2} min={1} max={4} step={1}
              onChange={(v) => setOptions({ ...options, blocks: v })} />
            <OptionRow label="Edifícios por quarteirão" value={options.buildingsPerBlock ?? 2} min={1} max={5} step={1}
              onChange={(v) => setOptions({ ...options, buildigsPerBlock: v })} />
            <OptionRow label="Tamanho do quarteirão" value={options.blockSize ?? 12} min={8} max={30} step={2}
              onChange={(v) => setOptions({ ...options, blockSize: v })} />
            <OptionRow label="Largura da rua" value={options.streetWidth ?? 4} min={2} max={8} step={1}
              onChange={(v) => setOptions({ ...options, streetWidth: v })} />
          </>
        )
      case 'building':
        return (
          <>
            <OptionRow label="Andares" value={options.floors ?? 3} min={1} max={10} step={1}
              onChange={(v) => setOptions({ ...options, floors: v })} />
            <OptionRow label="Largura" value={options.width ?? 4} min={2} max={10} step={0.5}
              onChange={(v) => setOptions({ ...options, width: v })} />
            <OptionRow label="Profundidade" value={options.depth ?? 4} min={2} max={10} step={0.5}
              onChange={(v) => setOptions({ ...options, depth: v })} />
            <OptionRow label="Altura do andar" value={options.floorHeight ?? 3} min={2} max={5} step={0.5}
              onChange={(v) => setOptions({ ...options, floorHeight: v })} />
            <div className="prop-row">
              <label>Estilo</label>
              <select value={options.style ?? 'modern'} onChange={(e) => setOptions({ ...options, style: e.target.value })}>
                <option value="modern">Moderno (telhado plano)</option>
                <option value="classic">Clássico (telhado inclinado)</option>
                <option value="industrial">Industrial</option>
              </select>
            </div>
          </>
        )
      case 'car':
        return (
          <>
            <div className="prop-row">
              <label>Tipo de carroçaria</label>
              <select value={options.bodyType ?? 'sedan'} onChange={(e) => setOptions({ ...options, bodyType: e.target.value })}>
                <option value="sedan">Sedan</option>
                <option value="suv">SUV</option>
                <option value="sports">Desportivo (com spoiler)</option>
                <option value="truck">Camião</option>
              </select>
            </div>
            <div className="prop-row">
              <label>Cor da carroçaria</label>
              <input type="color" value={options.color ?? '#e63946'}
                onChange={(e) => setOptions({ ...options, color: e.target.value })} />
            </div>
          </>
        )
      case 'streetFurniture':
        return (
          <>
            <OptionRow label="Quantidade" value={options.count ?? 5} min={1} max={20} step={1}
              onChange={(v) => setOptions({ ...options, count: v })} />
            <OptionRow label="Área de dispersão" value={options.area ?? 20} min={5} max={50} step={5}
              onChange={(v) => setOptions({ ...options, area: v })} />
          </>
        )
      default:
        return null
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500, width: '90%', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ margin: 0, fontSize: '18px' }}>Construtores Profissionais</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)' }}>
            <IconClose />
          </button>
        </div>

        {!selectedBuilder ? (
          // Lista de construtores
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {BUILDER_LIST.map(builder => (
              <button
                key={builder.id}
                onClick={() => setSelectedBuilder(builder.id)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '16px 8px',
                  background: 'var(--bg-tertiary, #161b22)',
                  border: '1px solid var(--border, #30363d)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  color: 'var(--text, #e6edf3)',
                  fontSize: '13px',
                  transition: 'border-color 0.15s, transform 0.1s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#2f81f7' }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border, #30363d)' }}
              >
                <BuilderIcon type={builder.id} />
                <div style={{ fontWeight: 600 }}>{builder.label}</div>
                <div style={{ fontSize: '10px', opacity: 0.6, textAlign: 'center', lineHeight: '1.3' }}>
                  {builder.description}
                </div>
              </button>
            ))}
          </div>
        ) : (
          // Configuração do construtor selecionado
          <div>
            <button
              onClick={() => setSelectedBuilder(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2f81f7', marginBottom: '12px', fontSize: '13px' }}
            >
              ← Voltar à lista
            </button>

            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px' }}>
              {BUILDER_LIST.find(b => b.id === selectedBuilder)?.label}
            </h3>

            {renderOptions()}

            <button
              onClick={handleGenerate}
              style={{
                width: '100%',
                padding: '10px',
                marginTop: '16px',
                background: '#2f81f7',
                border: 'none',
                borderRadius: '6px',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 600,
              }}
            >
              Gerar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ===== Sub-componentes =====

function OptionRow({ label, value, min, max, step, onChange }) {
  return (
    <div className="prop-row">
      <label>{label}: {value}</label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  )
}

function BuilderIcon({ type }) {
  const style = { width: 28, height: 28, opacity: 0.8 }
  switch (type) {
    case 'city':
      return <span style={{ ...style, fontSize: '24px' }}>🏙️</span>
    case 'building':
      return <span style={{ ...style, fontSize: '24px' }}>🏢</span>
    case 'car':
      return <span style={{ ...style, fontSize: '24px' }}>🚗</span>
    case 'streetFurniture':
      return <span style={{ ...style, fontSize: '24px' }}>💡</span>
    default:
      return <span style={{ ...style, fontSize: '24px' }}>📦</span>
  }
}
