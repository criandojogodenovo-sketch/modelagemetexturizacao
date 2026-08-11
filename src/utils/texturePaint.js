/**
 * texturePaint.js — Sistema de pintura direta em modelos 3D.
 *
 * Funcionalidades:
 *  - 6 pincéis: Draw, Soften, Smudge, Clone, Fill, Mask
 *  - Pintura em tempo real via raycasting no canvas 3D
 *  - Cores, tamanho e força ajustáveis
 *  - Textura pintada guardada como dataURL no objeto (customPaintTexture)
 *
 * Como funciona:
 *  - Cria um canvas 2D (1024x1024) como textura de pintura
 *  - Raycasting do rato/dedo para o mesh → UV do ponto de contacto
 *  - Desenha no canvas 2D na posição UV correspondente
 *  - O canvas é usado como textura do mesh (override do material)
 */

/**
 * Cria um canvas de pintura vazio (1024x1024).
 * @returns {HTMLCanvasElement}
 */
export function createPaintCanvas(size = 1024) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  // Fundo branco
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, size, size)
  return canvas
}

/**
 * Converte um canvas para dataURL (para guardar no store).
 */
export function canvasToDataURL(canvas) {
  return canvas.toDataURL('image/png')
}

/**
 * Carrega um dataURL num canvas.
 */
export function dataURLToCanvas(dataURL, size = 1024) {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    const img = new Image()
    img.onload = () => {
      ctx.drawImage(img, 0, 0, size, size)
      resolve(canvas)
    }
    img.onerror = () => resolve(canvas)
    img.src = dataURL
  })
}

/**
 * Aplica um pincel numa posição UV do canvas de pintura.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} u — coordenada UV X (0..1)
 * @param {number} v — coordenada UV Y (0..1)
 * @param {object} brush — { type, color, size, strength, cloneSource }
 */
export function paintAtUV(ctx, u, v, brush) {
  const canvasSize = ctx.canvas.width
  const x = u * canvasSize
  const y = (1 - v) * canvasSize // UV Y é invertido
  const radius = brush.size || 30
  const strength = brush.strength ?? 0.5

  switch (brush.type) {
    case 'draw': {
      // Pincel padrão — círculo com gradiente radial
      const grad = ctx.createRadialGradient(x, y, 0, x, y, radius)
      const color = brush.color || '#ff0000'
      grad.addColorStop(0, hexToRgba(color, strength))
      grad.addColorStop(0.7, hexToRgba(color, strength * 0.5))
      grad.addColorStop(1, hexToRgba(color, 0))
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.arc(x, y, radius, 0, Math.PI * 2)
      ctx.fill()
      break
    }

    case 'soften': {
      // Suavizar — blur local via filter
      const px = ctx.getImageData(x - radius, y - radius, radius * 2, radius * 2)
      const data = px.data
      // Box blur simples
      const blurred = boxBlur(data, radius * 2, radius * 2, Math.max(1, Math.floor(strength * 5)))
      ctx.putImageData(new ImageData(blurred, radius * 2, radius * 2), x - radius, y - radius)
      break
    }

    case 'smudge': {
      // Borrar — copia pixels de uma posição adjacente e mistura
      const offset = radius * 0.5
      const src = ctx.getImageData(x - offset, y - offset, radius * 2, radius * 2)
      const dst = ctx.getImageData(x - radius, y - radius, radius * 2, radius * 2)
      for (let i = 0; i < dst.data.length; i += 4) {
        dst.data[i] = lerp(dst.data[i], src.data[i], strength)
        dst.data[i + 1] = lerp(dst.data[i + 1], src.data[i + 1], strength)
        dst.data[i + 2] = lerp(dst.data[i + 2], src.data[i + 2], strength)
      }
      ctx.putImageData(dst, x - radius, y - radius)
      break
    }

    case 'clone': {
      // Clonar — copia de uma área fonte
      if (brush.cloneSource) {
        const sx = brush.cloneSource.x * canvasSize
        const sy = (1 - brush.cloneSource.y) * canvasSize
        const src = ctx.getImageData(sx - radius, sy - radius, radius * 2, radius * 2)
        // Aplicar com máscara circular
        const tmpCanvas = document.createElement('canvas')
        tmpCanvas.width = radius * 2
        tmpCanvas.height = radius * 2
        tmpCanvas.getContext('2d').putImageData(src, 0, 0)
        ctx.save()
        ctx.globalAlpha = strength
        ctx.beginPath()
        ctx.arc(x, y, radius, 0, Math.PI * 2)
        ctx.clip()
        ctx.drawImage(tmpCanvas, x - radius, y - radius)
        ctx.restore()
      }
      break
    }

    case 'fill': {
      // Balde de tinta — flood fill simplificado
      const px = ctx.getImageData(0, 0, canvasSize, canvasSize)
      const targetColor = getPixel(px, Math.floor(x), Math.floor(y))
      const fillColor = hexToRgba(brush.color || '#ff0000', 1)
      floodFill(px, Math.floor(x), Math.floor(y), targetColor, fillColor, canvasSize, canvasSize)
      ctx.putImageData(px, 0, 0)
      break
    }

    case 'mask': {
      // Máscara — pintar com "alpha zero" para bloquear área
      ctx.save()
      ctx.globalCompositeOperation = 'destination-out'
      const grad = ctx.createRadialGradient(x, y, 0, x, y, radius)
      grad.addColorStop(0, `rgba(0,0,0,${strength})`)
      grad.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.arc(x, y, radius, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
      break
    }
  }
}

// ===== Helpers =====

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

function lerp(a, b, t) { return a + (b - a) * t }

function getPixel(imageData, x, y) {
  const idx = (y * imageData.width + x) * 4
  return [imageData.data[idx], imageData.data[idx + 1], imageData.data[idx + 2], imageData.data[idx + 3]]
}

function setPixel(imageData, x, y, color) {
  const idx = (y * imageData.width + x) * 4
  imageData.data[idx] = color[0]
  imageData.data[idx + 1] = color[1]
  imageData.data[idx + 2] = color[2]
  imageData.data[idx + 3] = color[3]
}

function colorMatch(a, b, tolerance = 30) {
  return Math.abs(a[0] - b[0]) < tolerance &&
         Math.abs(a[1] - b[1]) < tolerance &&
         Math.abs(a[2] - b[2]) < tolerance &&
         Math.abs(a[3] - b[3]) < tolerance
}

function floodFill(imageData, startX, startY, targetColor, fillColor, w, h) {
  const stack = [[startX, startY]]
  const visited = new Set()
  while (stack.length > 0) {
    const [x, y] = stack.pop()
    if (x < 0 || x >= w || y < 0 || y >= h) continue
    const key = `${x},${y}`
    if (visited.has(key)) continue
    visited.add(key)
    const px = getPixel(imageData, x, y)
    if (!colorMatch(px, targetColor)) continue
    setPixel(imageData, x, y, fillColor)
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1])
  }
}

function boxBlur(data, w, h, radius) {
  const result = new Uint8ClampedArray(data.length)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0, a = 0, count = 0
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx, ny = y + dy
          if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
            const idx = (ny * w + nx) * 4
            r += data[idx]
            g += data[idx + 1]
            b += data[idx + 2]
            a += data[idx + 3]
            count++
          }
        }
      }
      const idx = (y * w + x) * 4
      result[idx] = r / count
      result[idx + 1] = g / count
      result[idx + 2] = b / count
      result[idx + 3] = a / count
    }
  }
  return result
}

// ===== Texturização Procedural =====

/**
 * Gera uma textura procedural num canvas.
 * @param {string} type — noise | voronoi | wave | marble | wood
 * @param {object} params — { size, scale, color1, color2, octaves }
 * @returns {HTMLCanvasElement}
 */
export function generateProceduralTexture(type, params = {}) {
  const size = params.size || 512
  const scale = params.scale || 4
  const color1 = params.color1 || '#3a5a2a'
  const color2 = params.color2 || '#1a2a1a'
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  const imgData = ctx.createImageData(size, size)
  const data = imgData.data

  const c1 = hexToRgbArray(color1)
  const c2 = hexToRgbArray(color2)

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = x / size * scale
      const ny = y / size * scale
      let t = 0

      if (type === 'noise') {
        t = fractalNoise(nx, ny, params.octaves || 4)
      } else if (type === 'voronoi') {
        t = voronoiNoise(nx, ny)
      } else if (type === 'wave') {
        t = (Math.sin(nx * Math.PI * 2) + Math.sin(ny * Math.PI * 2)) * 0.25 + 0.5
      } else if (type === 'marble') {
        t = Math.sin((nx + ny + fractalNoise(nx, ny, 4) * 2) * Math.PI) * 0.5 + 0.5
      } else if (type === 'wood') {
        const rings = Math.sin(Math.sqrt(nx * nx + ny * ny) * Math.PI * scale) * 0.5 + 0.5
        t = rings * 0.7 + fractalNoise(nx, ny, 3) * 0.3
      }

      t = Math.max(0, Math.min(1, t))
      const idx = (y * size + x) * 4
      data[idx] = lerp(c1[0], c2[0], t)
      data[idx + 1] = lerp(c1[1], c2[1], t)
      data[idx + 2] = lerp(c1[2], c2[2], t)
      data[idx + 3] = 255
    }
  }

  ctx.putImageData(imgData, 0, 0)

  // Aplicar ColorRamp se fornecido
  if (params.colorRamp && params.colorRamp.length >= 2) {
    applyColorRamp(canvas, params.colorRamp)
  }

  return canvas
}

/**
 * Aplica um ColorRamp (gradiente de cores) a um canvas.
 * @param {HTMLCanvasElement} canvas
 * @param {Array<{pos: number, color: string}>} ramp — [{pos:0,color:'#000'},{pos:1,color:'#fff'}]
 */
export function applyColorRamp(canvas, ramp) {
  const ctx = canvas.getContext('2d')
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const data = imgData.data

  // Pré-calcular cores do ramp
  const rampColors = ramp.map(s => ({ pos: s.pos, rgb: hexToRgbArray(s.color) }))

  for (let i = 0; i < data.length; i += 4) {
    // Valor de luminância como t
    const t = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255
    // Encontrar segmento do ramp
    let c = rampColors[0].rgb
    for (let j = 0; j < rampColors.length - 1; j++) {
      if (t >= rampColors[j].pos && t <= rampColors[j + 1].pos) {
        const localT = (t - rampColors[j].pos) / (rampColors[j + 1].pos - rampColors[j].pos)
        c = [
          lerp(rampColors[j].rgb[0], rampColors[j + 1].rgb[0], localT),
          lerp(rampColors[j].rgb[1], rampColors[j + 1].rgb[1], localT),
          lerp(rampColors[j].rgb[2], rampColors[j + 1].rgb[2], localT),
        ]
        break
      }
    }
    data[i] = c[0]
    data[i + 1] = c[1]
    data[i + 2] = c[2]
  }

  ctx.putImageData(imgData, 0, 0)
}

function hexToRgbArray(hex) {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]
}

// Ruído Perlin simplificado para procedural
const perm = new Uint8Array(512)
for (let i = 0; i < 256; i++) perm[i] = i
// Shuffle
for (let i = 255; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1))
  ;[perm[i], perm[j]] = [perm[j], perm[i]]
}
for (let i = 0; i < 256; i++) perm[i + 256] = perm[i]

function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10) }
function grad(hash, x, y) {
  const h = hash & 7
  const u = h < 4 ? x : y
  const v = h < 4 ? y : x
  return ((h & 1) ? -u : u) + ((h & 2) ? -2 * v : 2 * v)
}

function perlin2(x, y) {
  const X = Math.floor(x) & 255
  const Y = Math.floor(y) & 255
  const xf = x - Math.floor(x)
  const yf = y - Math.floor(y)
  const u = fade(xf)
  const v = fade(yf)
  const aa = perm[perm[X] + Y]
  const ab = perm[perm[X] + Y + 1]
  const ba = perm[perm[X + 1] + Y]
  const bb = perm[perm[X + 1] + Y + 1]
  const x1 = lerp(grad(aa, xf, yf), grad(ba, xf - 1, yf), u)
  const x2 = lerp(grad(ab, xf, yf - 1), grad(bb, xf - 1, yf - 1), u)
  return (lerp(x1, x2, v) + 1) * 0.5
}

function fractalNoise(x, y, octaves) {
  let total = 0, freq = 1, amp = 1, max = 0
  for (let i = 0; i < octaves; i++) {
    total += perlin2(x * freq, y * freq) * amp
    max += amp
    amp *= 0.5
    freq *= 2
  }
  return total / max
}

function voronoiNoise(x, y) {
  let minDist = 1
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const cx = Math.floor(x) + dx
      const cy = Math.floor(y) + dy
      const px = cx + fract(cx * 127.1 + cy * 311.7)
      const py = cy + fract(cy * 269.5 + cx * 183.3)
      const dist = Math.sqrt((px - x) ** 2 + (py - y) ** 2)
      minDist = Math.min(minDist, dist)
    }
  }
  return minDist
}

function fract(x) { return x - Math.floor(x) }
