/**
 * debug-s21-layout.mjs — sonda a geometria do Node Editor (canvas, modal,
 * drawer) para perceber onde os nós caem em ecrã.
 */
import { chromium } from 'playwright'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

await page.goto('http://localhost:5173/')
await page.waitForTimeout(2500)
await page.getByRole('button', { name: 'Showcase' }).click()
await page.waitForTimeout(2500)
await page.getByRole('tab', { name: 'Modelagem' }).click()
await page.waitForTimeout(1200)
await page.mouse.click(700, 420)
await page.waitForTimeout(900)

const nodeSection = page.locator('.collapse-section', { hasText: 'Node Editor (shaders)' }).first()
if (await nodeSection.count() > 0) {
  await nodeSection.locator('h4, .collapse-header, .section-title').first().click().catch(() => {})
  await page.waitForTimeout(400)
}
for (let i = 0; i < 2; i++) {
  const createBtn = page.getByRole('button', { name: 'Criar grafo por defeito' })
  if (await createBtn.count() > 0) { await createBtn.click(); await page.waitForTimeout(700) }
  const openBtn = page.getByRole('button', { name: 'Abrir Node Editor' })
  if (await openBtn.count() > 0) { await openBtn.click(); await page.waitForTimeout(700) }
}

const layout = await page.evaluate(() => {
  const canvas = document.querySelector('.node-editor-canvas')
  if (!canvas) return { canvas: null }
  const cr = canvas.getBoundingClientRect()
  // ancestrais do canvas (para saber em que painel/modal está)
  const chain = []
  let el = canvas.parentElement
  for (let i = 0; i < 6 && el; i++) {
    const r = el.getBoundingClientRect()
    chain.push({ tag: el.tagName, cls: String(el.className).slice(0, 40), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), scrollable: el.scrollHeight > el.clientHeight + 5 })
    el = el.parentElement
  }
  const nodes = [...canvas.querySelectorAll('div[style*="width: 260px"]')].map((n) => {
    const r = n.getBoundingClientRect()
    return { label: n.querySelector('span')?.textContent, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }
  })
  return {
    viewport: { w: window.innerWidth, h: window.innerHeight },
    canvas: { x: Math.round(cr.x), y: Math.round(cr.y), w: Math.round(cr.width), h: Math.round(cr.height) },
    chain,
    nodes,
    docScroll: { x: window.scrollX, y: window.scrollY },
  }
})
console.log(JSON.stringify(layout, null, 1))
await browser.close()
