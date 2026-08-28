/**
 * test-exported-game.mjs — S19: valida o HTML standalone exportado do Showcase.
 *
 * Valida (critérios da Sessão 19, Parte A):
 *  1. Página carrega sem erros (splash esconde, HUD renderiza)
 *  2. Herói anda com WASD
 *  3. NPCs patrulham (posições mudam ao longo do tempo)
 *  4. Botão móvel PULAR/↑ funciona (salto físico)
 *  5. Portal (TriggerObject) dispara onEnterZone por PROXIMIDADE → changeScene
 *  6. Câmara roda com drag
 *  7. NPCs da cena 2 ativos após o portal
 *
 * Nota: o browser headless renderiza a ~3fps (WebGL por software) — a física
 * avança em câmara lenta; os tempos de espera estão calibrados para isso.
 *
 * Uso: node scripts/test-exported-game.mjs [caminho-para-html]
 */
import { chromium } from 'playwright'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const htmlPath = process.argv[2] || resolve(__dirname, '../download/showcase-exported.html')
const SS = (n) => resolve(__dirname, `../download/screenshots/s19-exp-${n}.png`)

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })

const pageErrors = []
const consoleErrors = []
page.on('pageerror', (e) => pageErrors.push(String(e)))
page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()) })

console.log('A abrir:', htmlPath)
await page.goto('file://' + htmlPath)
await page.waitForTimeout(6000)

const pass = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} — ${name}${detail ? '  [' + detail + ']' : ''}`)
  if (!ok) process.exitCode = 1
}

// === 1. LOAD ===
const loadState = await page.evaluate(() => ({
  splash: document.getElementById('splash')?.style.display || 'not-hid',
  uiEls: document.getElementById('ui-overlay')?.children.length || 0,
}))
pass('1. Load sem erros (splash escondido + HUD)', loadState.splash === 'none' && loadState.uiEls >= 4, `splash=${loadState.splash} ui=${loadState.uiEls}`)
await page.screenshot({ path: SS('01-loaded') })

// === 2. NPCs patrulham (antes de mexer no player/câmara) ===
const n0 = await page.evaluate(() => window._flirGameContext._debugState().npcs)
await page.waitForTimeout(2500)
const n1 = await page.evaluate(() => window._flirGameContext._debugState().npcs)
let movedNpcs = 0
for (const id in n1) {
  const d = Math.hypot(n1[id][0] - n0[id][0], n1[id][2] - n0[id][2])
  if (d > 0.3) movedNpcs++
}
pass('2. NPCs patrulham', movedNpcs >= 2, `${movedNpcs}/${Object.keys(n1).length} NPCs moveram >0.3u em 2.5s`)

// === 3. Herói anda com W (yaw ainda 0 → anda em -z) ===
const s0 = await page.evaluate(() => window._flirGameContext._debugState())
await page.keyboard.down('w')
await page.waitForTimeout(1600)
await page.keyboard.up('w')
const s1 = await page.evaluate(() => window._flirGameContext._debugState())
const moved = Math.hypot(s1.player[0] - s0.player[0], s1.player[2] - s0.player[2])
pass('3. Herói anda com W', moved > 1.5, `deslocou ${moved.toFixed(2)}u (${s0.player} → ${s1.player})`)

// === 4. Botão PULAR (↑) ===
const jb = await page.evaluate(() => window._flirGameContext._debugState().player[1])
await page.click('#ui-overlay button >> nth=1') // ↑ (btn_jump)
await page.waitForTimeout(350)
const ja = await page.evaluate(() => window._flirGameContext._debugState().player[1])
pass('4. Botão ↑ (PULAR) salta', ja > jb + 0.4, `y ${jb.toFixed(2)} → ${ja.toFixed(2)}`)
await page.waitForTimeout(1500) // aterrar

// === 5. Portal por proximidade (W contínuo, polling da cena) ===
// Portal em [0,1,-20]; player parte de z≈5-8. Andar para a frente até mudar de cena.
// Nota: NPCs patrulham no centro da cidade e empurram o player lateralmente —
// se |x|>0.8 o player sai da banda do portal (2u de largura) → corrigir com A/D.
const before = await page.evaluate(() => window._flirGameContext._debugState().scene)
await page.keyboard.down('w')
let sceneChanged = false
let lastPos = null
for (let i = 0; i < 14; i++) {
  await page.waitForTimeout(2000)
  const st = await page.evaluate(() => window._flirGameContext._debugState())
  lastPos = st.player
  if (st.scene !== before) { sceneChanged = true; break }
  if (st.player && Math.abs(st.player[0]) > 0.8) {
    // corrigir deriva lateral (yaw=0: 'a' → -x, 'd' → +x)
    const key = st.player[0] > 0 ? 'a' : 'd'
    await page.keyboard.down(key)
    await page.waitForTimeout(400)
    await page.keyboard.up(key)
  }
}
await page.keyboard.up('w')
const after = await page.evaluate(() => window._flirGameContext._debugState().scene)
const dbgTail = await page.evaluate(() => document.getElementById('debug-body')?.innerText?.slice(-260) || '')
pass('5. Portal (TriggerObject) muda de cena por proximidade', sceneChanged, `cena ${before.slice(-6)} → ${after.slice(-6)} | player em (${lastPos ? lastPos.join(',').slice(0, 20) : '?'}) (portal em z=-20)`)
console.log('   debug:', dbgTail.replace(/\n/g, ' | ').slice(0, 220))
await page.screenshot({ path: SS('02-scene2') })

// === 6. NPCs da cena 2 ativos (inimigos chase) ===
// Amostrar IMEDIATAMENTE após a mudança de cena — os inimigos chase param ao
// chegar ao alcance de ataque (dist<1.2), logo amostrar tarde dá falsos negativos.
const e0 = await page.evaluate(() => window._flirGameContext._debugState())
await page.waitForTimeout(3000)
const e1 = await page.evaluate(() => window._flirGameContext._debugState())
let movedE = 0
let arrivedE = 0
for (const id in e1.npcs) {
  const d = Math.hypot(e1.npcs[id][0] - e0.npcs[id][0], e1.npcs[id][2] - e0.npcs[id][2])
  if (d > 0.3) movedE++
  if (e1.player && Math.hypot(e1.npcs[id][0] - e1.player[0], e1.npcs[id][2] - e1.player[2]) < 1.6) arrivedE++
}
pass('6. NPCs da cena 2 ativos (chase)', movedE >= 1 || arrivedE >= 1, `${movedE}/${Object.keys(e1.npcs).length} moveram, ${arrivedE} no alcance de ataque do player`)
console.log('   npcs t0→t3:', JSON.stringify(e0.npcs).slice(0, 130), '→', JSON.stringify(e1.npcs).slice(0, 130))

// === 7. Câmara roda com drag (agora sim — depois do portal) ===
const yawBefore = await page.evaluate(() => window._flirGameContext._debugState().camera.yaw)
await page.mouse.move(640, 400)
await page.mouse.down()
await page.mouse.move(840, 400, { steps: 10 })
await page.mouse.up()
await page.waitForTimeout(600)
const yawAfter = await page.evaluate(() => window._flirGameContext._debugState().camera.yaw)
pass('7. Câmara roda com drag do rato', Math.abs(yawAfter - yawBefore) > 0.05, `yaw ${yawBefore.toFixed(2)} → ${yawAfter.toFixed(2)}`)
await page.screenshot({ path: SS('03-after-drag') })

console.log('\n=== ERROS DE PÁGINA ===')
console.log(pageErrors.length ? pageErrors.join('\n---\n') : '(nenhum)')
console.log('=== ERROS DE CONSOLA ===')
console.log(consoleErrors.length ? consoleErrors.join('\n') : '(nenhum)')

await browser.close()
console.log('\nConcluído.')
