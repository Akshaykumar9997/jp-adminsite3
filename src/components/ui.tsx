import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { X } from 'lucide-react'
import type { PublicationStatus } from '../data/mockData'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: ReactNode
  variant?: 'primary' | 'secondary' | 'ghost'
}

export function Button({ icon, variant = 'secondary', className = '', children, ...props }: ButtonProps) {
  return (
    <button className={`button button--${variant} ${className}`} {...props}>
      {icon}
      <span>{children}</span>
    </button>
  )
}

export function StatusBadge({ status }: { status: PublicationStatus }) {
  return <span className={`status status--${status.toLowerCase()}`}><i />{status}</span>
}

export function MetricCard({ label, value, note, icon }: { label: string; value: string; note: string; icon: ReactNode }) {
  return (
    <article className="metric-card">
      <div className="metric-card__head"><span>{label}</span><span className="metric-card__icon">{icon}</span></div>
      <div className="metric-card__value">{value}</div>
      <p>{note}</p>
    </article>
  )
}

export function PlaceholderDialog({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title" onMouseDown={(event) => event.stopPropagation()}>
        <button className="icon-button dialog__close" onClick={onClose} aria-label="Close dialog"><X size={18} /></button>
        <span className="eyebrow">Phase 1 placeholder</span>
        <h2 id="dialog-title">{title}</h2>
        <p>This action is intentionally not connected to a backend. Persistence will be added only after Supabase integration is approved.</p>
        <Button variant="primary" onClick={onClose}>Understood</Button>
      </section>
    </div>
  )
}
