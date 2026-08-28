/** test-arena-buttons.mjs — S19: valida botões móveis PULAR/TIRO/RELOAD no export do Arena */
import { chromium } from 'playwright'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
const __dirname = dirname(fileURLToPath(import.meta.url))
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
await page.goto('file://' + resolve(__dirname, '../download/arena-exported.html'))
await page.waitForTimeout(6000)

const gc = () => page.evaluate(() => window._flirGameContext._debugState())
const pass = (n, ok, d = '') => console.log(`${ok ? 'PASS' : 'FAIL'} — ${n}${d ? ' [' + d + ']' : ''}`)

// PULAR — y sobe
const s0 = await gc()
await page.evaluate(() => { [...document.querySelectorAll('#ui-overlay button')].find((b) => b.textContent === 'PULAR').click() })
await page.waitForTimeout(400)
const s1 = await gc()
pass('Botão PULAR salta', s1.player && s0.player && s1.player[1] > s0.player[1] + 0.3, `y ${s0.player?.[1]?.toFixed(2)} → ${s1.player?.[1]?.toFixed(2)}`)
await page.waitForTimeout(1500)

// TIRO — dispara (gc.shoot chamado; sem armas → log de debug ou munição)
const dbg0 = await page.evaluate(() => document.getElementById('debug-body')?.innerText?.length || 0)
await page.evaluate(() => { [...document.querySelectorAll('#ui-overlay button')].find((b) => b.textContent === 'TIRO').click() })
await page.waitForTimeout(300)
const shootOk = await page.evaluate(() => {
  const t = document.getElementById('debug-body')?.innerText || ''
  return t.includes('shoot') || t.includes('Tiro') || t.includes('disparo') || t.length > dbg0
})
pass('Botão TIRO dispara (gc.shoot)', shootOk)

// RELOAD — gc.reload chamado
await page.evaluate(() => { [...document.querySelectorAll('#ui-overlay button')].find((b) => b.textContent === 'RELOAD').click() })
await page.waitForTimeout(300)
const reloadOk = await page.evaluate(() => {
  const t = document.getElementById('debug-body')?.innerText || ''
  return t.toLowerCase().includes('reload') || t.toLowerCase().includes('recarreg')
})
pass('Botão RELOAD recarrega (gc.reload)', reloadOk)
const dbgTail = await page.evaluate(() => document.getElementById('debug-body')?.innerText?.slice(-260) || '')
console.log('debug tail:', dbgTail.replace(/\n/g, ' | ').slice(0, 240))
console.log('erros:', errors.length ? errors.join(' | ') : '(nenhum)')
await browser.close()
