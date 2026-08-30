/**
 * useEmbeddedProject — carrega o projeto embebido no APK (Cloud Build).
 *
 * O workflow de Cloud Build (.github/workflows/build-apk.yml) escreve o
 * projeto do utilizador — enviado pelo site via /api/build-apk — em
 * public/embedded-project.json ANTES do `npm run build`. O Vite copia-o
 * para dist/ e o `cap sync` empacota-o no APK (WebView do Capacitor serve
 * a partir da raiz, por isso './embedded-project.json' resolve).
 *
 * Ao arranque da app:
 *  - Se o ficheiro existir e contiver um projeto válido → carrega-o com
 *    loadProjectJSON, salta a HomePage e (se o projeto tem cenas) entra
 *    direto em Play Mode — o APK abre no jogo do utilizador.
 *  - Se não existir (site na Vercel, dev local) → arranque normal.
 *
 * Notas técnicas:
 *  - fetch com cache 'no-store' para nunca servir um projeto em cache.
 *  - Em dev o Vite dev server devolve 404 para este ficheiro (não existe
 *    em public/ — está no .gitignore porque é gerado por build).
 *  - Sem cleanup/flag 'cancelled': a hidratação do persist do Zustand é um
 *    microtask e o fetch é um macrotask, portanto o loadProjectJSON corre
 *    SEMPRE depois da hidratação — e o ref previne o duplo montar do
 *    StrictMode sem descartar o resultado do fetch.
 */
import { useEffect, useRef } from 'react'
import { useStore } from '../store/useStore'

export function useEmbeddedProject() {
  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    fetch('./embedded-project.json', { cache: 'no-store' })
      .then((r) => (r.ok ? r.text() : null))
      .then((text) => {
        if (!text) return
        let data
        try {
          data = JSON.parse(text)
        } catch {
          console.warn('[EmbeddedProject] Ficheiro embebido inválido — a ignorar')
          return
        }
        if (!data || typeof data !== 'object' || Array.isArray(data)) return

        const hasScenes = Array.isArray(data.scenes) && data.scenes.length > 0
        const hasObjects =
          data.scene && Array.isArray(data.scene.objects) && data.scene.objects.length > 0
        if (!hasScenes && !hasObjects) {
          console.warn('[EmbeddedProject] Projeto embebido vazio — a ignorar')
          return
        }

        const { loadProjectJSON, hideHome, openScenePreview, toast } = useStore.getState()
        loadProjectJSON(text)
        hideHome()

        // Projetos com cenas (jogos) entram direto em Play Mode.
        // Projetos só de modelagem ficam no editor com os objetos carregados.
        if (hasScenes) openScenePreview()

        toast?.(`Jogo "${data.projectName || 'embebido'}" carregado`, 'success', 2000)
        console.log(
          '[EmbeddedProject] Projeto embebido carregado:',
          data.projectName || '(sem nome)',
          `(${data.scenes?.length || 0} cenas, play mode: ${hasScenes})`,
        )
      })
      .catch(() => {
        /* sem ficheiro embebido — arranque normal (site/dev) */
      })
  }, [])
}
