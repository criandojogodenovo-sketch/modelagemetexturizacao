import { chromium } from 'playwright'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errors = []
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message.slice(0, 300)))
page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text().slice(0, 3000)) })
await page.goto('http://localhost:5173/')
await page.waitForTimeout(2500)
await page.getByRole('button', { name: 'Showcase' }).click()
await page.waitForTimeout(2500)
await page.getByRole('tab', { name: 'Modelagem' }).click()
await page.waitForTimeout(1200)
await page.mouse.click(700, 420)
await page.waitForTimeout(900)
// Expandir Node Editor (secção colapsada por defeito)
const sec = page.locator('.collapse-section', { hasText: 'Node Editor (shaders)' }).first()
console.log('section found:', await sec.count())
await sec.locator('.collapse-header').first().click().catch(async () => {
  await sec.locator('h4').first().click().catch(() => {})
})
await page.waitForTimeout(500)
let openBtn = page.getByRole('button', { name: 'Abrir Node Editor' })
console.log('openBtn (após expandir):', await openBtn.count())
if (await openBtn.count() === 0) {
  // tentar header genérico
  await sec.click()
  await page.waitForTimeout(400)
  openBtn = page.getByRole('button', { name: 'Abrir Node Editor' })
  console.log('openBtn 2ª tentativa:', await openBtn.count())
}
if (await openBtn.count() > 0) { await openBtn.click(); await page.waitForTimeout(700) }
// criar grafo (o editor abre em "sem grafo" → criar)
const createBtn = page.getByRole('button', { name: 'Criar grafo por defeito' })
console.log('createBtn:', await createBtn.count())
if (await createBtn.count() > 0) { await createBtn.click(); await page.waitForTimeout(800) }
console.log('canvas:', await page.locator('.node-editor-canvas').count())
// Aplicar GLSL
const applyBtn = page.getByRole('button', { name: 'Aplicar GLSL' })
console.log('apply btn:', await applyBtn.count())
if (await applyBtn.count() > 0) {
  await applyBtn.click()
  await page.waitForTimeout(1500)
  console.log('after apply — errors so far:', errors.length)
}
// Bake
const bakeBtn = page.getByRole('button', { name: 'Bake', exact: true })
console.log('bake btn:', await bakeBtn.count())
if (await bakeBtn.count() > 0) {
  await bakeBtn.click()
  await page.waitForTimeout(2500)
}
console.log('after bake — errors:', errors.length)
errors.slice(0, 3).forEach((e) => console.log(' ', e))
await page.screenshot({ path: '/tmp/s20-t4-crash.png' })
await browser.close()
