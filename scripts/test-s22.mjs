/**
 * test-s22.mjs — Sessão 22: Cloud Build de APK no Site.
 *
 * Testes:
 *  T1  Funções serverless api/build-apk*.js importam e exportam handler (Node).
 *  T2  Workflow build-apk.yml: contém repository_dispatch, projeto embebido e
 *      publicação em Release (validação YAML feita à parte com Python).
 *  T3  UI do Cloud Build (API mockada): botão "Gerar APK" → "A gerar APK..."
 *      (polling) → "APK pronto" → download dispara com nome flir-engine.apk;
 *      POST envia o projeto completo (scenes + objects).
 *  T4  Estado de erro: API devolve 500 → mensagem + "Tentar novamente".
 *  T5  Projeto embebido (simula APK): public/embedded-project.json → HomePage
 *      saltada, projeto carregado, Play Mode automático.
 *  T6  Regressão: Showcase carrega + Play Mode entra/sai sem erros.
 *
 * Uso: node scripts/test-s22.mjs  (requer dev server em localhost:5173)
 */
import { chromium } from 'playwright'
import { resolve, dirname } from 'path'
import { writeFileSync, mkdirSync, rmSync, statSync } from 'fs'
import { fileURLToPath } from 'url'
import { readFileSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const SHOTS = resolve(ROOT, 'download/screenshots')
mkdirSync(SHOTS, { recursive: true })

const results = []
function report(name, pass, detail = '') {
  results.push({ name, pass, detail })
  console.log(`${pass ? '✓ PASS' : '✗ FAIL'} — ${name}${detail ? `  (${detail})` : ''}`)
}

function makeErrorCollector(page, tag) {
  const pageErrors = []
  page.on('pageerror', (e) => pageErrors.push(String(e?.message || e).slice(0, 200)))
  return { pageErrors, tag }
}

const browser = await chromium.launch()
const BASE = 'http://localhost:5173'

// ---------- T1: funções serverless ----------
for (const rel of ['../api/build-apk.js', '../api/build-apk/status.js', '../api/build-apk/download.js']) {
  try {
    const mod = await import(rel)
    report(`API ${rel} importa e exporta handler`, typeof mod.default === 'function')
  } catch (e) {
    report(`API ${rel} importa e exporta handler`, false, e.message)
  }
}

// ---------- T2: workflow ----------
try {
  const wf = readFileSync(resolve(ROOT, '.github/workflows/build-apk.yml'), 'utf8')
  report('Workflow tem repository_dispatch (build-apk)', /repository_dispatch:\s*\n\s*types:\s*\[build-apk\]/.test(wf))
  report('Workflow tem workflow_dispatch', /workflow_dispatch:/.test(wf))
  report('Workflow escreve projeto embebido', wf.includes('public/embedded-project.json'))
  report('Workflow publica APK em Release', wf.includes('gh release create'))
  report('Workflow usa JDK 21 (Capacitor 8)', /java-version:\s*'21'/.test(wf))
  report('Workflow faz upload de artifact', wf.includes('upload-artifact@v4'))
} catch (e) {
  report('Workflow legível', false, e.message)
}

// ---------- T3: UI Cloud Build (API mockada) ----------
{
  const page = await browser.newPage()
  const ec = makeErrorCollector(page, 'T3')
  const MOCK_BUILD_ID = `${Date.now()}-deadbeef`
  let postBody = null

  await page.route('**/api/build-apk', async (route) => {
    if (route.request().method() !== 'POST') {
      return route.fulfill({ status: 405, contentType: 'application/json', body: '{"error":"Method not allowed"}' })
    }
    try { postBody = route.request().postDataJSON() } catch { postBody = null }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, buildId: MOCK_BUILD_ID, estimatedSeconds: 180 }),
    })
  })

  let statusCalls = 0
  await page.route('**/api/build-apk/status**', async (route) => {
    statusCalls++
    const states = [
      { status: 'queued', conclusion: null, runId: null },
      { status: 'in_progress', conclusion: null, runId: 123456, htmlUrl: 'https://github.com/fake/run/123456' },
      { status: 'completed', conclusion: 'success', runId: 123456, htmlUrl: 'https://github.com/fake/run/123456' },
    ]
    const state = states[Math.min(statusCalls - 1, 2)]
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(state) })
  })

  await page.route('**/api/build-apk/download**', async (route) => {
    return route.fulfill({
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.android.package-archive',
        'Content-Disposition': 'attachment; filename="flir-engine.apk"',
      },
      body: 'FAKE-APK-BYTES-FOR-TEST-S22',
    })
  })

  // Carregar demo Showcase (projeto com cenas)
  await page.goto(BASE + '/')
  await page.waitForTimeout(2500)
  await page.getByRole('button', { name: 'Showcase' }).click()
  await page.waitForTimeout(2500)

  // Menu principal → Exportar Jogo
  await page.getByRole('button', { name: /Menu principal/ }).click()
  await page.waitForTimeout(600)
  await page.getByRole('button', { name: /Exportar Jogo/ }).click()
  await page.waitForTimeout(800)

  const genBtn = page.getByRole('button', { name: 'Gerar APK', exact: true })
  report('T3: Botão "Gerar APK" visível no modal', await genBtn.isVisible().catch(() => false))
  await page.screenshot({ path: resolve(SHOTS, 's22-t3-modal.png') })

  await genBtn.click()
  await page.waitForTimeout(1200)
  report('T3: Estado "A gerar APK..." durante o build', await page.getByText('A gerar APK').isVisible().catch(() => false))
  report('T3: Barra de progresso presente', await page.locator('.progress-bar').first().isVisible().catch(() => false))
  await page.screenshot({ path: resolve(SHOTS, 's22-t3-building.png') })

  // Espera o ciclo de polling (3 polls × 5s = ~15s)
  const readyOk = await page
    .getByText('APK pronto!')
    .waitFor({ timeout: 30000 })
    .then(() => true)
    .catch(() => false)
  report('T3: Estado "APK pronto" após polling', readyOk)

  const dlLink = page.getByRole('link', { name: /Descarregar APK/ })
  report('T3: Link "Descarregar APK" presente', await dlLink.isVisible().catch(() => false))

  report(
    'T3: POST enviou o projeto (cenas > 0)',
    !!(postBody?.project && Array.isArray(postBody.project.scenes) && postBody.project.scenes.length > 0),
    `scenes=${postBody?.project?.scenes?.length ?? 'n/a'}`,
  )
  report(
    'T3: POST inclui catálogo de objetos (P2-26)',
    Array.isArray(postBody?.project?.objects),
    `objects=${postBody?.project?.objects?.length ?? 'n/a'}`,
  )
  await page.screenshot({ path: resolve(SHOTS, 's22-t3-ready.png') })

  // Download dispara com o nome certo
  try {
    const [download] = await Promise.all([page.waitForEvent('download', { timeout: 10000 }), dlLink.click()])
    const p = await download.path()
    const size = p ? statSync(p).size : 0
    report('T3: Download do APK disparado', size > 0, `${size} bytes`)
    report('T3: Ficheiro sugerido flir-engine.apk', download.suggestedFilename() === 'flir-engine.apk', download.suggestedFilename())
  } catch (e) {
    report('T3: Download do APK disparado', false, e.message)
    report('T3: Ficheiro sugerido flir-engine.apk', false)
  }

  report('T3: Sem page errors', ec.pageErrors.length === 0, ec.pageErrors[0] || '')
  await page.close()
}

// ---------- T4: estado de erro ----------
{
  const page = await browser.newPage()
  const ec = makeErrorCollector(page, 'T4')
  await page.route('**/api/build-apk', async (route) => {
    return route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'O token do GitHub não tem permissões suficientes.' }),
    })
  })

  await page.goto(BASE + '/')
  await page.waitForTimeout(2500)
  await page.getByRole('button', { name: 'Showcase' }).click()
  await page.waitForTimeout(2500)
  await page.getByRole('button', { name: /Menu principal/ }).click()
  await page.waitForTimeout(600)
  await page.getByRole('button', { name: /Exportar Jogo/ }).click()
  await page.waitForTimeout(800)

  await page.getByRole('button', { name: 'Gerar APK', exact: true }).click()
  const errVisible = await page
    .getByText('token do GitHub não tem permissões')
    .waitFor({ timeout: 8000 })
    .then(() => true)
    .catch(() => false)
  report('T4: Mensagem de erro da API exibida', errVisible)
  report('T4: Botão "Tentar novamente" presente', await page.getByRole('button', { name: 'Tentar novamente' }).isVisible().catch(() => false))
  await page.screenshot({ path: resolve(SHOTS, 's22-t4-error.png') })
  report('T4: Sem page errors', ec.pageErrors.length === 0, ec.pageErrors[0] || '')
  await page.close()
}

// ---------- T5: projeto embebido (simula APK) ----------
{
  const embeddedPath = resolve(ROOT, 'public/embedded-project.json')
  const EMBEDDED = {
    version: 4,
    createdAt: new Date().toISOString(),
    appMode: 'scene',
    projectName: 'Jogo Embebido Teste',
    scenes: [
      { id: 'sc_emb', name: 'Cena Embebida', objects: [], conects: [], playerObjectId: null },
    ],
    activeSceneId: 'sc_emb',
    scene: { objects: [], background: {}, grid: {}, lights: {} },
  }
  writeFileSync(embeddedPath, JSON.stringify(EMBEDDED))

  try {
    const page = await browser.newPage()
    const ec = makeErrorCollector(page, 'T5')
    const logs = []
    page.on('console', (m) => logs.push(m.text()))

    await page.goto(BASE + '/')
    await page.waitForTimeout(4000)

    report('T5: Projeto embebido carregado (console log)', logs.some((l) => l.includes('[EmbeddedProject]')))
    const homeVisible = await page.getByRole('button', { name: 'Showcase' }).isVisible().catch(() => false)
    report('T5: HomePage saltada (sem botão Showcase)', !homeVisible)
    report('T5: Play Mode automático (overlay visível)', await page.locator('.scene-preview-overlay').isVisible().catch(() => false))
    report(
      'T5: Cena ativa é a do projeto embebido',
      await page.locator('.preview-info').getByText('Cena Embebida').isVisible().catch(() => false),
    )
    await page.screenshot({ path: resolve(SHOTS, 's22-t5-embedded.png') })
    report('T5: Sem page errors', ec.pageErrors.length === 0, ec.pageErrors[0] || '')
    await page.close()
  } finally {
    rmSync(embeddedPath, { force: true })
  }
}

// ---------- T6: regressão Play Mode ----------
{
  const page = await browser.newPage()
  const ec = makeErrorCollector(page, 'T6')
  await page.goto(BASE + '/')
  await page.waitForTimeout(2500)
  await page.getByRole('button', { name: 'Showcase' }).click()
  await page.waitForTimeout(2500)

  // Play pelo botão do SceneEditorPanel
  await page.getByRole('button', { name: /^Play$/ }).click()
  await page.waitForTimeout(1500)
  report('T6: Play Mode abre (overlay)', await page.locator('.scene-preview-overlay').isVisible().catch(() => false))
  await page.screenshot({ path: resolve(SHOTS, 's22-t6-play.png') })
  await page.keyboard.press('Escape')
  await page.waitForTimeout(800)
  report('T6: Escape fecha o Play Mode', !(await page.locator('.scene-preview-overlay').isVisible().catch(() => false)))
  report('T6: Sem page errors', ec.pageErrors.length === 0, ec.pageErrors[0] || '')
  await page.close()
}

await browser.close()

// ---------- resumo ----------
const passCount = results.filter((r) => r.pass).length
console.log(`\n${passCount}/${results.length} testes PASS`)
writeFileSync(
  resolve(ROOT, 'download/s22-test-results.json'),
  JSON.stringify({ session: 22, date: new Date().toISOString(), total: results.length, pass: passCount, results }, null, 2),
)
process.exit(passCount === results.length ? 0 : 1)
