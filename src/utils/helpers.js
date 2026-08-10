/**
 * Utilitários gerais da aplicação.
 */

// Gera um ID único curto (compatível com crypto.randomUUID quando disponível)
export function uid(prefix = 'obj') {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `${prefix}_${crypto.randomUUID().slice(0, 8)}`
  }
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}

// Limita um número a um intervalo
export function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v))
}

// Arredonda para N casas decimais (evita floats longos no histórico)
export function round(v, decimals = 3) {
  const p = 10 ** decimals
  return Math.round(v * p) / p
}

// Arredonda um vetor [x, y, z]
export function roundVec3(vec, decimals = 3) {
  return [round(vec[0], decimals), round(vec[1], decimals), round(vec[2], decimals)]
}

// Converte graus <-> radianos
export const degToRad = (deg) => (deg * Math.PI) / 180
export const radToDeg = (rad) => (rad * 180) / Math.PI

// Formata bytes de forma legível
export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

// Dispara o download de um Blob no browser
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// Dispara o download de um texto como ficheiro
export function downloadText(text, filename, mime = 'application/json') {
  downloadBlob(new Blob([text], { type: mime }), filename)
}

// Lê um File como DataURL (base64) — usado para guardar texturas no projeto JSON
export function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// Lê um File como ArrayBuffer
export function fileToArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

// Debounce simples
export function debounce(fn, wait = 200) {
  let t
  return (...args) => {
    clearTimeout(t)
    t = setTimeout(() => fn(...args), wait)
  }
}
