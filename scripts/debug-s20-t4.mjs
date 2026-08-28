import { chromium } from 'playwright'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto('http://localhost:5173/')
await page.waitForTimeout(2500)
await page.getByRole('button', { name: 'Showcase' }).click()
await page.waitForTimeout(2500)
// Modo Modelagem
await page.getByRole('tab', { name: 'Modelagem' }).click()
await page.waitForTimeout(1200)
await page.screenshot({ path: '/tmp/s20-t4a-modelagem.png' })
const propBtn = page.locator('button[title="Propriedades"]')
for (let i = 0; i < await propBtn.count(); i++) {
  console.log(`propBtn[${i}] visible=`, await propBtn.nth(i).isVisible(), 'class=', await propBtn.nth(i).getAttribute('class'))
}
// Estado do painel direito
const rightPanel = await page.locator('aside.panel.right').count()
const rightOpen = await page.locator('aside.panel.right.open').count()
console.log('right panel:', rightPanel, 'open:', rightOpen)
// Clicar no viewport
await page.mouse.click(700, 420)
await page.waitForTimeout(900)
const sel = await page.evaluate(() => document.querySelector('.empty-state')?.textContent?.slice(0, 60) || 'sem empty-state')
console.log('right panel content:', sel)
await page.screenshot({ path: '/tmp/s20-t4b-selected.png' })
// Painel esquerdo
await page.getByRole('button', { name: 'Ferramentas' }).first().click().catch(e => console.log('ferramentas err:', e.message.slice(0, 80)))
await page.waitForTimeout(700)
await page.screenshot({ path: '/tmp/s20-t5a-left.png' })
const animBtns = page.getByRole('button', { name: 'Animação', exact: true })
console.log('animação buttons:', await animBtns.count())
for (let i = 0; i < await animBtns.count(); i++) {
  const b = animBtns.nth(i)
  console.log(`  btn[${i}] visible=${await b.isVisible()}`, await b.getAttribute('class'))
}
const tabLoc = page.locator('.tab-btn', { hasText: 'Animação' })
console.log('tab-btn Animação count:', await tabLoc.count())
const allTabs = await page.locator('.tab-btn').allTextContents()
console.log('all tab-btns:', JSON.stringify(allTabs))
await browser.close()
