// Testar geração do JSON do jogo demo
import { flirQuestArenaProject, flirQuestArenaJSON } from '../src/utils/game/flirQuestArena.js'

console.log('=== FlirQuest Arena — Teste de geração ===')
console.log('Project name:', flirQuestArenaProject.projectName)
console.log('Conects count:', flirQuestArenaProject.scenes[0].conects.length)
console.log('Objects count:', flirQuestArenaProject.objects.length)
console.log('UI screens:', flirQuestArenaProject.uiScreens.length)
console.log('JSON size (KB):', (flirQuestArenaJSON.length / 1024).toFixed(1))

// Listar tipos de conects
const types = {}
for (const c of flirQuestArenaProject.scenes[0].conects) {
  types[c.type] = (types[c.type] || 0) + 1
}
console.log('Tipos de conects:')
for (const [t, n] of Object.entries(types)) {
  console.log(`  ${t}: ${n}`)
}

// Validar JSON parse
try {
  JSON.parse(flirQuestArenaJSON)
  console.log('✓ JSON válido')
} catch (e) {
  console.error('✗ JSON inválido:', e.message)
  process.exit(1)
}
