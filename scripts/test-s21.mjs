/**
 * test-s21.mjs — Sessão 21: suite de validação.
 *
 * Testes:
 *  T1  Node Editor: nós procedurais Voronoi/Wave/Noise adicionáveis via UI,
 *      ligáveis por drag, GLSL compila sem erros de shader, bake sem crash.
 *  T2  Presets de realismo: desktop → FSR OFF por defeito;
 *      emulação mobile (iPhone UA) → FSR ON por defeito (scale 0.6).
 *  T3  Regressão Play Mode: showcase — NPCs patrulham de pé, player anda (WASD).
 *  T4  Realismo desktop (SSR com uMaxSteps novo + DDGI) sem erros WebGL.
 *
 * Uso: node scripts/test-s21.mjs  (requer dev server em localhost:5173)
 */
import { chromium } from 'playwright'
import { resolve, dirname } from 'path'
import { writeFileSync, mkdirSync } from 'fs'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SHOTS = resolve(__dirname, '../download/screenshots')
mkdirSync(SHOTS, { recursive: true })

const results = []
function report(name, pass, detail = '') {
  results.push({ name, pass, detail })
  console.log(`${pass ? '✓ PASS' : '✗ FAIL'} — ${name}${detail ? `  (${detail})` : ''}`)
}

const browser = await chromium.launch()

// ---------- helpers ----------
function makeErrorCollector(page, tag) {
  const shaderErrors = []
  const pageErrors = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const t = msg.text()
      if (/Shader Error|WebGLProgram|GLSL|glsl|shader failed|ERROR: 0:/i.test(t)) shaderErrors.push(t.slice(0, 200))
    }
  })
  page.on('pageerror', (e) => pageErrors.push(String(e?.message || e).slice(0, 200)))
  return { shaderErrors, pageErrors, tag }
}

async function loadDemo(page, name = 'showcase') {
  await page.goto('http://localhost:5173/')
  await page.waitForTimeout(2500)
  const btn = name === 'showcase' ? 'Showcase' : name === 'arena' ? 'Demo FPS' : 'RPG Saga'
  await page.getByRole('button', { name: btn }).click()
  await page.waitForTimeout(2500)
}

/** Centro (coordenadas de ecrã) de um socket do node editor */
async function socketCenter(page, nodeLabel, socketName, isOutput) {
  return page.evaluate(([label, sock, out]) => {
    const canvas = document.querySelector('.node-editor-canvas')
    if (!canvas) return null
    const nodes = [...canvas.querySelectorAll('div[style*="width: 260px"]')]
    const node = nodes.find((n) => {
      const s = n.querySelector('span')
      return s && s.textContent === label
    })
    if (!node) return null
    let el = null
    if (out) {
      el = [...node.querySelectorAll('div[title]')].find((d) => d.getAttribute('title') === sock)
    } else {
      el = [...node.querySelectorAll('[data-socket]')].find((d) => d.dataset.socket.endsWith('::' + sock))
    }
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  }, [nodeLabel, socketName, isOutput])
}

/** Liga output→input por drag real (mesmo caminho do utilizador) */
async function connect(page, fromNode, fromSock, toNode, toSock) {
  const a = await socketCenter(page, fromNode, fromSock, true)
  const b = await socketCenter(page, toNode, toSock, false)
  if (!a || !b) return false
  await page.mouse.move(a.x, a.y)
  await page.mouse.down()
  await page.mouse.move(b.x, b.y, { steps: 10 })
  await page.mouse.up()
  await page.waitForTimeout(250)
  return true
}

// ================= T1: nós procedurais no Node Editor =================
console.log('\n=== T1: Node Editor — Voronoi/Wave/Noise (UI + GLSL + bake) ===')
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const col = makeErrorCollector(page, 'T1')
  try {
    await loadDemo(page, 'showcase')
    await page.getByRole('tab', { name: 'Modelagem' }).click()
    await page.waitForTimeout(1200)
    await page.mouse.click(700, 420) // selecionar objeto no viewport
    await page.waitForTimeout(900)

    // Expandir Node Editor + criar grafo por defeito se necessário
    const nodeSection = page.locator('.collapse-section', { hasText: 'Node Editor (shaders)' }).first()
    if (await nodeSection.count() > 0) {
      await nodeSection.locator('h4, .collapse-header, .section-title').first().click().catch(() => {})
      await page.waitForTimeout(400)
    }
    for (let i = 0; i < 2; i++) {
      const createBtn = page.getByRole('button', { name: 'Criar grafo por defeito' })
      if (await createBtn.count() > 0) { await createBtn.click(); await page.waitForTimeout(700) }
      const openBtn = page.getByRole('button', { name: 'Abrir Node Editor' })
      if (await openBtn.count() > 0) { await openBtn.click(); await page.waitForTimeout(700) }
    }
    const hasCanvas = await page.locator('.node-editor-canvas').count()
    report('T1 Node Editor abre com canvas', hasCanvas > 0)

    if (hasCanvas > 0) {
      // Verificar que os 3 novos nós estão no menu "+ Adicionar nó…"
      const menuOptions = await page.evaluate(() => {
        const sel = document.querySelector('.node-editor-canvas')
          ?.parentElement?.querySelector('select') || document.querySelector('select.input')
        return sel ? [...sel.options].map((o) => o.value) : []
      })
      report('T1 menu contém Voronoi', menuOptions.includes('voronoi'), menuOptions.length + ' opções')
      report('T1 menu contém Wave', menuOptions.includes('wave'))
      report('T1 menu contém Noise', menuOptions.includes('noise'))

      // Adicionar os 3 nós via menu (dropdown está fora do canvas)
      const addSelect = page.locator('select.input').first()
      for (const type of ['voronoi', 'wave', 'noise']) {
        await addSelect.selectOption(type)
        await page.waitForTimeout(350)
      }
      // Nós presentes no canvas?
      const labels = await page.evaluate(() => {
        const nodes = [...document.querySelectorAll('.node-editor-canvas div[style*="width: 260px"]')]
        return nodes.map((n) => n.querySelector('span')?.textContent).filter(Boolean)
      })
      report('T1 nós Voronoi/Wave/Noise adicionados via UI',
        labels.includes('Voronoi') && labels.includes('Wave') && labels.includes('Noise'),
        labels.join(','))

      // Ligar: voronoi.distance → ColorRamp.factor
      const c1 = await connect(page, 'Voronoi', 'distance (float)', 'Color Ramp', 'factor')
      // wave.value → Principled BSDF.roughness
      const c2 = await connect(page, 'Wave', 'value (float)', 'Principled BSDF', 'roughness')
      // noise.value → Principled BSDF.metalness
      const c3 = await connect(page, 'Noise', 'value (float)', 'Principled BSDF', 'metalness')
      report('T1 ligações criadas por drag (3 edges)', c1 && c2 && c3, `${c1}/${c2}/${c3}`)

      // Contar edges no SVG (2 paths por edge: hit + visível)
      const edgePaths = await page.evaluate(() => {
        const svg = document.querySelector('.node-editor-canvas svg')
        return svg ? svg.querySelectorAll('g').length : 0
      })
      report('T1 grafo tem ≥5 edges (3 default + 3 novas − substituição)', edgePaths >= 5, `${edgePaths} edges`)

      // Aplicar GLSL ao material real
      await page.getByRole('button', { name: 'Aplicar GLSL' }).click()
      await page.waitForTimeout(1500)
      report('T1 GLSL compila sem erros de shader (Voronoi+Wave+Noise)',
        col.shaderErrors.length === 0, col.shaderErrors[0] || '0 erros')

      // Screenshot do editor com os novos nós
      await page.screenshot({ path: resolve(SHOTS, 's21-t1-node-editor-procedural.png') })

      // Bake (avaliador CPU espelhado — valida voronoi2/wave1/fbm em JS)
      await page.getByRole('button', { name: 'Bake', exact: true }).click()
      await page.waitForTimeout(2200)
      report('T1 bake CPU (espelho JS) sem crash', col.pageErrors.length === 0, col.pageErrors[0] || '0 page errors')

      // Visual: após aplicar, o objeto renderiza diferente (sem crash WebGL)
      await page.waitForTimeout(800)
      await page.screenshot({ path: resolve(SHOTS, 's21-t1-aplicado.png') })
    }
  } catch (e) {
    report('T1 execução', false, e.message.slice(0, 160))
  }
  await page.close()
}

// ================= T2: presets desktop vs mobile =================
console.log('\n=== T2: Presets de realismo — desktop FSR off · mobile FSR on ===')
{
  // --- Desktop (UA normal do chromium headless) ---
  const pageD = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  try {
    await loadDemo(pageD, 'showcase') // o Menu principal só existe dentro do editor
    await pageD.getByRole('button', { name: /Menu principal/ }).click()
    await pageD.waitForTimeout(500)
    await pageD.getByRole('button', { name: /Configurações|Settings/ }).click()
    await pageD.waitForTimeout(900)
    const fsrRowD = pageD.getByText('FSR (upscaling)').locator('..').locator('input[type="checkbox"]')
    const checkedD = await fsrRowD.isChecked()
    report('T2 desktop: FSR desligado por defeito', checkedD === false, `checked=${checkedD}`)
    await pageD.keyboard.press('Escape')
  } catch (e) {
    report('T2 desktop execução', false, e.message.slice(0, 140))
  }
  await pageD.close()

  // --- Mobile (emulação iPhone) ---
  const ctxM = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    hasTouch: true,
    isMobile: true,
  })
  const pageM = await ctxM.newPage()
  const colM = makeErrorCollector(pageM, 'T2')
  try {
    await loadDemo(pageM, 'showcase')
    await pageM.getByRole('button', { name: /Menu principal/ }).click()
    await pageM.waitForTimeout(600)
    await pageM.getByRole('button', { name: /Configurações|Settings/ }).first().click()
    await pageM.waitForTimeout(900)
    const fsrRowM = pageM.getByText('FSR (upscaling)').locator('..').locator('input[type="checkbox"]')
    const checkedM = await fsrRowM.isChecked()
    report('T2 mobile (iPhone UA): FSR ligado por defeito', checkedM === true, `checked=${checkedM}`)

    if (checkedM) {
      // escala 0.6 selecionada por defeito
      const scaleVal = await pageM.evaluate(() => {
        const sels = [...document.querySelectorAll('select')]
        const fsrSel = sels.find((s) => [...s.options].some((o) => o.text.includes('Mobile')))
        return fsrSel ? fsrSel.value : null
      })
      report('T2 mobile: escala FSR 0.6 por defeito', String(scaleVal) === '0.6', `scale=${scaleVal}`)
    }
    await pageM.screenshot({ path: resolve(SHOTS, 's21-t2-mobile-fsr-preset.png') })
    await pageM.keyboard.press('Escape').catch(() => {})
    report('T2 mobile: sem erros WebGL com FSR ativo', colM.shaderErrors.length === 0, colM.shaderErrors[0] || '0 erros')
  } catch (e) {
    report('T2 mobile execução', false, e.message.slice(0, 140))
  }
  await ctxM.close()
}

// ================= T3: regressão Play Mode (showcase) =================
console.log('\n=== T3: Regressão Play Mode — NPCs + player ===')
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  try {
    await loadDemo(page, 'showcase')
    await page.getByRole('button', { name: /^Play$/ }).click()
    await page.waitForTimeout(2200) // splash
    const s0 = await page.evaluate(() => window.__flirPlayState || null)
    await page.waitForTimeout(4000)
    const s1 = await page.evaluate(() => window.__flirPlayState || null)

    if (!s1 || !s1.npcs?.length) {
      report('T3 NPCs no estado de jogo', false, 'sem NPCs')
    } else {
      const moved = s1.npcs.filter((n, i) => {
        const prev = s0?.npcs?.[i]
        return prev && (Math.abs(n.x - prev.x) + Math.abs(n.z - prev.z)) > 0.5
      })
      report('T3 NPCs patrulham (regressão S20)', moved.length > 0, `${moved.length}/${s1.npcs.length} moveram`)
      const upright = s1.npcs.filter((n) => Math.abs(n.qx) < 0.35 && Math.abs(n.qz) < 0.35 && n.y > -0.5 && n.y < 6)
      report('T3 NPCs de pé (sem tombar)', upright.length === s1.npcs.length)
    }

    // Player move com WASD (mantêm teclas pressionadas 1.2s)
    if (s1?.player) {
      const p0 = s1.player
      await page.keyboard.down('w')
      await page.waitForTimeout(1200)
      await page.keyboard.up('w')
      const s2 = await page.evaluate(() => window.__flirPlayState || null)
      const p1 = s2?.player
      const dist = p1 ? Math.hypot(p1.x - p0.x, p1.z - p0.z) : 0
      report('T3 player anda com W (regressão)', dist > 0.5, `deslocou ${dist.toFixed(2)}u`)
    }
    await page.screenshot({ path: resolve(SHOTS, 's21-t3-play-mode.png') })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(600)
  } catch (e) {
    report('T3 execução', false, e.message.slice(0, 140))
  }
  await page.close()
}

// ================= T4: realismo desktop — SSR (uMaxSteps) + DDGI =================
console.log('\n=== T4: Realismo desktop — SSR novo uniform + DDGI sem erros ===')
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const col = makeErrorCollector(page, 'T4')
  try {
    await loadDemo(page, 'showcase')
    await page.getByRole('button', { name: /Menu principal/ }).click()
    await page.waitForTimeout(500)
    await page.getByRole('button', { name: /Configurações|Settings/ }).click()
    await page.waitForTimeout(900)
    const giCb = page.getByText('DDGI (GI dinâmica por probes)').locator('..').locator('input[type="checkbox"]')
    if (await giCb.count() > 0) await giCb.check()
    await page.waitForTimeout(200)
    const ssrCb = page.getByText('SSR (reflexos Hi-Z)').locator('..').locator('input[type="checkbox"]')
    if (await ssrCb.count() > 0) await ssrCb.check()
    await page.waitForTimeout(300)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(2500) // DDGI probes + SSR frames
    await page.screenshot({ path: resolve(SHOTS, 's21-t4-realismo-ssr-ddgi.png') })
    report('T4 SSR (uMaxSteps) + DDGI sem erros de shader', col.shaderErrors.length === 0,
      col.shaderErrors[0] || '0 erros')
  } catch (e) {
    report('T4 execução', false, e.message.slice(0, 140))
  }
  await page.close()
}

// ================= Resumo =================
console.log('\n==========================================')
const pass = results.filter((r) => r.pass).length
console.log(`RESULTADO S21: ${pass}/${results.length} PASS`)
results.filter((r) => !r.pass).forEach((r) => console.log(`  ✗ ${r.name}: ${r.detail}`))
console.log('==========================================')
writeFileSync(resolve(__dirname, '../download/s21-test-results.json'), JSON.stringify(results, null, 2))
await browser.close()
process.exit(pass === results.length ? 0 : 1)
