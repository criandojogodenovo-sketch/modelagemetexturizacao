/**
 * Debug — vê o que está a ser carregado.
 */
import { chromium } from 'playwright'

const BASE_URL = 'http://21.0.15.59:5173/'

async function main() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 414, height: 896 },
    deviceScaleFactor: 2,
  })
  const page = await context.newPage()

  page.on('console', msg => console.log('CONSOLE:', msg.text()))
  page.on('pageerror', err => console.log('PAGEERROR:', err.message))
  page.on('requestfailed', req => console.log('REQFAIL:', req.url(), req.failure()?.errorText))

  try {
    const resp = await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
    console.log('Status:', resp?.status())
    console.log('URL:', page.url())
    await new Promise(r => setTimeout(r, 3000))
    const title = await page.title()
    console.log('Title:', title)
    const bodyText = await page.evaluate(() => document.body?.innerText?.slice(0, 500))
    console.log('Body text:', bodyText)
    await page.screenshot({ path: '/home/z/my-project/download/debug-test.png' })
    console.log('Screenshot saved')
  } catch (err) {
    console.error('Error:', err.message)
  } finally {
    await browser.close()
  }
}

main()
