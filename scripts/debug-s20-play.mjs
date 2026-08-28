import { chromium } from 'playwright'
const browser = await chromium.launch()
const _logs = []
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.on('console', (m) => { if (m.text().includes('npcAI-debug')) _logs.push(m.text()) })
await page.goto('http://localhost:5173/')
await page.waitForTimeout(2500)
await page.getByRole('button', { name: 'Showcase' }).click()
await page.waitForTimeout(2500)
await page.getByRole('button', { name: /^Play$/ }).click()
await page.waitForTimeout(2000)
for (let i = 0; i < 8; i++) {
  const st = await page.evaluate(() => window.__flirPlayState)
  if (st) {
    console.log(`t=${i}: player (${st.player?.x},${st.player?.z}) v=(${st.player?.vx},${st.player?.vz}) | npcs: ${st.npcs.map(n => `(${n.x},${n.z})v=(${n.vx},${n.vz})`).join(' ')}`)
  } else {
    console.log(`t=${i}: sem playState`)
  }
  await page.waitForTimeout(700)
}
await page.screenshot({ path: '/tmp/s20-debug-play.png' })
console.log('NPC DEBUG LOGS:', _logs.slice(0, 5), '| aiDebug:', await page.evaluate(() => window.__flirAiDebug), '| moveDbg:', await page.evaluate(() => window.__flirMoveDbg))
await browser.close()
