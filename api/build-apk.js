/**
 * /api/build-apk — aciona o Cloud Build do APK no GitHub Actions.
 *
 * Fluxo (Cloud Build no site, sem PC nem Android Studio):
 *  1. O browser faz POST { project } para este endpoint.
 *  2. Este endpoint guarda o projeto do utilizador num ficheiro
 *     builds/<buildId>.json no branch dedicado `apk-projects` (via GitHub
 *     Contents API — o client_payload do repository_dispatch tem um limite
 *     HARD de ~64KB, testado empiricamente, e projetos reais como o Showcase
 *     têm ~420KB, logo o projeto TEM de viajar fora do payload).
 *  3. Dispara um repository_dispatch (event_type: build-apk) com APENAS o
 *     buildId no client_payload.
 *  4. O workflow .github/workflows/build-apk.yml obtém o ficheiro do branch
 *     (gh api), escreve-o em public/embedded-project.json, compila o APK e
 *     publica-o num Release (tag apk-<buildId>). No fim apaga o ficheiro.
 *  5. O browser faz polling a /api/build-apk/status?buildId=... e, quando
 *     pronto, descarrega via /api/build-apk/download?buildId=... (302 para
 *     o asset público do Release).
 *
 * Variáveis de ambiente obrigatórias (Vercel → Settings → Environment Variables):
 *  - GITHUB_TOKEN — token com scope 'repo' (contents + dispatchs). Para o
 *    push do ficheiro .github/workflows/build-apk.yml é ainda preciso o
 *    scope 'workflow' (uma única vez). Guardar como segredo.
 *  - GITHUB_OWNER — ex.: criandojogodenovo-sketch
 *  - GITHUB_REPO  — ex.: modelagemetexturizacao
 *
 * Associação buildId → run do workflow: as Vercel Functions não partilham
 * memória entre invocações, por isso o buildId codifica o epoch do disparo
 * ("<epoch-ms>-<hex aleatório>") e o /status encontra o run correspondente
 * por timestamp — sem necessidade de Vercel KV/Blob.
 *
 * Limites:
 *  - Projeto: máx. 4MB (limite do corpo do pedido das Vercel Functions é
 *    4.5MB; a Contents API aceita muito mais, mas 4MB é margem segura).
 *  - O branch `apk-projects` é público (repo público) — o projeto fica
 *    visível apenas durante o build e é apagado no fim. O APK (Release)
 *    é público de qualquer forma.
 */
import { randomBytes } from 'crypto'

const MAX_PROJECT_BYTES = 4 * 1024 * 1024 // 4MB (limite request body Vercel: 4.5MB)
const PROJECTS_BRANCH = 'apk-projects'
const RATE_WINDOW_MS = 10 * 60 * 1000 // janela de rate limit: 10 minutos
const RATE_MAX = 3 // máx. 3 builds por IP por janela

const GH_HEADERS = {
  Accept: 'application/vnd.github+json',
  'Content-Type': 'application/json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'flir-engine-cloud-build',
}

// Rate limit em memória — por instância quente da função. Não é perfeito
// (Vercel pode frio/reiniciar instâncias), mas bloqueia abusos óbvios sem
// introduzir dependências externas (KV/Blob).
const hits = new Map()

function tooManyRequests(ip) {
  const now = Date.now()
  const recent = (hits.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS)
  hits.set(ip, recent)
  return recent.length >= RATE_MAX
}

function recordHit(ip) {
  const now = Date.now()
  const recent = (hits.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS)
  recent.push(now)
  hits.set(ip, recent)
}

async function gh(method, path, token, body) {
  let response
  try {
    response = await fetch(`https://api.github.com${path}`, {
      method,
      headers: {
        ...GH_HEADERS,
        Authorization: `Bearer ${token}`,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch (err) {
    return { status: 0, data: null, error: err?.message }
  }
  let data = null
  try {
    data = await response.json()
  } catch {
    /* resposta sem corpo (204/404) */
  }
  return { status: response.status, data }
}

/** Garantir que o branch apk-projects existe (cria a partir do main) */
async function ensureProjectsBranch(owner, repo, token) {
  // Já existe?
  let r = await gh('GET', `/repos/${owner}/${repo}/git/ref/heads/${PROJECTS_BRANCH}`, token)
  if (r.status === 200) return { ok: true }

  // Criar a partir do HEAD do branch default
  const main = await gh('GET', `/repos/${owner}/${repo}/git/ref/heads/main`, token)
  if (main.status !== 200) {
    return { ok: false, error: `Branch main não encontrado (HTTP ${main.status}).` }
  }
  r = await gh('POST', `/repos/${owner}/${repo}/git/refs`, token, {
    ref: `refs/heads/${PROJECTS_BRANCH}`,
    sha: main.data.object.sha,
  })
  if (r.status === 201) return { ok: true }
  // Race: outro build criou entretanto → verificar de novo
  if (r.status === 422) {
    const again = await gh('GET', `/repos/${owner}/${repo}/git/ref/heads/${PROJECTS_BRANCH}`, token)
    if (again.status === 200) return { ok: true }
  }
  return { ok: false, error: `Falha ao criar branch ${PROJECTS_BRANCH} (HTTP ${r.status}).` }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const token = process.env.GITHUB_TOKEN
  const owner = process.env.GITHUB_OWNER
  const repo = process.env.GITHUB_REPO
  if (!token || !owner || !repo) {
    console.error('[build-apk] Env em falta:', { token: !!token, owner: !!owner, repo: !!repo })
    return res.status(500).json({
      error:
        'Servidor não configurado: define GITHUB_TOKEN, GITHUB_OWNER e GITHUB_REPO nas variáveis de ambiente da Vercel.',
    })
  }

  // Rate limit por IP (protege os minutos de Actions do repo)
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown'
  if (tooManyRequests(ip)) {
    return res.status(429).json({
      error: `Demasiados builds a partir deste endereço (máx. ${RATE_MAX} por 10 minutos). Tenta novamente dentro de alguns minutos.`,
    })
  }

  // Validação do projeto
  const { project } = req.body || {}
  if (!project || typeof project !== 'object' || Array.isArray(project)) {
    return res.status(400).json({ error: 'Payload inválido: falta o campo "project" (objeto).' })
  }
  const hasScenes = Array.isArray(project.scenes) && project.scenes.length > 0
  const hasObjects =
    project.scene && Array.isArray(project.scene.objects) && project.scene.objects.length > 0
  if (!hasScenes && !hasObjects) {
    return res.status(400).json({
      error: 'O projeto está vazio — cria o teu jogo antes de gerar o APK.',
    })
  }

  const projectJson = JSON.stringify(project)
  const projectBytes = Buffer.byteLength(projectJson, 'utf8')
  if (projectBytes > MAX_PROJECT_BYTES) {
    return res.status(413).json({
      error: `Projeto demasiado grande (${(projectBytes / 1024 / 1024).toFixed(1)}MB; máximo 4MB).`,
    })
  }

  const buildId = `${Date.now()}-${randomBytes(4).toString('hex')}`

  // 1) Garantir branch apk-projects
  const branch = await ensureProjectsBranch(owner, repo, token)
  if (!branch.ok) {
    console.error('[build-apk] Branch falhou:', branch.error)
    return res.status(500).json({ error: branch.error })
  }

  // 2) Guardar o projeto em builds/<buildId>.json (Contents API)
  const put = await gh('PUT', `/repos/${owner}/${repo}/contents/builds/${buildId}.json`, token, {
    message: `apk build ${buildId} [auto]`,
    content: Buffer.from(projectJson, 'utf8').toString('base64'),
    branch: PROJECTS_BRANCH,
  })
  if (put.status !== 201) {
    console.error('[build-apk] Contents PUT falhou:', put.status, JSON.stringify(put.data).slice(0, 300))
    return res.status(500).json({ error: `Falha ao guardar o projeto (HTTP ${put.status}).` })
  }

  // 3) Disparar o workflow — APENAS o buildId (o limite do client_payload
  //    é ~64KB; o projeto já está no branch)
  const dispatch = await gh('POST', `/repos/${owner}/${repo}/dispatches`, token, {
    event_type: 'build-apk',
    client_payload: { buildId },
  })
  if (dispatch.status !== 204) {
    console.error(
      '[build-apk] Dispatch falhou:', dispatch.status, JSON.stringify(dispatch.data).slice(0, 300),
    )
    // Limpar o ficheiro do projeto se o dispatch falhou
    try {
      await gh('DELETE', `/repos/${owner}/${repo}/contents/builds/${buildId}.json`, token, {
        message: `cleanup: dispatch falhou para ${buildId} [auto]`,
        sha: put.data?.content?.sha,
        branch: PROJECTS_BRANCH,
      })
    } catch {
      /* best-effort */
    }
    if (dispatch.status === 422) {
      return res.status(500).json({
        error:
          'O workflow build-apk.yml não existe no repo (ou o event_type está errado) — faz push do ficheiro .github/workflows/build-apk.yml.',
      })
    }
    if (dispatch.status === 401 || dispatch.status === 403) {
      return res.status(500).json({
        error: 'O token do GitHub não tem permissões suficientes (precisa do scope repo).',
      })
    }
    return res.status(500).json({ error: `Falha ao acionar o build (HTTP ${dispatch.status}).` })
  }

  recordHit(ip)

  return res.status(200).json({
    success: true,
    buildId,
    message: 'Build triggered successfully',
    estimatedSeconds: 180,
    actionsUrl: `https://github.com/${owner}/${repo}/actions/workflows/build-apk.yml`,
  })
}
