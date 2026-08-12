/**
 * InstancingPanel — painel para gerar e dispersar florestas / pedras / partículas
 * usando HardwareInstancingSystem (GPU InstancedMesh + LOD + frustum culling).
 *
 * O utilizador escolhe:
 *  - Tipo: floresta (árvores), pedras, capim (grass), partículas
 *  - Nº de instâncias (10–5000)
 *  - Área (minX..maxX, minZ..maxZ)
 *  - Variação de escala
 *
 * Ao clicar "Gerar", cria um HardwareInstancingSystem e adiciona-o à cena 3D
 * através de uma instância guardada no store (window._flirInstancingSystems).
 * O SceneLevel3D tem um componente <InstancingRenderer/> que pega essas
 * instâncias e adiciona-as à cena e corre update() por frame.
 *
 * Estatísticas em tempo real: instâncias visíveis / culling / LOD.
 */
import { useState, useEffect, useRef } from 'react'
import { useStore } from '../../store/useStore'
import { IconClose } from '../ui/Icons'
import { Icon } from '../ui/iconMap'
import { createForestSystem, HardwareInstancingSystem } from '../../utils/hardwareInstancing'
import * as THREE from 'three'

const PRESETS = [
  {
    id: 'forest',
    label: 'Floresta',
    icon: '🌳',
    desc: 'Árvores cone+cilindro (3 LOD levels)',
    color: 0x2d5a2d,
    count: 200,
    scaleRange: [0.8, 1.4],
  },
  {
    id: 'rocks',
    label: 'Pedras',
    icon: '🪨',
    desc: 'Pedras low-poly dispersas',
    color: 0x6e7681,
    count: 80,
    scaleRange: [0.4, 1.6],
  },
  {
    id: 'grass',
    label: 'Capim',
    icon: '🌿',
    desc: 'Tufts de capim denso',
    color: 0x4d7c2d,
    count: 800,
    scaleRange: [0.3, 0.7],
  },
  {
    id: 'crystals',
    label: 'Cristais',
    icon: '💎',
    desc: 'Cristais brilhantes (octaedros)',
    color: 0x6ee7ff,
    count: 50,
    scaleRange: [0.5, 1.5],
  },
]

export default function InstancingPanel({ onClose }) {
  const toast = useStore((s) => s.toast)
  const activeSceneId = useStore((s) => s.activeSceneId)
  const addConectToScene = useStore((s) => s.addConectToScene)
  const updateConect = useStore((s) => s.updateConect)

  const [selectedPreset, setSelectedPreset] = useState('forest')
  const [count, setCount] = useState(200)
  const [areaMinX, setAreaMinX] = useState(-25)
  const [areaMaxX, setAreaMaxX] = useState(25)
  const [areaMinZ, setAreaMinZ] = useState(-25)
  const [areaMaxZ, setAreaMaxZ] = useState(25)
  const [scaleMin, setScaleMin] = useState(0.8)
  const [scaleMax, setScaleMax] = useState(1.4)
  const [enableCulling, setEnableCulling] = useState(true)
  const [enableLOD, setEnableLOD] = useState(true)
  const [enableGPUVariation, setEnableGPUVariation] = useState(true)
  const [stats, setStats] = useState(null)

  // Lista de sistemas activos (para estatísticas em tempo real)
  const systemsRef = useRef((window._flirInstancingSystems = window._flirInstancingSystems || []))

  // Atualizar estatísticas a cada 500ms
  useEffect(() => {
    const interval = setInterval(() => {
      if (systemsRef.current.length === 0) {
        setStats(null)
        return
      }
      const allStats = systemsRef.current.map((s) => s.getStats())
      const total = allStats.reduce((acc, s) => ({
        totalInstances: acc.totalInstances + s.totalInstances,
        visibleInstances: acc.visibleInstances + s.visibleInstances,
        culledInstances: acc.culledInstances + s.culledInstances,
      }), { totalInstances: 0, visibleInstances: 0, culledInstances: 0 })
      setStats({ ...total, systems: allStats.length })
    }, 500)
    return () => clearInterval(interval)
  }, [])

  const handleGenerate = () => {
    if (!activeSceneId) {
      toast('Cria uma cena primeiro para dispersar instâncias', 'error')
      return
    }

    const preset = PRESETS.find((p) => p.id === selectedPreset)
    if (!preset) return

    // Construir geometrias consoante o preset
    let geometry, material
    switch (preset.id) {
      case 'forest':
        geometry = new THREE.ConeGeometry(0.5, 2, 8)
        material = new THREE.MeshStandardMaterial({ color: preset.color, roughness: 0.85 })
        break
      case 'rocks':
        geometry = new THREE.DodecahedronGeometry(0.6, 0)
        material = new THREE.MeshStandardMaterial({ color: preset.color, roughness: 0.95, flatShading: true })
        break
      case 'grass':
        geometry = new THREE.ConeGeometry(0.1, 0.6, 4)
        material = new THREE.MeshStandardMaterial({ color: preset.color, roughness: 0.9 })
        break
      case 'crystals':
        geometry = new THREE.OctahedronGeometry(0.5, 0)
        material = new THREE.MeshStandardMaterial({
          color: preset.color, roughness: 0.1, metalness: 0.3,
          emissive: preset.color, emissiveIntensity: 0.3, flatShading: true,
        })
        break
    }

    // Criar sistema com 3 LOD levels (alta/média/baixa resolução)
    const lowGeo = preset.id === 'forest'
      ? new THREE.ConeGeometry(0.5, 2, 4)
      : geometry.clone()
    const medGeo = preset.id === 'forest'
      ? new THREE.ConeGeometry(0.5, 2, 6)
      : geometry.clone()
    const lowMat = material.clone()
    const medMat = material.clone()

    const system = new HardwareInstancingSystem({
      lodLevels: [
        { geometry, material, maxDistance: 20 },
        { geometry: medGeo, material: medMat, maxDistance: 50 },
        { geometry: lowGeo, material: lowMat, maxDistance: 200 },
      ],
      maxInstances: count,
      enableCulling,
      enableLOD,
      enableGPUVariation,
    })

    // Adicionar instâncias aleatórias na área definida
    system.addRandomInstances(count, {
      minX: areaMinX, maxX: areaMaxX,
      minZ: areaMinZ, maxZ: areaMaxZ,
      y: 0,
      scaleRange: [scaleMin, scaleMax],
    })
    system.build()

    // Adicionar à lista global — o InstancingRenderer no SceneLevel3D vai buscá-la
    systemsRef.current.push(system)

    // Também criar um Conect na cena para persistência (visual marker)
    const conect = addConectToScene('PersonalObject', [0, 0, 0])
    if (conect) {
      updateConect(conect.instanceId, {
        name: `[Instancing] ${preset.label} (${count})`,
        instancingPreset: preset.id,
        instancingCount: count,
        instancingArea: { minX: areaMinX, maxX: areaMaxX, minZ: areaMinZ, maxZ: areaMaxZ },
        scaleRange: [scaleMin, scaleMax],
        _instancingSystemId: systemsRef.current.length - 1,
      })
    }

    toast(`${count} instâncias de "${preset.label}" geradas (GPU InstancedMesh)`, 'success')
  }

  const handleClear = () => {
    for (const sys of systemsRef.current) {
      try { sys.dispose() } catch {}
    }
    systemsRef.current.length = 0
    setStats(null)
    toast('Todos os sistemas de instância foram removidos', 'info')
  }

  return (
    <>
      {onClose && <div className="drawer-backdrop show" onClick={onClose} />}
      <aside className={`instancing-panel ${onClose ? 'open' : ''}`}>
        <div className="panel-header">
          <span>Hardware Instancing (GPU)</span>
          {onClose && (
            <button className="icon" onClick={onClose} title="Fechar">
              <IconClose width={14} height={14} />
            </button>
          )}
        </div>

        <div className="instancing-body">
          <div className="panel-section">
            <h4>Predefinições</h4>
            <div className="terrain-brush-grid">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  className={`terrain-brush-btn ${selectedPreset === p.id ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedPreset(p.id)
                    setCount(p.count)
                    setScaleMin(p.scaleRange[0])
                    setScaleMax(p.scaleRange[1])
                  }}
                  title={p.desc}
                >
                  <span style={{ fontSize: 16 }}>{p.icon}</span>
                  <span>{p.label}</span>
                </button>
              ))}
            </div>
            <div className="small muted mt-2">
              {PRESETS.find((p) => p.id === selectedPreset)?.desc}
            </div>
          </div>

          <div className="panel-section">
            <h4>Parâmetros</h4>
            <div className="prop-row">
              <label>Nº de instâncias: {count}</label>
              <input type="range" min="10" max="5000" step="10" value={count}
                onChange={(e) => setCount(Number(e.target.value))} />
            </div>
            <div className="prop-row">
              <label>Área X: {areaMinX} → {areaMaxX}</label>
              <div style={{ display: 'flex', gap: 4 }}>
                <input type="number" value={areaMinX}
                  onChange={(e) => setAreaMinX(Number(e.target.value))} />
                <input type="number" value={areaMaxX}
                  onChange={(e) => setAreaMaxX(Number(e.target.value))} />
              </div>
            </div>
            <div className="prop-row">
              <label>Área Z: {areaMinZ} → {areaMaxZ}</label>
              <div style={{ display: 'flex', gap: 4 }}>
                <input type="number" value={areaMinZ}
                  onChange={(e) => setAreaMinZ(Number(e.target.value))} />
                <input type="number" value={areaMaxZ}
                  onChange={(e) => setAreaMaxZ(Number(e.target.value))} />
              </div>
            </div>
            <div className="prop-row">
              <label>Escala mín: {scaleMin.toFixed(2)}</label>
              <input type="range" min="0.1" max="3" step="0.05" value={scaleMin}
                onChange={(e) => setScaleMin(Number(e.target.value))} />
            </div>
            <div className="prop-row">
              <label>Escala máx: {scaleMax.toFixed(2)}</label>
              <input type="range" min="0.1" max="5" step="0.05" value={scaleMax}
                onChange={(e) => setScaleMax(Number(e.target.value))} />
            </div>
          </div>

          <div className="panel-section">
            <h4>Otimizações GPU</h4>
            <div className="prop-row">
              <label>
                <input type="checkbox" checked={enableCulling}
                  onChange={(e) => setEnableCulling(e.target.checked)}
                  style={{ width: 'auto', display: 'inline-block', marginRight: 6 }} />
                Frustum Culling (esconde fora da vista)
              </label>
            </div>
            <div className="prop-row">
              <label>
                <input type="checkbox" checked={enableLOD}
                  onChange={(e) => setEnableLOD(e.target.checked)}
                  style={{ width: 'auto', display: 'inline-block', marginRight: 6 }} />
                LOD por distância (3 níveis)
              </label>
            </div>
            <div className="prop-row">
              <label>
                <input type="checkbox" checked={enableGPUVariation}
                  onChange={(e) => setEnableGPUVariation(e.target.checked)}
                  style={{ width: 'auto', display: 'inline-block', marginRight: 6 }} />
                Variação de cor na GPU (gl_InstanceID)
              </label>
            </div>
            <div className="small muted mt-1">
              Estas otimizações permitem renderizar milhares de objetos com um único
              draw call por LOD. Em mobile, ativa todas as três.
            </div>
          </div>

          {stats && (
            <div className="panel-section">
              <h4>Estatísticas em tempo real</h4>
              <div className="small" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                <div>Sistemas activos: <strong>{stats.systems}</strong></div>
                <div>Total instâncias: <strong>{stats.totalInstances}</strong></div>
                <div>Visíveis (frame): <strong style={{ color: 'var(--accent)' }}>{stats.visibleInstances}</strong></div>
                <div>Culling (escondidas): <strong style={{ color: 'var(--warning)' }}>{stats.culledInstances}</strong></div>
              </div>
            </div>
          )}

          <div className="panel-section">
            <button onClick={handleGenerate} className="primary" style={{ width: '100%', marginBottom: 6 }}>
              <Icon name="sparkles" size={14} />
              <span style={{ marginLeft: 6 }}>Gerar e Adicionar à Cena</span>
            </button>
            <button onClick={handleClear} style={{ width: '100%' }}>
              <Icon name="trash" size={14} />
              <span style={{ marginLeft: 6 }}>Limpar Todos</span>
            </button>
          </div>

          <div className="panel-section">
            <div className="small muted">
              <strong>Como funciona:</strong> O sistema usa <code>THREE.InstancedMesh</code> com
              matrizes de transformação por instância, enviadas à GPU num único buffer.
              O <code>frustum culling</code> é feito em JS antes do draw call, e o <code>LOD</code>
              troca de geometria consoante a distância à câmara. A variação de cor é aplicada
              no vertex shader via <code>gl_InstanceID</code>, sem overhead na CPU.
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
