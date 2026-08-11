/**
 * CollapseSection — secção colapsável com cabeçalho clicável e seta ▼/▶.
 *
 * Uso:
 *   <CollapseSection title="Física" defaultOpen={true}>
 *     <div>...propriedades...</div>
 *   </CollapseSection>
 *
 * Estado colapsado é persistido no localStorage para manter preferência do utilizador.
 */
import { useState, useEffect } from 'react'
import { Icon } from '../ui/iconMap'

export default function CollapseSection({ title, icon, defaultOpen = true, children, storageKey }) {
  const storageId = storageKey ? `collapse_${storageKey}_${title}` : null
  const [open, setOpen] = useState(() => {
    if (storageId) {
      const saved = localStorage.getItem(storageId)
      if (saved !== null) return saved === 'true'
    }
    return defaultOpen
  })

  useEffect(() => {
    if (storageId) {
      localStorage.setItem(storageId, String(open))
    }
  }, [open, storageId])

  const toggle = () => setOpen(!open)

  return (
    <div className="collapse-section">
      <div
        className="collapse-header"
        onClick={toggle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle() } }}
      >
        <span className={`collapse-arrow ${open ? '' : 'collapsed'}`}>
          <Icon name="chevron-down" size={12} />
        </span>
        {icon && <Icon name={icon} size={12} />}
        <span>{title}</span>
      </div>
      <div className={`collapse-body ${open ? '' : 'collapsed'}`}>
        {children}
      </div>
    </div>
  )
}
