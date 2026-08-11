import { chromium } from 'playwright'

async function main() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 414, height: 896 },
    deviceScaleFactor: 2,
  })
  const page = await context.newPage()
  try {
    await page.goto('https://modelagemetexturizacao-dtrhrwefu-mad-ae04.vercel.app/', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    })
    await new Promise(r => setTimeout(r, 5000))
    await page.screenshot({ path: '/home/z/my-project/download/prod-after-fix.png' })
    console.log('Screenshot saved')
  } catch (err) {
    console.error('Error:', err.message)
  } finally {
    await browser.close()
  }
}
main()
