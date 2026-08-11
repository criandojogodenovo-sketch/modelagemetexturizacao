/**
 * BuildersPanel — painel de Construtores procedurais.
 *
 * Ferramentas para gerar objetos complexos sem modelar manualmente:
 *  - Construtor de Edifícios: gera casas/edifícios com parâmetros simples
 *  - Construtor de Veículos: gera carros/camiões com peças modulares
 *
 * Os objetos gerados entram no catálogo da Modelagem como qualquer outro.
 */
import { useState } from 'react'
import { useStore } from '../../store/useStore'
import { createBuildingObject, createVehicleObject } from '../../utils/buildingGenerator'

export default function BuildersPanel({ open, onClose }) {
  const addObject = useStore((s) => s.addObject)
  const toast = useStore((s) => s.toast)

  // === Estado do Construtor de Edifícios ===
  const [building, setBuilding] = useState({
    floors: 2,
    roofType: 'pitched',
    width: 6,
    depth: 4,
    floorHeight: 3,
    wallColor: '#cccccc',
  })

  // === Estado do Construtor de Veículos ===
  const [vehicle, setVehicle] = useState({
    bodyType: 'sedan',
    wheelSize: 0.4,
    color: '#3fb950',
  })

  const handleGenerateBuilding = () => {
    const obj = createBuildingObject(building)
    useStore.getState().addImportedObject(obj)
    // Não selecionar automaticamente — evita crash do MaterialEditor com type 'custom'
    toast(`Edifício "${obj.name}" criado! Vai a Modelagem para editar.`, 'success')
  }

  const handleVaryBuilding = () => {
    const varied = {
      ...building,
      floors: 1 + Math.floor(Math.random() * 4),
      width: 4 + Math.random() * 6,
      depth: 3 + Math.random() * 4,
      roofType: ['flat', 'pitched', 'gabled'][Math.floor(Math.random() * 3)],
      wallColor: `hsl(${Math.random() * 360}, 30%, 70%)`,
    }
    setBuilding(varied)
    const obj = createBuildingObject(varied)
    useStore.getState().addImportedObject(obj)
    toast('Variação gerada!', 'success')
  }

  const handleGenerateVehicle = () => {
    const obj = createVehicleObject(vehicle)
    useStore.getState().addImportedObject(obj)
    toast(`Veículo "${obj.name}" criado! Vai a Modelagem para editar.`, 'success')
  }

  return (
    <>
      {open && <div className="drawer-backdrop show" onClick={onClose} />}
      <aside className={`panel left ${open ? 'open' : ''}`}>
        <div className="panel-header">
          <span>Construtores</span>
          {onClose && (
            <button className="icon drawer-toggle" onClick={onClose} title="Fechar painel">
              ✕
            </button>
          )}
        </div>

        <div className="panel-body">
          {/* === Construtor de Edifícios === */}
          <div className="panel-section">
            <h4>Construtor de Edifícios</h4>

            <div className="prop-row">
              <label>Pisos: {building.floors}</label>
              <input type="range" min="1" max="6" step="1"
                value={building.floors}
                onChange={(e) => setBuilding({ ...building, floors: Number(e.target.value) })}
              />
            </div>

            <div className="prop-row">
              <label>Telhado</label>
              <select
                value={building.roofType}
                onChange={(e) => setBuilding({ ...building, roofType: e.target.value })}
              >
                <option value="flat">Plano</option>
                <option value="pitched">Inclinado (uma água)</option>
                <option value="gabled">Duas águas</option>
              </select>
            </div>

            <div className="prop-row">
              <label>Largura: {building.width.toFixed(1)}m</label>
              <input type="range" min="3" max="15" step="0.5"
                value={building.width}
                onChange={(e) => setBuilding({ ...building, width: Number(e.target.value) })}
              />
            </div>

            <div className="prop-row">
              <label>Profundidade: {building.depth.toFixed(1)}m</label>
              <input type="range" min="3" max="12" step="0.5"
                value={building.depth}
                onChange={(e) => setBuilding({ ...building, depth: Number(e.target.value) })}
              />
            </div>

            <div className="prop-row">
              <label>Altura do piso: {building.floorHeight.toFixed(1)}m</label>
              <input type="range" min="2" max="5" step="0.5"
                value={building.floorHeight}
                onChange={(e) => setBuilding({ ...building, floorHeight: Number(e.target.value) })}
              />
            </div>

            <div className="prop-row">
              <label>Cor das paredes</label>
              <input type="color"
                value={building.wallColor}
                onChange={(e) => setBuilding({ ...building, wallColor: e.target.value })}
              />
            </div>

            <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
              <button className="primary" style={{ flex: 1 }} onClick={handleGenerateBuilding}>Gerar Edifício
              </button>
              <button style={{ flex: 1 }} onClick={handleVaryBuilding} title="Gera variações aleatórias">Variar
              </button>
            </div>

            <div className="small muted mt-2">
              O edifício é gerado com paredes, chão, teto, telhado, janelas e porta.
              Fica disponível no catálogo da Modelagem e pode ser usado na Cena.
            </div>
          </div>

          {/* === Construtor de Veículos === */}
          <div className="panel-section">
            <h4>Construtor de Veículos</h4>

            <div className="prop-row">
              <label>Tipo de carroçaria</label>
              <select
                value={vehicle.bodyType}
                onChange={(e) => setVehicle({ ...vehicle, bodyType: e.target.value })}
              >
                <option value="sedan">Sedan</option>
                <option value="sport">Desportivo</option>
                <option value="truck">Camião</option>
              </select>
            </div>

            <div className="prop-row">
              <label>Tamanho das rodas: {vehicle.wheelSize.toFixed(2)}</label>
              <input type="range" min="0.2" max="0.8" step="0.05"
                value={vehicle.wheelSize}
                onChange={(e) => setVehicle({ ...vehicle, wheelSize: Number(e.target.value) })}
              />
            </div>

            <div className="prop-row">
              <label>Cor da carroçaria</label>
              <input type="color"
                value={vehicle.color}
                onChange={(e) => setVehicle({ ...vehicle, color: e.target.value })}
              />
            </div>

            <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
              <button className="primary" style={{ flex: 1 }} onClick={handleGenerateVehicle}>Gerar Veículo
              </button>
            </div>

            <div className="small muted mt-2">
              O veículo é gerado com chassis, cabine, 4 rodas, para-choques e vidros.
              Fica disponível no catálogo como qualquer outro modelo.
            </div>
          </div>

          {/* === Dicas === */}
          <div className="panel-section">
            <h4>Dicas</h4>
            <div className="small muted">
              <p>• Os objetos gerados aparecem no viewport e ficam selecionados automaticamente.</p>
              <p>• Podes editá-los na aba Modelagem (materiais, modificadores, etc.).</p>
              <p>• Usa "Variar" para gerar uma rua inteira de casas parecidas mas não idênticas.</p>
              <p>• Os veículos podem ser usados como RigidObject na Cena (com física).</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
