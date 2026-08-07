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
import { useState, useRef, useEffect } from 'react'
import { useStore } from '../../../store/useStore'
import { parseFlirCode } from '../../../utils/flirscript/flircode'
import { debugLog } from '../../../utils/debug/debugStore'
import { IconClose, IconCheck } from '../../ui/Icons'

// Template default para um novo script
const DEFAULT_SCRIPT = `$$ Script FlirCode — ${''}
$$ Escreve a lógica do objeto aqui.

fun aoIniciar() begincode
    $$ Código a executar quando o jogo começa
    print("Ola mundo!")
endcode

fun aTick() begincode
    $$ Código a executar a cada frame
endcode

fun aoColidir(outro) begincode
    $$ Código a executar ao colidir
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

  // Carregar script existente
  useEffect(() => {
    if (!targetInstance) return
    const existing = targetInstance.flirScript
    if (typeof existing === 'string' && existing.startsWith('FLIRCODE:')) {
      setCode(existing.slice('FLIRCODE:'.length))
    } else if (typeof existing === 'string') {
      setCode(existing)
    } else {
      setCode(DEFAULT_SCRIPT)
    }
  }, [targetInstance?.instanceId])

  // Auto-save (debounced)
  useEffect(() => {
    if (!targetInstance || !code) return
    clearTimeout(saveTimeout)
    saveTimeout = setTimeout(() => {
      setInstanceFlirScript(targetInstance.instanceId, 'FLIRCODE:' + code)
    }, 800)
    return () => clearTimeout(saveTimeout)
  }, [code, targetInstance?.instanceId])

  // Atualizar números de linha
  useEffect(() => {
    const lines = code.split('\n').length
    setLineCount(lines)
  }, [code])

  // Sincronizar scroll dos números de linha com o textarea
  const handleScroll = () => {
    if (textareaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop
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
          <div style={{ fontSize: 32, opacity: 0.4 }}>📝</div>
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
        <button onClick={() => insertSnippet('fun aoIniciar() begincode\n    \nendcode\n')} title="Evento Iniciar">▶ Iniciar</button>
        <button onClick={() => insertSnippet('fun aTick() begincode\n    \nendcode\n')} title="Evento Tick">⏱ Tick</button>
        <button onClick={() => insertSnippet('fun aoColidir(outro) begincode\n    \nendcode\n')} title="Evento Colisão">💥 Colidir</button>
        <button onClick={() => insertSnippet('if (true) begincode\n    \nendcode\n')} title="Condicional">? If</button>
        <button onClick={() => insertSnippet('repeat in number(3, i) begincode\n    \nendcode\n')} title="Ciclo">🔁 Repeat</button>
        <button onClick={() => insertSnippet('print("mensagem")\n')} title="Print">📋 Print</button>
        <button onClick={() => insertSnippet('move(0, 0, 1)\n')} title="Mover">📦 Move</button>
        <button onClick={() => insertSnippet('playAnim("idle")\n')} title="Animação">🏃 Anim</button>
      </div>

      {/* Editor de texto com números de linha */}
      <div className="flircode-textarea-wrap">
        <div className="flircode-line-numbers" ref={lineNumbersRef}>
          {Array.from({ length: lineCount }, (_, i) => (
            <div key={i} className="flircode-line-number">{i + 1}</div>
          ))}
        </div>
        <textarea
          ref={textareaRef}
          className="flircode-textarea"
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

      {/* Referência rápida */}
      <div className="flircode-reference">
        <details>
          <summary>📖 Referência rápida</summary>
          <div className="flircode-ref-content">
            <h5>Eventos:</h5>
            <code>fun aoIniciar()</code> — BeginPlay<br/>
            <code>fun aTick()</code> — a cada frame<br/>
            <code>fun aoColidir(outro)</code> — colisão<br/>
            <code>fun aoTocar()</code> — toque/click<br/>
            <code>fun aoVerJogador()</code> — NPC vê jogador<br/>
            <code>fun aoPerderJogador()</code> — NPC perde jogador<br/>
            <code>fun aoTimer()</code> — timer acaba<br/>
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
