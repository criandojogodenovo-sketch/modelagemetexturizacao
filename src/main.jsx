import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/global.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Registar o Service Worker para funcionalidade PWA offline
// O vite-plugin-pwa injeta o ficheiro /sw.js no build de produção.
// Em desenvolvimento, o SW está desativado para evitar conflitos com HMR.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { scope: './' })
      .then((reg) => {
        // Verifica atualizações periodicamente
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing
          newWorker?.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // Nova versão disponível — recarrega silenciosamente
              console.log('[PWA] Nova versão disponível, a recarregar...')
              window.location.reload()
            }
          })
        })
      })
      .catch((err) => {
        // Em dev ou se o ficheiro não existir, ignoramos silenciosamente
        if (import.meta.env.PROD) {
          console.warn('[PWA] Falha ao registar Service Worker:', err)
        }
      })
  })
}
