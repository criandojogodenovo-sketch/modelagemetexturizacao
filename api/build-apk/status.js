/**
 * /api/build-apk/status — estado do Cloud Build (polling).
 *
 * GET ?buildId=<epoch-ms>-<hex>
 *
 * Devolve:
 *  - { status: 'queued', runId: null }            → o run ainda não apareceu
 *    (o GitHub demora 1-5s a criar o run após o dispatch)
 *  - { status: 'queued'|'in_progress', runId, htmlUrl }
 *  - { status: 'completed', conclusion, runId, htmlUrl, downloadUrl? }
 *  - { status: 'unknown', error }                 → build não encontrado
 *    (passaram >15 min sem run — dispatch falhou ou buildId inválido)
 *
 * Associação buildId → run SEM estado partilhado: o buildId codifica o epoch
 * do disparo; o run correspondente é o MAIS ANTIGO run repository_dispatch
 * criado após esse instante (com margem de 90s para dessincronização de
 * relógios). Com builds concorrentes do mesmo segundo pode haver colisão —
 * aceitável para o volume atual (documentado no worklog).
 *
 * Quando o run termina com sucesso, verifica ainda o Release apk-<buildId>
 * e inclui o downloadUrl público do asset (se já disponível).
 */
const BUILD_TIMEOUT_MS = 15 * 60 * 1000

const GH_HEADERS = {
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'flir-engine-cloud-build',
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const token = process.env.GITHUB_TOKEN
  const owner = process.env.GITHUB_OWNER
  const repo = process.env.GITHUB_REPO
  if (!token || !owner || !repo) {
    return res
      .status(500)
      .json({ error: 'Servidor não configurado: faltam GITHUB_TOKEN/GITHUB_OWNER/GITHUB_REPO.' })
  }

  const { buildId } = req.query
  const match = /^(\d{12,14})-[0-9a-f]{4,32}$/i.exec(String(buildId || ''))
  if (!match) {
    return res.status(400).json({ error: 'buildId inválido (formato esperado: <epoch>-<hex>).' })
  }
  const triggerMs = Number(match[1])

  // Listar runs recentes disparados por repository_dispatch
  let response
  try {
    response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/actions/runs?event=repository_dispatch&per_page=20`,
      {
        headers: {
          ...GH_HEADERS,
          Authorization: `Bearer ${token}`,
        },
      },
    )
  } catch (err) {
    console.error('[build-apk/status] Falha de rede:', err?.message)
    return res.status(502).json({ error: 'Não foi possível contactar a API do GitHub.' })
  }
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    console.error('[build-apk/status] GitHub API falhou:', response.status, detail.slice(0, 300))
    return res.status(502).json({ error: `GitHub API respondeu ${response.status}.` })
  }

  const data = await response.json()
  const runs = Array.isArray(data.workflow_runs) ? data.workflow_runs : []

  // O run certo: o mais antigo criado APÓS o instante do disparo (margem 90s)
  const threshold = triggerMs - 90 * 1000
  const candidates = runs
    .filter((r) => r.created_at && Date.parse(r.created_at) >= threshold)
    .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))
  const run = candidates[0]

  if (!run) {
    // Run ainda não criado — ou o dispatch nunca chegou
    if (Date.now() - triggerMs > BUILD_TIMEOUT_MS) {
      return res.status(200).json({
        status: 'unknown',
        conclusion: null,
        runId: null,
        error: 'Build não encontrado — o disparo pode ter falhado. Tenta gerar o APK novamente.',
      })
    }
    return res.status(200).json({
      status: 'queued',
      conclusion: null,
      runId: null,
      note: 'O run está a ser criado no GitHub Actions...',
    })
  }

  const payload = {
    status: run.status, // queued | in_progress | completed
    conclusion: run.conclusion, // success | failure | cancelled | null
    runId: run.id,
    htmlUrl: run.html_url,
    buildId,
  }

  // Build concluído com sucesso → incluir o link público do APK (Release)
  if (run.status === 'completed' && run.conclusion === 'success') {
    try {
      const relRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/releases/tags/apk-${buildId}`,
        {
          headers: {
            ...GH_HEADERS,
            Authorization: `Bearer ${token}`,
          },
        },
      )
      if (relRes.ok) {
        const release = await relRes.json()
        const asset = (release.assets || []).find((a) => String(a.name || '').endsWith('.apk'))
        if (asset) payload.downloadUrl = asset.browser_download_url
      }
    } catch (err) {
      // Não é fatal — o /download resolve o URL por aí
      console.warn('[build-apk/status] Release lookup falhou:', err?.message)
    }
  }

  return res.status(200).json(payload)
}
