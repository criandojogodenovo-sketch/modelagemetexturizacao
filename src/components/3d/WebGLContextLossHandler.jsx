/**
 * WebGLContextLossHandler — trata perda de contexto WebGL em mobile.
 *
 * Post-Audit 4.0 — M2: Em dispositivos móveis, o contexto WebGL pode ser
 * perdido quando a GPU é sobrecarregada ou o sistema recupera recursos.
 * Sem handler, a cena fica preta e o utilizador não sabe o que aconteceu.
 *
 * Este componente:
 *  - Regista listeners `webglcontextlost` e `webglcontextrestored` no canvas
 *  - Em `lost`: previne default (para que R3F possa tentar recuperar)
 *  - Em `restored`: força re-render via state toggle
 *  - Mostra overlay com mensagem de erro
 *
 * NOTA: R3F tem alguma recuperação automática, mas em casos extremos
 * (context loss durante Play Mode com física ativa), a recuperação pode
 * ser parcial. Este handler garante pelo menos feedback visual ao utilizador.
 *
 * Limitação: NÃO testa recuperação real (runtime benchmark unavailable).
 * Se o contexto for perdido durante Play Mode com física ativa, bodies
 * podem ficar em estado inconsistente. Recomendado: Stop + Play novamente.
 */
import { useEffect, useState } from 'react'
import { useThree } from '@react-three/fiber'

export default function WebGLContextLossHandler() {
  const { gl } = useThree()
  const [contextLost, setContextLost] = useState(false)

  useEffect(() => {
    if (!gl) return
    const canvas = gl.domElement
    if (!canvas) return

    const onContextLost = (event) => {
      // Prevenir default permite que R3F tente recuperar
      event.preventDefault()
      setContextLost(true)
      console.warn('[WebGL] Contexto perdido — a tentar recuperar...')
    }

    const onContextRestored = () => {
      setContextLost(false)
      console.log('[WebGL] Contexto restaurado')
    }

    canvas.addEventListener('webglcontextlost', onContextLost)
    canvas.addEventListener('webglcontextrestored', onContextRestored)

    return () => {
      canvas.removeEventListener('webglcontextlost', onContextLost)
      canvas.removeEventListener('webglcontextrestored', onContextRestored)
    }
  }, [gl])

  // Overlay quando contexto perdido (renderizado via portal DOM no body)
  // R3F não pode renderizar mesh sem contexto, então usamos HTML overlay
  if (contextLost) {
    // Criar overlay DOM diretamente (não via R3F Canvas)
    if (typeof document !== 'undefined') {
      let overlay = document.getElementById('webgl-context-lost-overlay')
      if (!overlay) {
        overlay = document.createElement('div')
        overlay.id = 'webgl-context-lost-overlay'
        overlay.style.cssText = `
          position: fixed; top: 0; left: 0; width: 100%; height: 100%;
          background: rgba(0,0,0,0.85); color: #f85149; font-family: sans-serif;
          display: flex; align-items: center; justify-content: center;
          z-index: 9999; pointer-events: none; font-size: 14px; text-align: center;
          padding: 20px; box-sizing: border-box;
        `
        overlay.textContent = 'Contexto WebGL perdido. A recuperar... Se persistir, recarregue a página.'
        document.body.appendChild(overlay)
      }
    }
  } else {
    // Remover overlay se existir
    if (typeof document !== 'undefined') {
      const overlay = document.getElementById('webgl-context-lost-overlay')
      if (overlay) overlay.remove()
    }
  }

  return null
}
