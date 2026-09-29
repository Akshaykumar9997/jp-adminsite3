import { Bell, Boxes, ExternalLink, Handshake, Image, LayoutDashboard, LogOut, Menu, PanelTop, Search, Settings, Shapes, SlidersHorizontal, UserRound, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { logoUrl } from '../data/mockData'
import { useAuth } from '../auth/AuthProvider'

const contentItems = [
  { label: 'Rooms & Categories', icon: Boxes, to: '/rooms' },
  { label: 'Media Library', icon: Image, to: '/media' },
  { label: 'Materials & Finishes', icon: SlidersHorizontal, to: '/materials' },
  { label: 'Collaborations', icon: Handshake, to: '/collaborations' },
  { label: 'Landing Page', icon: PanelTop, to: '/landing' },
]

export function AppShell() {
  const [menuOpen, setMenuOpen] = useState(false)
  const { pathname } = useLocation()
  const { signOut, user } = useAuth()
  const adminLabel = user?.email?.split('@')[0] || 'Administrator'
  const initials = adminLabel.slice(0, 2).toUpperCase()

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 })
  }, [pathname])

  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? 'sidebar--open' : ''}`}>
        <div className="brand">
          <img src={logoUrl} alt="JP Aluminium" onError={(event) => { event.currentTarget.hidden = true }} />
          <div><strong>JP ALUMINIUM</strong><span>INTERIOR WORKS</span></div>
        </div>
        <nav aria-label="Admin navigation">
          <NavLink to="/" end onClick={() => setMenuOpen(false)}><LayoutDashboard size={18} />Dashboard</NavLink>
          <NavLink to="/projects" onClick={() => setMenuOpen(false)}><Shapes size={18} />Projects &amp; Works</NavLink>
          {contentItems.map(({ label, icon: Icon, to }) => (
            <NavLink key={label} to={to} onClick={() => setMenuOpen(false)}><Icon size={18} />{label}</NavLink>
          ))}
          <NavLink to="/settings" onClick={() => setMenuOpen(false)}><Settings size={18} />Settings</NavLink>
        </nav>
        <div className="sidebar__profile">
          <span className="avatar">{initials}</span>
          <span title={user?.email}><strong>{adminLabel}</strong><small>Admin</small></span>
          <button className="sidebar__logout" aria-label="Sign out" title="Sign out" onClick={() => void signOut()}><LogOut size={17} /></button>
        </div>
      </aside>

      <div className="app-frame">
        <header className="topbar">
          <button className="mobile-menu" aria-label="Toggle navigation" onClick={() => setMenuOpen((open) => !open)}>{menuOpen ? <X /> : <Menu />}</button>
          <label className="global-search"><Search size={17} /><input aria-label="Search CMS" placeholder="Search projects, materials, assets..." /><kbd>⌘K</kbd></label>
          <div className="topbar__actions">
            <span className="environment"><i />Production</span>
            <button className="text-action">View Live Site <ExternalLink size={15} /></button>
            <button className="icon-button" aria-label="Notifications"><Bell size={18} /></button>
            <span className="avatar avatar--small"><UserRound size={16} /></span>
          </div>
        </header>
        <main><Outlet /></main>
      </div>
    </div>
  )
}
