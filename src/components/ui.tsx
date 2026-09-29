import type { ButtonHTMLAttributes, ReactNode } from 'react'
import type { ContentStatus } from '../lib/database.types'

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

export function StatusBadge({ status }: { status: ContentStatus | 'Published' | 'Draft' | 'Archived' }) {
  const normalized = status.toLowerCase() as ContentStatus
  return <span className={`status status--${normalized}`}><i />{normalized[0].toUpperCase() + normalized.slice(1)}</span>
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
