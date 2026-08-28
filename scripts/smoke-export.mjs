/** smoke-export.mjs — teste rápido de load de um HTML exportado (sem interação) */
import { chromium } from 'playwright'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
const __dirname = dirname(fileURLToPath(import.meta.url))
const file = process.argv[2]
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
await page.goto('file://' + resolve(__dirname, '../download/' + file))
await page.waitForTimeout(6000)
const st = await page.evaluate(() => ({
  splash: document.getElementById('splash')?.style.display || 'not-hid',
  uiEls: document.getElementById('ui-overlay')?.children.length || 0,
  buttons: [...document.querySelectorAll('#ui-overlay button')].map((b) => b.textContent).join(','),
}))
const ok = st.splash === 'none' && st.uiEls > 0 && errors.length === 0
console.log(`${ok ? 'PASS' : 'FAIL'} — ${file}: splash=${st.splash} ui=${st.uiEls} botões=[${st.buttons}] erros=${errors.length ? errors.join(' | ') : '0'}`)
await page.screenshot({ path: resolve(__dirname, `../download/screenshots/s19-smoke-${file.replace('.html', '')}.png`) })
await browser.close()
process.exit(ok ? 0 : 1)
