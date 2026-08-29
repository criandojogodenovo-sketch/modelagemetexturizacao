/**
 * debug-s21-mobile.mjs — verifica porquê o preset mobile (FSR on) não aplica
 * na emulação iPhone. Inspeciona UA, preset detetado e estado do checkbox.
 */
import { chromium } from 'playwright'

const browser = await chromium.launch()
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  hasTouch: true,
  isMobile: true,
})
const page = await ctx.newPage()

await page.goto('http://localhost:5173/')
await page.waitForTimeout(2500)

const info = await page.evaluate(() => {
  // replicar a deteção do realismPresets.js
  const ua = navigator.userAgent || ''
  const isMobileUA = /Android|iPhone|iPad|iPod|Mobile/i.test(ua)
  const cores = navigator.hardwareConcurrency || 8
  const mem = navigator.deviceMemory || 8
  return {
    ua: ua.slice(0, 80),
    isMobileUA, cores, mem,
    localStorageKeys: Object.keys(localStorage),
    storedProject: localStorage.getItem('me3d.project.v1') ? 'EXISTS' : 'null',
  }
})
console.log('[deteção]', JSON.stringify(info, null, 1))

// carregar demo e verificar o renderSettings persistido no localStorage
await page.getByRole('button', { name: 'Showcase' }).click()
await page.waitForTimeout(2500)
const stored = await page.evaluate(() => {
  const raw = localStorage.getItem('me3d.project.v1')
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    const rs = parsed?.state?.renderSettings || parsed?.renderSettings
    return rs ? { fsr: rs.fsr, fsrScale: rs.fsrScale, fsrSharpness: rs.fsrSharpness } : { keys: Object.keys(parsed).slice(0, 10) }
  } catch { return 'parse-error' }
})
console.log('[renderSettings persistido]', JSON.stringify(stored))

await browser.close()
