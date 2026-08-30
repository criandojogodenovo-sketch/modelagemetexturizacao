/**
 * /api/build-apk/download — entrega o APK ao utilizador.
 *
 * GET ?buildId=<epoch-ms>-<hex>
 *
 * NOTA ARQUITETURAL (importante):
 * A primeira versão deste endpoint seguia o padrão "proxy": descarregar o zip
 * do artifact do GitHub Actions → extrair o APK (adm-zip/jszip) → re-enviar
 * ao browser. ISSO NÃO FUNCIONA: as Vercel Functions têm um limite HARD de
 * 4.5MB no corpo da resposta (vercel.com/docs/functions/limitations), e o APK
 * debug do Flir Engine tem ~5.3MB → 413 "Response payload too large".
 *
 * Solução implementada (sem novas dependências — zero npm adds):
 *  - O workflow publica o APK como asset de um Release (tag apk-<buildId>).
 *  - Como o repo é público, o asset tem URL pública sem autenticação.
 *  - Este endpoint apenas VERIFICA o release via API e faz 302 redirect para
 *    a URL pública — os bytes do APK nunca passam pela função.
 *
 * O artifact do Actions continua a ser carregado pelo workflow (backup na
 * UI do GitHub), mas o download público usa o Release.
 */
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

  // Verificar o Release apk-<buildId> e o asset .apk
  let relRes
  try {
    relRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/releases/tags/apk-${buildId}`,
      {
        headers: {
          ...GH_HEADERS,
          Authorization: `Bearer ${token}`,
        },
      },
    )
  } catch (err) {
    console.error('[build-apk/download] Falha de rede:', err?.message)
    return res.status(502).json({ error: 'Não foi possível contactar a API do GitHub.' })
  }

  if (relRes.status === 404) {
    return res.status(404).json({
      error:
        'APK não encontrado — o build pode ter falhado ou o release já foi limpo. Gera o APK novamente.',
    })
  }
  if (!relRes.ok) {
    console.error('[build-apk/download] Release lookup falhou:', relRes.status)
    return res.status(502).json({ error: `GitHub API respondeu ${relRes.status}.` })
  }

  let release
  try {
    release = await relRes.json()
  } catch {
    return res.status(502).json({ error: 'Resposta inválida da API do GitHub.' })
  }

  const asset = (release.assets || []).find((a) => String(a.name || '').endsWith('.apk'))
  if (!asset) {
    return res.status(404).json({
      error: 'O APK ainda não foi publicado neste release — tenta novamente dentro de momentos.',
    })
  }

  // 302 para a URL pública do asset (repo público → sem autenticação).
  // O browser segue o redirect e descarrega diretamente do GitHub.
  return res.redirect(302, asset.browser_download_url)
}
