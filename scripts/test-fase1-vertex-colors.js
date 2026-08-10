/**
 * Teste Fase 1: Verifica que buildingGenerator produz vertex colors
 * e que a geometria mesclada tem cores diferentes para paredes/janelas/porta.
 */
import { createBuildingObject, createVehicleObject } from '../modelagemetexturizacao/src/utils/buildingGenerator.js'
import * as THREE from 'three'

console.log('=== TESTE FASE 1: Vertex Colors nos Builders ===\n')

// Teste 1: Edifício tem vertex colors
const building = createBuildingObject({
  floors: 2,
  roofType: 'pitched',
  width: 6,
  depth: 4,
  wallColor: '#cccccc',
})

console.log('1. Edifício:')
console.log('   - customGeometry.colors existe?', !!building.customGeometry.colors)
console.log('   - material.vertexColors?', building.material.vertexColors)
console.log('   - total vértices:', building.customGeometry.positions.length / 3)

if (building.customGeometry.colors) {
  // Construir geometria three.js e verificar se há variedade de cores
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(building.customGeometry.positions, 3))
  geo.setAttribute('color', new THREE.Float32BufferAttribute(building.customGeometry.colors, 3))
  
  const colors = building.customGeometry.colors
  const uniqueColors = new Set()
  for (let i = 0; i < colors.length; i += 3) {
    const key = `${colors[i].toFixed(2)},${colors[i+1].toFixed(2)},${colors[i+2].toFixed(2)}`
    uniqueColors.add(key)
  }
  console.log(`   - cores únicas: ${uniqueColors.size}`)
  console.log(`   - amostra: ${Array.from(uniqueColors).slice(0, 5).join(' | ')}`)
}

// Teste 2: Veículo desportivo tem proporções de super-carro
console.log('\n2. Veículo Desportivo (Lamborghini-style):')
const sport = createVehicleObject({ bodyType: 'sport', wheelSize: 0.45, color: '#f85149' })
console.log('   - customGeometry.colors existe?', !!sport.customGeometry.colors)
console.log('   - total vértices:', sport.customGeometry.positions.length / 3)
if (sport.customGeometry.colors) {
  const colors = sport.customGeometry.colors
  const uniqueColors = new Set()
  for (let i = 0; i < colors.length; i += 3) {
    const key = `${colors[i].toFixed(2)},${colors[i+1].toFixed(2)},${colors[i+2].toFixed(2)}`
    uniqueColors.add(key)
  }
  console.log(`   - cores únicas: ${uniqueColors.size} (esperado: 6+ — body, glass, tire, rim, bumper, lights)`)
}

// Teste 3: Veículo sedan
console.log('\n3. Veículo Sedan:')
const sedan = createVehicleObject({ bodyType: 'sedan', wheelSize: 0.4, color: '#3fb950' })
console.log('   - customGeometry.colors existe?', !!sedan.customGeometry.colors)
console.log('   - total vértices:', sedan.customGeometry.positions.length / 3)

console.log('\n=== FIM DO TESTE ===')
