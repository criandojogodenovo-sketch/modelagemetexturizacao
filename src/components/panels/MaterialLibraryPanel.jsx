/**
 * MaterialLibraryPanel — biblioteca de materiais predefinidos.
 *
 * Mostra uma grelha de materiais agrupados por categoria.
 * Click aplica o material ao objeto selecionado.
 */
import { useState } from 'react'
import { useStore, useSelectedObject } from '../../store/useStore'
import { MATERIAL_LIBRARY, MATERIAL_CATEGORIES } from '../../utils/materialLibrary'

export default function MaterialLibraryPanel() {
  const selected = useSelectedObject()
  const applyMaterialPreset = useStore((s) => s.applyMaterialPreset)
  const [activeCategory, setActiveCategory] = useState(MATERIAL_CATEGORIES[0])

  if (!selected) {
    return (
      <div className="empty-state">
        <div>Selecione um objeto para aplicar um material.</div>
      </div>
    )
  }

  const filteredMaterials = MATERIAL_LIBRARY.filter(
    (m) => m.category === activeCategory
  )

  return (
    <>
      <div className="panel-section">
        <h4>Categorias</h4>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {MATERIAL_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={activeCategory === cat ? 'active' : ''}
              style={{
                padding: '4px 8px',
                fontSize: 11,
                background: activeCategory === cat ? 'var(--accent-soft)' : 'var(--bg-elevated)',
                border: activeCategory === cat ? '1px solid var(--accent)' : '1px solid var(--border)',
                color: activeCategory === cat ? 'var(--accent)' : 'var(--text-secondary)',
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="panel-section">
        <h4>Materiais — {activeCategory}</h4>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 6,
          }}
        >
          {filteredMaterials.map((mat) => (
            <button
              key={mat.id}
              onClick={() => applyMaterialPreset(selected.id, mat.id)}
              title={mat.name}
              style={{
                padding: 0,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'stretch',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-panel-2)',
              }}
            >
              <div
                style={{
                  height: 48,
                  background: mat.preview,
                  backgroundImage: mat.material.map
                    ? `url(${mat.material.map})`
                    : undefined,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              />
              <div
                style={{
                  padding: '4px 6px',
                  fontSize: 10,
                  textAlign: 'center',
                  background: 'var(--bg-elevated)',
                }}
              >
                {mat.name}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="panel-section">
        <h4>Material Atual</h4>
        <div className="small muted">
          {selected.material?.map ? (
            <>Material com textura aplicada.</>
          ) : (
            <>Material sólido: <strong>{selected.material?.color}</strong></>
          )}
        </div>
      </div>
    </>
  )
}
