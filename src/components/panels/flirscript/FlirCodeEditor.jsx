/**
 * FlirCodeEditor — editor de texto para a linguagem FlirCode.
 *
 * Substitui o editor visual de nós (litegraph) por um editor de texto
 * simples com números de linha e destaque de sintaxe básico.
 *
 * O script é guardado como texto no campo `flirScript` do objeto/conect,
 * usando o prefixo "FLIRCODE:" para distinguir de grafos visuais antigos.
 *
 * O interpretador (flircode.js) compila o texto em runtime durante
 * "Executar Jogo", garantindo compatibilidade total com Conects e físicas.
 */
import { useState, useRef, useEffect, useMemo } from 'react'
import { useStore } from '../../../store/useStore'
import { parseFlirCode } from '../../../utils/flirscript/flircode'
import { highlightFlirCode } from '../../../utils/flirscript/flircodeHighlight'
import { debugLog } from '../../../utils/debug/debugStore'
import { IconClose, IconCheck, IconSave } from '../../ui/Icons'

// Template default para um novo script
const DEFAULT_SCRIPT = `$$ Script FlirCode
$$ Write the object logic here.

fun onStart() begincode
    $$ Code to run when the game starts
    print("Hello world!")
endcode

fun onTick() begincode
    $$ Code to run every frame
endcode

fun onCollide(other) begincode
    $$ Code to run on collision
endcode
`

export default function FlirCodeEditor() {
  const flirScriptTarget = useStore((s) => s.flirScriptTarget)
  const scenes = useStore((s) => s.scenes)
  const setInstanceFlirScript = useStore((s) => s.setInstanceFlirScript)
  const clearFlirScriptTarget = useStore((s) => s.clearFlirScriptTarget)
  const toast = useStore((s) => s.toast)

  const [code, setCode] = useState('')
  const [errors, setErrors] = useState([])
  const [lineCount, setLineCount] = useState(0)
  const textareaRef = useRef(null)
  const lineNumbersRef = useRef(null)
  let saveTimeout = null

  // Objeto alvo
  const targetScene = scenes.find((s) => s.id === flirScriptTarget?.sceneId)
  const targetInstance =
    targetScene?.conects?.find((o) => o.instanceId === flirScriptTarget?.instanceId) ||
    targetScene?.objects?.find((o) => o.instanceId === flirScriptTarget?.instanceId)

  // Carregar script existente — SÓ quando muda o instanceId (não a cada render)
  // Usar um ref para garantir que só carrega uma vez por objeto
  const loadedInstanceId = useRef(null)
  useEffect(() => {
    if (!targetInstance) return
    // Só carregar se for um objeto DIFERENTE do já carregado
    if (loadedInstanceId.current === targetInstance.instanceId) return
    loadedInstanceId.current = targetInstance.instanceId
    const existing = targetInstance.flirScript
    if (typeof existing === 'string' && existing.startsWith('FLIRCODE:')) {
      setCode(existing.slice('FLIRCODE:'.length))
    } else if (typeof existing === 'string') {
      setCode(existing)
    } else {
      setCode(DEFAULT_SCRIPT)
    }
  }, [targetInstance?.instanceId])

  // Auto-save (debounced) — guarda 500ms depois de parar de escrever
  useEffect(() => {
    if (!targetInstance || !code) return
    clearTimeout(saveTimeout)
    saveTimeout = setTimeout(() => {
      setInstanceFlirScript(targetInstance.instanceId, 'FLIRCODE:' + code)
    }, 500)
    return () => clearTimeout(saveTimeout)
  }, [code])

  // Atualizar números de linha
  useEffect(() => {
    const lines = code.split('\n').length
    setLineCount(lines)
  }, [code])

  // Sincronizar scroll dos números de linha E do highlight overlay com o textarea
  const handleScroll = () => {
    if (textareaRef.current) {
      const { scrollTop, scrollLeft } = textareaRef.current
      if (lineNumbersRef.current) lineNumbersRef.current.scrollTop = scrollTop
      const pre = textareaRef.current.parentElement?.querySelector('.flircode-highlight')
      if (pre) {
        pre.scrollTop = scrollTop
        pre.scrollLeft = scrollLeft
      }
    }
  }

  // Validar script
  const handleValidate = () => {
    const { errors: parseErrors } = parseFlirCode(code)
    setErrors(parseErrors)
    if (parseErrors.length === 0) {
      toast('FlirCode válido! Pronto a executar.', 'success')
    } else {
      toast(`${parseErrors.length} erro(s) de sintaxe`, 'error')
      parseErrors.forEach((err) => {
        debugLog(`FlirCode erro (linha ${err.line}): ${err.message}`, 'error', 'FlirCode')
      })
    }
  }

  // Guardar explicitamente (além do auto-save)
  const handleSaveNow = () => {
    if (!targetInstance) return
    clearTimeout(saveTimeout)
    setInstanceFlirScript(targetInstance.instanceId, 'FLIRCODE:' + code)
    toast('FlirCode guardado', 'success')
  }

  // Inserir snippet
  const insertSnippet = (snippet) => {
    const textarea = textareaRef.current
    if (!textarea) return
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const newCode = code.slice(0, start) + snippet + code.slice(end)
    setCode(newCode)
    setTimeout(() => {
      textarea.focus()
      textarea.selectionStart = textarea.selectionEnd = start + snippet.length
    }, 0)
  }

  if (!targetInstance) {
    return (
      <div className="flirscript-empty">
        <div className="empty-state">
          <div style={{ fontSize: 32, opacity: 0.4 }}></div>
          <div className="mt-2">Nenhum objeto selecionado para FlirCode.</div>
          <div className="small mt-2">
            Vai ao Modo Cena, seleciona um Conect e clica em "⋯ → FlirScript".
          </div>
          <button className="primary mt-2" onClick={clearFlirScriptTarget}>
            Voltar ao Modo Cena
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flirscript-editor flircode-editor">
      {/* Barra de ferramentas */}
      <div className="flirscript-toolbar">
        <button onClick={clearFlirScriptTarget} title="Voltar ao Modo Cena">
          ← Cena
        </button>
        <div className="fs-target-info">
          <strong>FlirCode</strong>
          <span className="muted small"> · {targetInstance.name}</span>
        </div>
        <div className="spacer" />
        <button onClick={handleSaveNow} title="Guardar alterações" className="primary">
          <IconSave width={14} height={14} /> Guardar
        </button>
        <button onClick={handleValidate} title="Validar sintaxe">
          <IconCheck width={14} height={14} /> Validar
        </button>
      </div>

      {/* Erros de validação */}
      {errors.length > 0 && (
        <div className="flirscript-errors">
          <strong>Erros de sintaxe:</strong>
          <ul>
            {errors.map((err, i) => (
              <li key={i}>Linha {err.line}: {err.message}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Snippets rápidos */}
      <div className="flircode-snippets">
        <button onClick={() => insertSnippet('fun onStart() begincode\n    \nendcode\n')} title="Event Start">▶ Start</button>
        <button onClick={() => insertSnippet('fun onTick() begincode\n    \nendcode\n')} title="Event Tick">⏱ Tick</button>
        <button onClick={() => insertSnippet('fun onCollide(other) begincode\n    \nendcode\n')} title="Event Collide">Collide</button>
        <button onClick={() => insertSnippet('if (true) begincode\n    \nendcode\n')} title="Condicional">? If</button>
        <button onClick={() => insertSnippet('repeat in number(3, i) begincode\n    \nendcode\n')} title="Ciclo">🔁 Repeat</button>
        <button onClick={() => insertSnippet('print("mensagem")\n')} title="Print">Print</button>
        <button onClick={() => insertSnippet('move(0, 0, 1)\n')} title="Mover">Move</button>
        <button onClick={() => insertSnippet('playAnim("idle")\n')} title="Animação">Anim</button>
      </div>

      {/* Editor de texto com números de linha + syntax highlighting overlay */}
      <div className="flircode-textarea-wrap">
        <div className="flircode-line-numbers" ref={lineNumbersRef}>
          {Array.from({ length: lineCount }, (_, i) => (
            <div key={i} className="flircode-line-number">{i + 1}</div>
          ))}
        </div>
        <div className="flircode-editor-area">
          {/* Highlight overlay — mostra o código colorido por baixo do textarea */}
          <pre
            className="flircode-highlight"
            aria-hidden="true"
            dangerouslySetInnerHTML={{ __html: highlightFlirCode(code) + '\n' }}
          />
          {/* Textarea transparente — o utilizador escreve aqui, o texto é invisível
              mas o caret está visível. O overlay por baixo mostra as cores. */}
          <textarea
            ref={textareaRef}
            className="flircode-textarea flircode-textarea-overlay"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onScroll={handleScroll}
            spellCheck="false"
            placeholder="Escreve o teu script FlirCode aqui..."
            style={{
              fontFamily: 'Monaco, Menlo, "Courier New", monospace',
              fontSize: 13,
              lineHeight: '1.5',
              tabSize: 4,
            }}
          />
        </div>
      </div>

      {/* Referência rápida */}
      <div className="flircode-reference">
        <details>
          <summary>📖 Referência rápida</summary>
          <div className="flircode-ref-content">
            <h5>Events:</h5>
            <code>fun onStart()</code> — BeginPlay<br/>
            <code>fun onTick()</code> — every frame<br/>
            <code>fun onCollide(other)</code> — collision<br/>
            <code>fun onTouch()</code> — touch/click<br/>
            <code>fun onSeePlayer()</code> — NPC sees player<br/>
            <code>fun onLoseSight()</code> — NPC loses player<br/>
            <code>fun onTimer()</code> — timer ends<br/>
            <h5>Funções:</h5>
            <code>playAnim("name")</code> · <code>playSound("name")</code><br/>
            <code>move(x,y,z)</code> · <code>rotate(x,y,z)</code> · <code>scale(x,y,z)</code><br/>
            <code>destroy(obj)</code> · <code>createObject("name",x,y,z)</code><br/>
            <code>changeScene("name")</code> · <code>print("msg")</code><br/>
            <code>setVar("name",val)</code> · <code>getVar("name")</code><br/>
            <h5>Sintaxe:</h5>
            <code>var nome = valor</code><br/>
            <code>if (cond) begincode ... endcode</code><br/>
            <code>repeat in number(n, i) begincode ... endcode</code><br/>
            <code>$$ comentário</code>
          </div>
        </details>
      </div>
    </div>
  )
}
