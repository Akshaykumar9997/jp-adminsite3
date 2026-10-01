import {
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react'
import { Check, ChevronDown } from 'lucide-react'
import type { ContentStatus } from '../lib/database.types'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  busy?: boolean
  icon?: ReactNode
  variant?: 'primary' | 'secondary' | 'ghost'
}

// Native popover keeps the same menu styling in galleries and inside dialogs.
export function Dropdown({
  label,
  value,
  options,
  onChange,
  disabled = false,
  name,
  required = false,
}: {
  label: string
  value: string
  options: readonly { value: string; label: string }[]
  onChange: (value: string) => void
  disabled?: boolean
  name?: string
  required?: boolean
}) {
  const id = useId(),
    trigger = useRef<HTMLButtonElement>(null),
    menu = useRef<HTMLDivElement>(null),
    field = useRef<HTMLInputElement>(null),
    anchor = useRef({ top: 0, left: 0 })
  const [open, setOpen] = useState(false)
  const current = options.find((option) => option.value === value)
  const position = () => {
    if (!trigger.current || !menu.current) return
    const rect = trigger.current.getBoundingClientRect(),
      width = Math.min(Math.max(rect.width, 200), innerWidth - 24)
    const height = Math.min(options.length * 44 + 12, 280, innerHeight - 24)
    anchor.current = { top: rect.top, left: rect.left }
    Object.assign(menu.current.style, {
      width: `${width}px`,
      left: `${Math.max(12, Math.min(rect.left, innerWidth - width - 12))}px`,
      top: `${Math.max(12, rect.bottom + height + 8 <= innerHeight ? rect.bottom + 8 : rect.top - height - 8)}px`,
      maxHeight: `${height}px`,
    })
  }
  const show = () => {
    position()
    menu.current?.showPopover()
    setOpen(true)
    menu.current
      ?.querySelector<HTMLButtonElement>('[aria-selected=true]')
      ?.focus({ preventScroll: true })
  }
  const close = () => {
    menu.current?.hidePopover()
    setOpen(false)
    trigger.current?.focus()
  }
  useEffect(() => {
    if (!open) return
    const dismiss = (event: Event) => {
      const rect = trigger.current?.getBoundingClientRect()
      if (
        event.type === 'scroll' &&
        rect &&
        Math.abs(rect.top - anchor.current.top) < 1 &&
        Math.abs(rect.left - anchor.current.left) < 1
      )
        return
      if (
        !(event.target instanceof Node) ||
        !menu.current?.contains(event.target)
      )
        menu.current?.hidePopover()
    }
    window.addEventListener('resize', dismiss)
    window.addEventListener('scroll', dismiss, true)
    return () => {
      window.removeEventListener('resize', dismiss)
      window.removeEventListener('scroll', dismiss, true)
    }
  }, [open])
  return (
    <div className="ui-dropdown">
      {name && (
        <input
          ref={field}
          type="hidden"
          name={name}
          value={value}
          readOnly
          required={required}
          disabled={disabled}
          data-label={label.toLowerCase()}
        />
      )}
      <button
        type="button"
        ref={trigger}
        className="button ui-dropdown-trigger"
        role="combobox"
        aria-label={label}
        aria-haspopup="listbox"
        aria-controls={id}
        aria-expanded={open}
        aria-required={required || undefined}
        disabled={disabled}
        onClick={() => (open ? close() : show())}
        onKeyDown={(event) => {
          if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
            event.preventDefault()
            show()
          }
        }}
      >
        <span>{current?.label ?? label}</span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      <div
        ref={menu}
        id={id}
        role="listbox"
        aria-label={label}
        popover="auto"
        className="ui-dropdown-menu"
        onToggle={() =>
          setOpen(menu.current?.matches(':popover-open') ?? false)
        }
        onKeyDown={(event) => {
          const items = [
              ...(menu.current?.querySelectorAll<HTMLButtonElement>(
                '[role=option]',
              ) ?? []),
            ],
            index = items.indexOf(document.activeElement as HTMLButtonElement)
          if (event.key === 'Escape') {
            event.preventDefault()
            event.stopPropagation()
            close()
          } else if (
            ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)
          ) {
            event.preventDefault()
            items[
              event.key === 'Home'
                ? 0
                : event.key === 'End'
                  ? items.length - 1
                  : (index +
                      (event.key === 'ArrowDown' ? 1 : -1) +
                      items.length) %
                    items.length
            ]?.focus()
          } else if (event.key.length === 1 && event.key !== ' ')
            items
              .find((item) =>
                item.textContent
                  ?.toLowerCase()
                  .startsWith(event.key.toLowerCase()),
              )
              ?.focus()
        }}
      >
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="option"
            aria-selected={option.value === value}
            onClick={() => {
              onChange(option.value)
              if (field.current) {
                field.current.value = option.value
                field.current.dispatchEvent(
                  new Event('input', { bubbles: true }),
                )
              }
              close()
            }}
          >
            <span>{option.label}</span>
            {option.value === value && <Check size={17} aria-hidden="true" />}
          </button>
        ))}
      </div>
    </div>
  )
}

export function Button({
  busy = false,
  icon,
  variant = 'secondary',
  className = '',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      className={`button button--${variant} ${className}`}
      {...props}
      disabled={busy || props.disabled}
      aria-busy={busy}
    >
      {busy ? <span className="ui-spinner" aria-hidden="true" /> : icon}
      <span>{children}</span>
    </button>
  )
}

export function StatusBadge({
  status,
}: {
  status: ContentStatus | 'Published' | 'Archived'
}) {
  const normalized = status.toLowerCase() as ContentStatus
  return (
    <span className={`status status--${normalized}`}>
      <i />
      {normalized[0].toUpperCase() + normalized.slice(1)}
    </span>
  )
}

export function MetricCard({
  label,
  value,
  note,
  icon,
}: {
  label: string
  value: string
  note: string
  icon: ReactNode
}) {
  return (
    <article className="metric-card">
      <div className="metric-card__head">
        <span>{label}</span>
        <span className="metric-card__icon">{icon}</span>
      </div>
      <div className="metric-card__value">{value}</div>
      <p>{note}</p>
    </article>
  )
}
