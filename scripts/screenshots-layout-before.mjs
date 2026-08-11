/**
 * Screenshots "antes" do redesign de layout.
 * Captura: editor vazio, painel de Conects, editor de UI, terrain editor.
 */
import { chromium } from 'playwright'

const OUT_DIR = '/home/z/my-project/download'
const BASE_URL = 'http://21.0.15.71:5173/'

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function screenshot(browser, name, actions) {
  const context = await browser.newContext({
    viewport: { width: 414, height: 896 },
    deviceScaleFactor: 2,
  })
  const page = await context.newPage()
  try {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 45000 })
    await sleep(5000)
    if (actions) {
      await actions(page)
      await sleep(2500)
    }
    await page.screenshot({ path: `${OUT_DIR}/layout-before-${name}.png`, fullPage: false })
    console.log(`✓ ${name}`)
  } catch (err) {
    console.error(`✗ ${name}: ${err.message}`)
  } finally {
    await context.close()
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true })

  // 1. Editor vazio (viewport + topbar + bottombar)
  await screenshot(browser, 'editor-empty', async (page) => {
    try { await page.click('text=Novo Projeto', { timeout: 3000 }); await sleep(1500) } catch {}
  })

  // 2. Menu principal aberto
  await screenshot(browser, 'main-menu', async (page) => {
    try { await page.click('text=Novo Projeto', { timeout: 3000 }); await sleep(1500) } catch {}
    // Click menu button (último botão da topbar)
    const buttons = await page.$$('.topbar button')
    if (buttons.length > 0) await buttons[buttons.length - 1].click()
    await sleep(1500)
  })

  // 3. Mais ações (grid de ferramentas)
  await screenshot(browser, 'more-tools', async (page) => {
    try { await page.click('text=Novo Projeto', { timeout: 3000 }); await sleep(1500) } catch {}
    // Click "Mais" button
    const moreBtn = await page.$('.topbar-more-btn')
    if (moreBtn) await moreBtn.click()
    await sleep(1500)
  })

  // 4. Conects window
  await screenshot(browser, 'conects', async (page) => {
    try { await page.click('text=Novo Projeto', { timeout: 3000 }); await sleep(1500) } catch {}
    // Abrir menu e clicar em Conects
    const buttons = await page.$$('.topbar button')
    if (buttons.length > 0) await buttons[buttons.length - 1].click()
    await sleep(1500)
    const conectsBtn = await page.$('text=Conects')
    if (conectsBtn) await conectsBtn.click()
    await sleep(2000)
  })

  await browser.close()
  console.log('Done.')
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
