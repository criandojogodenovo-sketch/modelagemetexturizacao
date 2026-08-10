/**
 * Captura screenshots de vários painéis da Flir Engine.
 * Usa Playwright com chromium.
 */
import { chromium } from 'playwright'

const BASE_URL = 'http://21.0.15.59:5173/'
const OUT_DIR = '/home/z/my-project/download'

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

async function screenshot(browser, name, actions) {
  const context = await browser.newContext({
    viewport: { width: 414, height: 896 },
    deviceScaleFactor: 2,
  })
  const page = await context.newPage()
  try {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 45000 })
    await sleep(6000)

    if (actions) {
      await actions(page)
      await sleep(2500)
    }

    await page.screenshot({ path: `${OUT_DIR}/after-${name}.png`, fullPage: false })
    console.log(`✓ Screenshot: after-${name}.png`)
  } catch (err) {
    console.error(`✗ Erro em ${name}:`, err.message)
  } finally {
    await context.close()
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true })

  // 1. Home/Editor vazio
  await screenshot(browser, 'editor-empty', async (page) => {
    // Click "Novo Projeto" ou similar se existir
    try {
      await page.click('text=Novo Projeto', { timeout: 3000 })
      await sleep(1000)
    } catch {}
  })

  // 2. Menu principal aberto
  await screenshot(browser, 'main-menu', async (page) => {
    try {
      await page.click('text=Novo Projeto', { timeout: 3000 })
      await sleep(1000)
    } catch {}
    // Abrir menu
    try {
      await page.click('[class*="drawer-toggle"], button:has-text("Menu"), .topbar button:first-child', { timeout: 3000 })
      await sleep(1000)
    } catch {}
  })

  // 3. Conects window
  await screenshot(browser, 'conects', async (page) => {
    try {
      await page.click('text=Novo Projeto', { timeout: 3000 })
      await sleep(1000)
    } catch {}
    // Tentar abrir Conects
    try {
      await page.click('button:has-text("Conects"), [class*="conects"]', { timeout: 3000 })
      await sleep(1500)
    } catch {}
  })

  // 4. Mais ferramentas (grid)
  await screenshot(browser, 'more-tools', async (page) => {
    try {
      await page.click('text=Novo Projeto', { timeout: 3000 })
      await sleep(1000)
    } catch {}
    try {
      await page.click('button:has-text("Mais"), [class*="more"]', { timeout: 3000 })
      await sleep(1500)
    } catch {}
  })

  await browser.close()
  console.log('Done.')
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
