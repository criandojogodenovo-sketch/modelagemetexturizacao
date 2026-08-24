/**
 * BuildersPanel — painel de Construtores procedurais (PART-E).
 *
 * 6 builders realistas:
 *   - Casa (houseBuilder): modern/classic/cottage com fundação, janelas
 *     rebaixadas, porta, telhado, chaminé
 *   - Carro (carBuilder): sedan/suv/sports/truck com rodas+giros cromados,
 *     vidros, faróis, lanternas, para-choques
 *   - Árvore (treeBuilder): oak/pine/palm com tronco cónico e folhagem
 *     variada
 *   - Móvel (furnitureBuilder): chair/table/sofa/bed com PBR wood/fabric
 *   - Interior (interiorBuilder): quarto completo com paredes, porta,
 *     rodapés, mobiliário
 *   - Cidade (cityBuilder): grelha de blocos com casas aleatórias + lâmpadas
 *
 * Os objetos gerados entram no catálogo via useStore.addImportedObject.
 */
import { useState } from 'react'
import { useStore } from '../../store/useStore'
import { generateHouse } from '../../utils/proceduralBuilders/houseBuilder'
import { generateCar } from '../../utils/proceduralBuilders/carBuilder'
import { generateTree } from '../../utils/proceduralBuilders/treeBuilder'
import { generateFurniture } from '../../utils/proceduralBuilders/furnitureBuilder'
import { generateInterior } from '../../utils/proceduralBuilders/interiorBuilder'
import { generateCity } from '../../utils/proceduralBuilders/cityBuilder'

const SLIDER = (label, value, min, max, step, onChange, fmt) => (
  <div className="prop-row" key={label}>
    <label>{label}: {fmt ? fmt(value) : value}</label>
    <input type="range" min={min} max={max} step={step}
      value={value} onChange={onChange} />
  </div>
)

const COLOR = (label, value, onChange) => (
  <div className="prop-row" key={label}>
    <label>{label}</label>
    <input type="color" value={value} onChange={onChange} />
  </div>
)

const SELECT = (label, value, onChange, options) => (
  <div className="prop-row" key={label}>
    <label>{label}</label>
    <select value={value} onChange={onChange}>
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  </div>
)

const GEN_BTN = (label, onClick, secondary) => (
  <button
    className={secondary ? '' : 'primary'}
    style={{ flex: 1 }}
    onClick={onClick}
  >{label}</button>
)

export default function BuildersPanel({ open, onClose }) {
  const toast = useStore((s) => s.toast)

  // === House ===
  const [house, setHouse] = useState({
    style: 'modern', floors: 2, width: 6, depth: 4, floorHeight: 3,
    wallColor: '#e8e2d5', roofColor: '#2c2c30',
  })
  const setHouseStyle = (newStyle) => {
    // Suggest a fitting default roof color for each style
    const defaultRoof = {
      modern: '#2c2c30',
      classic: '#7a2a1f',
      cottage: '#5a2618',
    }[newStyle]
    setHouse({ ...house, style: newStyle, roofColor: defaultRoof })
  }
  const handleHouse = () => {
    const obj = generateHouse(house)
    useStore.getState().addImportedObject(obj)
    toast(`Casa "${obj.name}" criada!`, 'success')
  }

  // === Car ===
  const [car, setCar] = useState({
    type: 'sedan', color: '#c0392b', wheelSize: 0.4,
  })
  const handleCar = () => {
    const obj = generateCar(car)
    useStore.getState().addImportedObject(obj)
    toast(`Carro "${obj.name}" criado!`, 'success')
  }

  // === Tree ===
  const [tree, setTree] = useState({
    type: 'oak', height: 5, trunkRadius: 0.25, foliageColor: '#3a7d2c',
  })
  const handleTree = () => {
    const obj = generateTree(tree)
    useStore.getState().addImportedObject(obj)
    toast(`Árvore "${obj.name}" criada!`, 'success')
  }

  // === Furniture ===
  const [furniture, setFurniture] = useState({
    type: 'chair', color: '#7a4a2b',
  })
  const handleFurniture = () => {
    const obj = generateFurniture(furniture)
    useStore.getState().addImportedObject(obj)
    toast(`Móvel "${obj.name}" criado!`, 'success')
  }

  // === Interior ===
  const [interior, setInterior] = useState({
    roomWidth: 6, roomDepth: 5, roomHeight: 3, style: 'modern',
  })
  const handleInterior = () => {
    const obj = generateInterior(interior)
    useStore.getState().addImportedObject(obj)
    toast(`Interior "${obj.name}" criado!`, 'success')
  }

  // === City ===
  const [city, setCity] = useState({
    blocks: 3, buildingsPerBlock: 4, streetWidth: 6,
  })
  const handleCity = () => {
    const { objects } = generateCity(city)
    let i = 0
    for (const obj of objects) {
      useStore.getState().addImportedObject(obj)
      i++
    }
    toast(`Cidade gerada: ${i} objetos (casas + lâmpadas)`, 'success')
  }

  return (
    <>
      {onClose && <div className="drawer-backdrop show" onClick={onClose} />}
      <aside className={`panel left ${onClose ? 'open' : ''}`}>
        <div className="panel-header">
          <span>Construtores</span>
          {onClose && (
            <button className="icon drawer-toggle" onClick={onClose} title="Fechar painel">
              ✕
            </button>
          )}
        </div>

        <div className="panel-body">
          {/* === Casa === */}
          <div className="panel-section">
            <h4>Construtor de Casa</h4>
            {SELECT('Estilo', house.style,
              (e) => setHouseStyle(e.target.value),
              [['modern', 'Moderna'], ['classic', 'Clássica'], ['cottage', 'Rústica']])}
            {SLIDER('Pisos', house.floors, 1, 4, 1,
              (e) => setHouse({ ...house, floors: Number(e.target.value) }))}
            {SLIDER('Largura', house.width, 3, 12, 0.5,
              (e) => setHouse({ ...house, width: Number(e.target.value) }),
              (v) => `${v.toFixed(1)}m`)}
            {SLIDER('Profundidade', house.depth, 3, 10, 0.5,
              (e) => setHouse({ ...house, depth: Number(e.target.value) }),
              (v) => `${v.toFixed(1)}m`)}
            {SLIDER('Altura piso', house.floorHeight, 2.4, 4, 0.1,
              (e) => setHouse({ ...house, floorHeight: Number(e.target.value) }),
              (v) => `${v.toFixed(1)}m`)}
            {COLOR('Cor paredes', house.wallColor,
              (e) => setHouse({ ...house, wallColor: e.target.value }))}
            {COLOR('Cor telhado', house.roofColor,
              (e) => setHouse({ ...house, roofColor: e.target.value }))}
            <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
              {GEN_BTN('Gerar Casa', handleHouse)}
            </div>
            <div className="small muted mt-2">
              Fundação, 4 paredes, janelas rebaixadas com moldura e silhar,
              porta rebaixada com maçaneta, telhado por estilo, chaminé
              (clássica/rústica).
            </div>
          </div>

          {/* === Carro === */}
          <div className="panel-section">
            <h4>Construtor de Carro</h4>
            {SELECT('Tipo', car.type,
              (e) => setCar({ ...car, type: e.target.value }),
              [['sedan', 'Sedan'], ['suv', 'SUV'], ['sports', 'Desportivo'], ['truck', 'Camião']])}
            {SLIDER('Raio rodas', car.wheelSize, 0.25, 0.6, 0.05,
              (e) => setCar({ ...car, wheelSize: Number(e.target.value) }),
              (v) => v.toFixed(2))}
            {COLOR('Cor carroçaria', car.color,
              (e) => setCar({ ...car, color: e.target.value }))}
            <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
              {GEN_BTN('Gerar Carro', handleCar)}
            </div>
            <div className="small muted mt-2">
              Carroçaria com cabine, 4 rodas (pneu+jante cromada), vidros
              inclinados, para-choques, faróis (emissivos brancos) e lanternas
              (vermelhas). PBR car-paint: clearcoat 1.0, metalness 0.8.
            </div>
          </div>

          {/* === Árvore === */}
          <div className="panel-section">
            <h4>Construtor de Árvore</h4>
            {SELECT('Espécie', tree.type,
              (e) => setTree({ ...tree, type: e.target.value }),
              [['oak', 'Carvalho'], ['pine', 'Pinheiro'], ['palm', 'Palmeira']])}
            {SLIDER('Altura', tree.height, 2, 12, 0.5,
              (e) => setTree({ ...tree, height: Number(e.target.value) }),
              (v) => `${v.toFixed(1)}m`)}
            {SLIDER('Raio tronco', tree.trunkRadius, 0.1, 0.6, 0.05,
              (e) => setTree({ ...tree, trunkRadius: Number(e.target.value) }),
              (v) => v.toFixed(2))}
            {COLOR('Cor folhagem', tree.foliageColor,
              (e) => setTree({ ...tree, foliageColor: e.target.value }))}
            <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
              {GEN_BTN('Gerar Árvore', handleTree)}
            </div>
            <div className="small muted mt-2">
              Tronco cónico (afunilado) com jitter de cor. Carvalho: 5 esferas
              agrupadas; pinheiro: 4 cones empilhados; palmeira: 6 brácteas
              achatadas + cocos. PBR folhagem com sheen 0.3.
            </div>
          </div>

          {/* === Móvel === */}
          <div className="panel-section">
            <h4>Construtor de Móvel</h4>
            {SELECT('Tipo', furniture.type,
              (e) => setFurniture({ ...furniture, type: e.target.value }),
              [['chair', 'Cadeira'], ['table', 'Mesa'], ['sofa', 'Sofá'], ['bed', 'Cama']])}
            {COLOR('Cor (madeira/tecido)', furniture.color,
              (e) => setFurniture({ ...furniture, color: e.target.value }))}
            <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
              {GEN_BTN('Gerar Móvel', handleFurniture)}
            </div>
            <div className="small muted mt-2">
              Cadeira: assento + encosto + 4 pernas + 3 transversais. Mesa:
              tampo + 4 pernas + saia. Sofá: base + encosto + 2 braços + 2
              almofadas. Cama: estrutura + colchão + cabeceira + 2 almofadas +
              manta. PBR wood roughness 0.6, fabric sheen 0.5.
            </div>
          </div>

          {/* === Interior === */}
          <div className="panel-section">
            <h4>Construtor de Interior</h4>
            {SELECT('Estilo', interior.style,
              (e) => setInterior({ ...interior, style: e.target.value }),
              [['modern', 'Moderno'], ['rustic', 'Rústico']])}
            {SLIDER('Largura', interior.roomWidth, 4, 12, 0.5,
              (e) => setInterior({ ...interior, roomWidth: Number(e.target.value) }),
              (v) => `${v.toFixed(1)}m`)}
            {SLIDER('Profundidade', interior.roomDepth, 4, 10, 0.5,
              (e) => setInterior({ ...interior, roomDepth: Number(e.target.value) }),
              (v) => `${v.toFixed(1)}m`)}
            {SLIDER('Altura', interior.roomHeight, 2.4, 4, 0.1,
              (e) => setInterior({ ...interior, roomHeight: Number(e.target.value) }),
              (v) => `${v.toFixed(1)}m`)}
            <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
              {GEN_BTN('Gerar Interior', handleInterior)}
            </div>
            <div className="small muted mt-2">
              Quarto completo: chão madeira, teto, 4 paredes (parede frontal
              com vão de porta), folha de porta aberta 45°, rodapés, cama
              com cabeceira + almofada, mesa + 4 pernas + cadeira, tapete.
            </div>
          </div>

          {/* === Cidade === */}
          <div className="panel-section">
            <h4>Construtor de Cidade</h4>
            {SLIDER('Blocos (NxN)', city.blocks, 1, 5, 1,
              (e) => setCity({ ...city, blocks: Number(e.target.value) }))}
            {SLIDER('Casas/bloco', city.buildingsPerBlock, 1, 9, 1,
              (e) => setCity({ ...city, buildingsPerBlock: Number(e.target.value) }))}
            {SLIDER('Largura rua', city.streetWidth, 4, 12, 0.5,
              (e) => setCity({ ...city, streetWidth: Number(e.target.value) }),
              (v) => `${v.toFixed(1)}m`)}
            <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
              {GEN_BTN('Gerar Cidade', handleCity)}
            </div>
            <div className="small muted mt-2">
              Grelha de {city.blocks * city.blocks} blocos com {city.buildingsPerBlock}{' '}
              casas cada (variando estilo, pisos, cor, rotação) + lâmpadas de
              rua em cada canto exterior. Pode demorar a processar.
            </div>
          </div>

          {/* === Dicas === */}
          <div className="panel-section">
            <h4>Dicas</h4>
            <div className="small muted">
              <p>• Os objetos aparecem no viewport e ficam selecionados.</p>
              <p>• Edita-os na aba Modelagem (materiais, modificadores).</p>
              <p>• Cidade adiciona muitos objetos — considera apagar antes de regerar.</p>
              <p>• Todos os builders usam vertex colors: cada parte lê a sua cor sem multi-material.</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
