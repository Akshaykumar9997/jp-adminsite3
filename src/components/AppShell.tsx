import {
  Boxes,
  ExternalLink,
  Handshake,
  Image,
  LayoutDashboard,
  LogOut,
  Menu,
  SlidersHorizontal,
  UserRound,
  X,
  Trash2,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { logoUrl } from '../lib/branding'
import { useAuth } from '../auth/AuthProvider'
import { useFeedback, useOperation } from './Feedback'
import { useUploads } from './UploadManager'

const contentItems = [
  { label: 'Rooms', icon: Boxes, to: '/rooms' },
  { label: 'Media Library', icon: Image, to: '/media' },
  { label: 'Materials', icon: SlidersHorizontal, to: '/materials' },
  { label: 'Partners', icon: Handshake, to: '/partners' },
  { label: 'Trash', icon: Trash2, to: '/trash' },
]

export function AppShell() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [mobile, setMobile] = useState(
    () => window.matchMedia('(max-width: 820px)').matches,
  )
  const sidebarRef = useRef<HTMLElement>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const { pathname } = useLocation()
  const { signOut, user } = useAuth()
  const { confirm, hasUnsaved, notify } = useFeedback()
  const uploads = useUploads()
  const logout = useOperation()
  const leave = async () => {
    if (
      uploads.items.some((item) =>
        ['queued', 'uploading', 'processing'].includes(item.state),
      )
    ) {
      notify('Finish or cancel active uploads before signing out.', 'warning')
      return
    }
    if (
      hasUnsaved() &&
      !(await confirm({
        title: 'Unsaved changes',
        message: 'Sign out without saving your changes?',
        confirmLabel: 'Sign out',
      }))
    )
      return
    await logout.run(signOut, { action: 'sign out' })
  }
  const adminLabel = user?.email?.split('@')[0] || 'Administrator'
  const initials = adminLabel.slice(0, 2).toUpperCase()

  useEffect(() => {
    setMenuOpen(false)
    window.scrollTo({ top: 0, left: 0 })
  }, [pathname])

  useEffect(() => {
    const query = window.matchMedia('(max-width: 820px)')
    const update = () => {
      setMobile(query.matches)
      setMenuOpen(false)
    }
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    if (!menuOpen || !mobile) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    sidebarRef.current?.querySelector<HTMLAnchorElement>('a')?.focus()
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setMenuOpen(false)
      }
      if (event.key !== 'Tab') return
      const controls = Array.from(
        sidebarRef.current?.querySelectorAll<HTMLElement>(
          'a,button:not(:disabled)',
        ) ?? [],
      )
      const first = controls[0],
        last = controls.at(-1)
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first?.focus()
      }
    }
    document.addEventListener('keydown', keydown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', keydown)
      toggleRef.current?.focus()
    }
  }, [menuOpen, mobile])

  return (
    <div className="app-shell">
      <aside
        ref={sidebarRef}
        inert={mobile && !menuOpen}
        className={`sidebar ${menuOpen ? 'sidebar--open' : ''}`}
      >
        <div className="brand">
          <img
            src={logoUrl}
            alt="JP Aluminium"
            onError={(event) => {
              event.currentTarget.hidden = true
            }}
          />
          <div>
            <strong>JP ALUMINIUM</strong>
            <span>INTERIOR WORKS</span>
          </div>
        </div>
        <nav aria-label="Admin navigation">
          <NavLink to="/" end onClick={() => setMenuOpen(false)}>
            <LayoutDashboard size={18} />
            Dashboard
          </NavLink>
          {contentItems.map(({ label, icon: Icon, to }) => (
            <NavLink key={label} to={to} onClick={() => setMenuOpen(false)}>
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar__profile">
          <span className="avatar">{initials}</span>
          <span title={user?.email}>
            <strong>{adminLabel}</strong>
            <small>Admin</small>
          </span>
          <button
            className="sidebar__logout"
            aria-label="Sign out"
            title="Sign out"
            disabled={logout.pending}
            onClick={() => void leave()}
          >
            <LogOut size={17} />
          </button>
        </div>
      </aside>
      {menuOpen && (
        <button
          className="navigation-scrim"
          aria-label="Close navigation"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <div className="app-frame" inert={mobile && menuOpen}>
        <header className="topbar">
          <button
            className="mobile-menu"
            ref={toggleRef}
            aria-label="Toggle navigation"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X /> : <Menu />}
          </button>
          <span className="workspace-label">JP Aluminium Interior Works</span>
          <div className="topbar__actions">
            <span className="environment">
              <i />
              Admin site
            </span>
            {import.meta.env.VITE_SHOWCASE_SITE_URL && (
              <a
                className="text-action"
                href={import.meta.env.VITE_SHOWCASE_SITE_URL}
                target="_blank"
                rel="noreferrer"
              >
                View website <ExternalLink size={15} />
              </a>
            )}
            <span className="avatar avatar--small">
              <UserRound size={16} />
            </span>
          </div>
        </header>
        <main>
          <Outlet />
        </main>
        <nav className="gallery-mobile-nav" aria-label="Gallery navigation">
          {contentItems.map(({ label, icon: Icon, to }) => (
            <NavLink key={to} to={to}>
              <Icon size={21} />
              <span>{label === 'Media Library' ? 'Gallery' : label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}
