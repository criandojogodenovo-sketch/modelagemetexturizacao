/**
 * Gera ícones PWA em vários tamanhos a partir do favicon SVG.
 * Usa o pacote `sharp` para rasterizar.
 *
 * Tamanhos gerados: 16, 32, 180, 192, 512 (normais + maskable)
 * Saída: /public/icons/icon-<size>.png
 */
import { promises as fs } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#2f81f7"/>
      <stop offset="1" stop-color="#8957e5"/>
    </linearGradient>
  </defs>
  <rect width="32" height="32" rx="6" fill="url(#g)"/>
  <g fill="none" stroke="#fff" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round">
    <path d="M16 6 7 11v10l9 5 9-5V11l-9-5z"/>
    <path d="M7 11l9 5 9-5"/>
    <path d="M16 16v10"/>
  </g>
</svg>`

const SIZES = [16, 32, 180, 192, 512]

async function main() {
  let sharp
  try {
    sharp = (await import('sharp')).default
  } catch {
    console.error('Sharp não disponível. Instala com: npm install sharp')
    process.exit(1)
  }

  const outDir = path.join(__dirname, '..', 'public', 'icons')
  await fs.mkdir(outDir, { recursive: true })

  for (const size of SIZES) {
    const outPath = path.join(outDir, `icon-${size}.png`)
    await sharp(Buffer.from(SVG))
      .resize(size, size)
      .png()
      .toFile(outPath)
    console.log(`✓ Gerado ${outPath}`)
  }
  // Maskable icons (com fundo para "safe zone")
  for (const size of [192, 512]) {
    const outPath = path.join(outDir, `icon-maskable-${size}.png`)
    await sharp(Buffer.from(SVG))
      .resize(Math.round(size * 0.8), Math.round(size * 0.8))
      .extend({
        top: Math.round(size * 0.1),
        bottom: Math.round(size * 0.1),
        left: Math.round(size * 0.1),
        right: Math.round(size * 0.1),
        background: { r: 13, g: 17, b: 23, alpha: 1 },
      })
      .png()
      .toFile(outPath)
    console.log(`✓ Gerado ${outPath}`)
  }

  // Apple touch icon (180)
  await fs.copyFile(path.join(outDir, 'icon-180.png'), path.join(outDir, 'apple-touch-icon.png'))
  console.log('✓ Gerado apple-touch-icon.png')

  // SVG fallback
  await fs.writeFile(path.join(outDir, 'icon.svg'), SVG)
  console.log('✓ Gerado icon.svg')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
