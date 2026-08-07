import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Configuração do Vite — build estático para deploy na Netlify
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 2000,
  },
})
