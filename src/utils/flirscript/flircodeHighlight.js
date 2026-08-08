/**
 * flircodeHighlight.js — Syntax highlighting para FlirCode.
 *
 * Converte texto FlirCode em HTML com spans coloridos para:
 *  - Palavras-chave (fun, var, if, else, repeat, switch, case, default, begincode, endcode, in, number, until)
 *  - Comentários ($$ ...)
 *  - Strings ("...")
 *  - Funções embutidas (playAnim, playSound, move, rotate, scale, destroy, createObject, changeScene, wait, setVar, getVar, showUI, hideUI, print, warn, error, collidingWith, distanceTo, isTouching, getUIValue, setUIValue, showUIScreen, hideUIScreen)
 *  - Eventos (onStart, onTick, onCollide, onTouch, onSeePlayer, onLoseSight, onTimer, onClick, onChange, onSubmit, onEnterZone, onExitZone)
 *  - Números
 *
 * O HTML gerado é seguro (escapa <, >, &) pronto para inserir num <pre>.
 */

const KEYWORDS = new Set([
  'fun', 'var', 'if', 'else', 'repeat', 'switch', 'case', 'default',
  'begincode', 'endcode', 'in', 'number', 'until',
])

const BUILTIN_FUNCS = new Set([
  'playAnim', 'playSound', 'move', 'rotate', 'scale', 'destroy',
  'createObject', 'changeScene', 'wait', 'setVar', 'getVar',
  'showUI', 'hideUI', 'print', 'warn', 'error',
  'collidingWith', 'distanceTo', 'isTouching',
  'getUIValue', 'setUIValue', 'showUIScreen', 'hideUIScreen',
])

const EVENTS = new Set([
  'onStart', 'onTick', 'onCollide', 'onTouch', 'onSeePlayer', 'onLoseSight',
  'onTimer', 'onClick', 'onChange', 'onSubmit', 'onEnterZone', 'onExitZone',
])

/**
 * Escapa caracteres HTML para evitar injection.
 */
function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/**
 * Tokeniza e destaca uma linha de FlirCode.
 * Retorna HTML com spans coloridos.
 */
function highlightLine(line) {
  // Linha de comentário — toda cinzenta
  const trimmed = line.trimStart()
  if (trimmed.startsWith('$$')) {
    return `<span class="fc-comment">${escapeHtml(line)}</span>`
  }

  let result = ''
  let i = 0
  while (i < line.length) {
    const ch = line[i]

    // String (entre aspas)
    if (ch === '"') {
      let end = i + 1
      while (end < line.length && line[end] !== '"') end++
      const str = line.slice(i, end + 1)
      result += `<span class="fc-string">${escapeHtml(str)}</span>`
      i = end + 1
      continue
    }

    // Número
    if (/\d/.test(ch) && (i === 0 || !/[a-zA-Z_]/.test(line[i - 1]))) {
      let end = i
      while (end < line.length && /[\d.]/.test(line[end])) end++
      const num = line.slice(i, end)
      result += `<span class="fc-number">${escapeHtml(num)}</span>`
      i = end
      continue
    }

    // Identificador (palavra-chave, função, evento, ou variável)
    if (/[a-zA-Z_]/.test(ch)) {
      let end = i
      while (end < line.length && /[a-zA-Z0-9_]/.test(line[end])) end++
      const word = line.slice(i, end)

      // Verificar se é seguido de ( → é uma chamada de função
      const afterWord = line.slice(end).trimStart()
      const isCall = afterWord.startsWith('(')

      if (KEYWORDS.has(word)) {
        result += `<span class="fc-keyword">${escapeHtml(word)}</span>`
      } else if (EVENTS.has(word)) {
        result += `<span class="fc-event">${escapeHtml(word)}</span>`
      } else if (isCall && BUILTIN_FUNCS.has(word)) {
        result += `<span class="fc-builtin">${escapeHtml(word)}</span>`
      } else if (isCall) {
        // Função definida pelo utilizador — destaque mais subtil
        result += `<span class="fc-func">${escapeHtml(word)}</span>`
      } else {
        result += escapeHtml(word)
      }
      i = end
      continue
    }

    // Qualquer outro carácter — escapar e adicionar
    result += escapeHtml(ch)
    i++
  }
  return result
}

/**
 * Destaca código FlirCode completo (múltiplas linhas).
 * @param {string} code
 * @returns {string} HTML com spans coloridos
 */
export function highlightFlirCode(code) {
  const lines = code.split('\n')
  return lines.map(highlightLine).join('\n')
}
