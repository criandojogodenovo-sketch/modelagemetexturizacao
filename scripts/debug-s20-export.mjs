import { chromium } from 'playwright'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
const errors = []
page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)))
page.on('console', (m) => { if (m.type() === 'error') errors.push('[console] ' + m.text().slice(0, 150)) })
await page.goto('file:///home/z/my-project/flir-engine/download/showcase-s20-items.html')
await page.waitForTimeout(4000)
const st = await page.evaluate(() => window.__flirPlayState || null)
console.log('playState:', st ? JSON.stringify({ player: st.player, items: st.items.length, npcs: st.npcs.length, checkpoints: st.checkpoints.length }) : 'NULL')
console.log('errors:', errors.slice(0, 6))
await page.screenshot({ path: '/tmp/s20-debug-export.png' })
await browser.close()
