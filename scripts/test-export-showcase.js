/**
 * test-export-showcase.js — gera o HTML standalone do FlirQuest Showcase
 * para teste no browser (Playwright/agent-browser).
 *
 * Uso: node scripts/test-export-showcase.js
 * Output: download/showcase-test.html
 */
import { flirQuestShowcaseProject } from '../src/utils/game/flirQuestShowcase.js'
import { generateGameHTML } from '../src/utils/game/gameExporter.js'
import { writeFileSync, mkdirSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, '..')

const project = flirQuestShowcaseProject
const html = generateGameHTML(project, { name: 'FlirQuest Showcase Test' })

const outDir = resolve(projectRoot, 'download')
mkdirSync(outDir, { recursive: true })
const outPath = resolve(outDir, 'showcase-test.html')
writeFileSync(outPath, html, 'utf-8')

console.log(`✓ HTML gerado: ${outPath} (${(html.length / 1024).toFixed(1)} KB)`)
console.log(`  Cenas: ${project.scenes.length}`)
console.log(`  Conects cena 1: ${project.scenes[0].conects.length}`)
console.log(`  Conects cena 2: ${project.scenes[1].conects.length}`)
