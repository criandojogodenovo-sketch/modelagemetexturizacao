/**
 * debug-s21-connect.mjs — depura porquê o drag-connect do NodeEditor
 * não cria edges no teste (T1). Faz um drag e inspeciona o estado.
 */
import { chromium } from 'playwright'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.on('pageerror', (e) => console.log('[pageerror]', String(e?.message).slice(0, 200)))
page.on('console', (m) => { if (m.type() === 'error') console.log('[console.error]', m.text().slice(0, 200)) })

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

// adicionar voronoi
const addSelect = page.locator('select.input').first()
await addSelect.selectOption('voronoi')
await page.waitForTimeout(400)

// geometria dos sockets
const info = await page.evaluate(() => {
  const canvas = document.querySelector('.node-editor-canvas')
  const nodes = [...canvas.querySelectorAll('div[style*="width: 260px"]')]
  const find = (label) => nodes.find((n) => n.querySelector('span')?.textContent === label)
  const vor = find('Voronoi')
  const ramp = find('Color Ramp')
  const out = vor ? [...vor.querySelectorAll('div[title]')].find((d) => d.title === 'distance (float)') : null
  const inp = ramp ? [...ramp.querySelectorAll('[data-socket]')].find((d) => d.dataset.socket.endsWith('::factor')) : null
  const svg = canvas.querySelector('svg')
  return {
    voronoiFound: !!vor, rampFound: !!ramp,
    outBox: out ? out.getBoundingClientRect().toJSON() : null,
    inBox: inp ? inp.getBoundingClientRect().toJSON() : null,
    edgesBefore: svg.querySelectorAll('g').length,
    socketCount: canvas.querySelectorAll('[data-socket]').length,
  }
})
console.log('[info]', JSON.stringify(info, null, 1))

if (info.outBox && info.inBox) {
  const ax = info.outBox.x + info.outBox.width / 2
  const ay = info.outBox.y + info.outBox.height / 2
  const bx = info.inBox.x + info.inBox.width / 2
  const by = info.inBox.y + info.inBox.height / 2

  // o que está em (bx, by)?
  const hit = await page.evaluate(([x, y]) => {
    const el = document.elementFromPoint(x, y)
    return { tag: el?.tagName, socket: el?.dataset?.socket, title: el?.title, cls: el?.className }
  }, [bx, by])
  console.log('[hit @input]', JSON.stringify(hit))

  await page.mouse.move(ax, ay)
  await page.mouse.down()
  await page.mouse.move(bx, by, { steps: 8 })
  await page.mouse.up()
  await page.waitForTimeout(600)

  const after = await page.evaluate(() => {
    const canvas = document.querySelector('.node-editor-canvas')
    return {
      edgesAfter: canvas.querySelectorAll('svg g').length,
      // ler o grafo do estado React não é direto — mas as edges SVG mostram-nos
    }
  })
  console.log('[after]', JSON.stringify(after))
}

await page.screenshot({ path: '/home/z/my-project/flir-engine/download/screenshots/s21-debug-connect.png' })
await browser.close()
