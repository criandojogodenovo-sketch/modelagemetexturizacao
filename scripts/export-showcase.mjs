/**
 * export-showcase.mjs — S19: exporta o FlirQuest Showcase para HTML standalone
 * através do GameExportModal real (fluxo UI → exportGame → download interceptado).
 *
 * Uso: node scripts/export-showcase.mjs [nome-demo: showcase|arena|saga]
 * Output: download/showcase-exported.html (ou <demo>-exported.html)
 */
import { chromium } from 'playwright'
import { resolve, dirname } from 'path'
import { writeFileSync } from 'fs'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const demo = process.argv[2] || 'showcase'
const outFile = resolve(__dirname, `../download/${demo}-exported.html`)

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto('http://localhost:5173/')
await page.waitForTimeout(2500)

// Carregar demo
await page.getByRole('button', { name: demo === 'showcase' ? 'Showcase' : demo === 'arena' ? 'Demo FPS' : 'RPG Saga' }).click()
await page.waitForTimeout(2500)

// Interceptar download (blob)
await page.evaluate(() => {
  window.__capturedBlobs = []
  const origCreate = URL.createObjectURL
  window.URL.createObjectURL = function (blob) { window.__capturedBlobs.push(blob); return origCreate.call(this, blob) }
})

// Menu principal → Exportar Jogo → Exportar Jogo
await page.getByRole('button', { name: /Menu principal/ }).click()
await page.waitForTimeout(600)
await page.getByRole('button', { name: /Exportar Jogo HTML standalone/ }).click()
await page.waitForTimeout(600)
await page.getByRole('button', { name: 'Exportar Jogo', exact: true }).click()
await page.waitForTimeout(3000)

const n = await page.evaluate(() => window.__capturedBlobs.length)
if (n < 1) { console.error('FALHOU: nenhum blob capturado'); process.exit(1) }
const html = await page.evaluate(async () => await window.__capturedBlobs[0].text())
writeFileSync(outFile, html, 'utf-8')

// Verificação rápida dos dados embutidos
const m = html.match(/window\.__GAME_DATA__ = (.*?);\s*<\/script>/s)
const data = JSON.parse(m[1])
console.log(`✓ Exportado: ${outFile} (${(html.length / 1024).toFixed(0)} KB)`)
console.log(`  cenas: ${data.scenes.map((s) => s.name).join(' | ')}`)
console.log(`  catálogo: ${(data.objects || []).length} objetos | uiScreens: ${(data.uiScreens || []).length}`)
console.log(`  runtime: TriggerObject=${html.includes("conect.type === 'TriggerObject'")} | clampSpawn=${html.includes('halfH + 0.02')} | substeps10=${html.includes('delta, 10)')}`)
await browser.close()
