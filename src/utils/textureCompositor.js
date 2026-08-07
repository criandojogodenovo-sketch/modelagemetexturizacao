/**
 * textureCompositor.js — combina múltiplas camadas de textura num único mapa.
 *
 * Cada camada tem:
 *  - map: dataURL da textura
 *  - opacity: 0-1
 *  - blendMode: 'normal' | 'multiply' | 'overlay' | 'add' | 'screen'
 *  - mask: dataURL opcional (canal alpha para combinar)
 *
 * O compositing é feito num canvas 2D e o resultado é uma THREE.CanvasTexture
 * que pode ser usada como `mat.map`.
 *
 * Ordem: a primeira camada é a base, as seguintes são compostas por cima.
 */
import * as THREE from 'three'

// Cache de imagens carregadas para evitar recargas
const imageCache = new Map()

function loadImage(dataURL) {
  return new Promise((resolve) => {
    if (imageCache.has(dataURL)) {
      resolve(imageCache.get(dataURL))
      return
    }
    const img = new Image()
    img.onload = () => {
      imageCache.set(dataURL, img)
      resolve(img)
    }
    img.onerror = () => resolve(null)
    img.src = dataURL
  })
}

// Aplica blend mode entre duas imagens
function applyBlend(ctx, img, opacity, blendMode, maskImg, w, h) {
  ctx.save()
  ctx.globalAlpha = opacity
  ctx.globalCompositeOperation = blendMode === 'multiply' ? 'multiply'
    : blendMode === 'overlay' ? 'overlay'
    : blendMode === 'add' ? 'lighter'
    : blendMode === 'screen' ? 'screen'
    : 'source-over'
  if (maskImg) {
    // Aplicar máscara: desenhar a imagem apenas onde a máscara tem pixels
    const maskCanvas = document.createElement('canvas')
    maskCanvas.width = w
    maskCanvas.height = h
    const maskCtx = maskCanvas.getContext('2d')
    maskCtx.drawImage(maskImg, 0, 0, w, h)
    // Usar a máscara como clip
    ctx.drawImage(img, 0, 0, w, h)
    // Aplicar máscara via destination-in
    ctx.globalCompositeOperation = 'destination-in'
    ctx.drawImage(maskCanvas, 0, 0)
    ctx.globalCompositeOperation = 'source-over'
  } else {
    ctx.drawImage(img, 0, 0, w, h)
  }
  ctx.restore()
}

/**
 * Compõe múltiplas camadas de textura numa única THREE.CanvasTexture.
 * @param {Array} layers - [{ map, opacity, blendMode, mask }]
 * @param {number} size - resolução do canvas resultante (default 512)
 * @returns {Promise<THREE.CanvasTexture|null>}
 */
export async function compositeTextureLayers(layers, size = 512) {
  if (!layers || layers.length === 0) return null

  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')

  // Fundo transparente
  ctx.clearRect(0, 0, size, size)

  // Processar cada camada por ordem
  for (const layer of layers) {
    if (!layer.map) continue
    const img = await loadImage(layer.map)
    if (!img) continue
    const maskImg = layer.mask ? await loadImage(layer.mask) : null
    applyBlend(
      ctx, img,
      layer.opacity ?? 1,
      layer.blendMode || 'normal',
      maskImg,
      size, size
    )
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.needsUpdate = true
  return texture
}

/**
 * Versão síncrona simplificada: usa apenas a primeira camada com mapa
 * (fallback quando não há tempo de aguardar Promises).
 */
export function compositeTextureLayersSync(layers) {
  if (!layers || layers.length === 0) return null
  for (const layer of layers) {
    if (layer.map) {
      // Para a 1ª camada com mapa, retornar como texture simples
      // (o compositing completo é feito via compositeTextureLayers async)
      return null // indicar que precisa de versão async
    }
  }
  return null
}

/**
 * Pré-carrega todas as imagens das camadas e devolve quando estão prontas.
 */
export async function preloadLayerImages(layers) {
  const promises = []
  for (const layer of layers || []) {
    if (layer.map) promises.push(loadImage(layer.map))
    if (layer.mask) promises.push(loadImage(layer.mask))
  }
  await Promise.all(promises)
}
