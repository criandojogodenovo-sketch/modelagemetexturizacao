import { chromium } from 'playwright'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto('http://localhost:5173/')
await page.waitForTimeout(2500)
await page.getByRole('button', { name: 'Showcase' }).click()
await page.waitForTimeout(2500)
await page.getByRole('button', { name: /^Play$/ }).click()
await page.waitForTimeout(3500)
const info = await page.evaluate(() => {
  const refs = window._flirConectMeshRefs?.current
  if (!refs) return 'sem refs'
  const out = []
  for (const [id, m] of refs) {
    if (!m?._conect && !m?.userData) continue
    // identificar NPCs pelo formato (grupo com filhos e posição circular)
    out.push({
      id: id.slice(-14),
      pos: [m.position.x.toFixed(2), m.position.y.toFixed(2), m.position.z.toFixed(2)],
      rot: [m.rotation.x.toFixed(3), m.rotation.y.toFixed(3), m.rotation.z.toFixed(3)],
      quat: [m.quaternion.x.toFixed(3), m.quaternion.y.toFixed(3), m.quaternion.z.toFixed(3), m.quaternion.w.toFixed(3)],
      children: m.children?.length,
    })
  }
  return out
})
console.log(JSON.stringify(info, null, 1).slice(0, 2500))
await browser.close()
