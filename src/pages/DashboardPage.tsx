import { Aperture, Building2, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Download, Image, Plus, Search, Upload, Wrench } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { recentUpdates } from '../data/mockData'
import { SafeImage } from '../components/SafeImage'
import { Button, MetricCard, PlaceholderDialog, StatusBadge } from '../components/ui'

const metrics = [
  { label: 'Total Projects', value: '24', note: 'Active Portfolios', icon: <Building2 size={17} /> },
  { label: 'Total Works', value: '86', note: 'Completed Specs', icon: <Wrench size={17} /> },
  { label: 'Media Assets', value: '342', note: '4.2 GB of 50 GB', icon: <Image size={17} /> },
  { label: 'Published Content', value: '92%', note: '22 of 24 Live', icon: <CheckCircle2 size={17} /> },
]

export function DashboardPage() {
  const [dialog, setDialog] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const navigate = useNavigate()
  const pageSize = 4
  const filteredUpdates = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return recentUpdates.filter((project) => !normalized || `${project.title} ${project.scope} ${project.room}`.toLowerCase().includes(normalized))
  }, [query])
  const pageCount = Math.max(1, Math.ceil(filteredUpdates.length / pageSize))
  const visibleUpdates = filteredUpdates.slice((page - 1) * pageSize, page * pageSize)

  return (
    <div className="page">
      <div className="page-heading">
        <div><span className="eyebrow">JP Aluminium Interiors • Operations Hub</span><h1>Overview</h1><p>Welcome back, Vikram. Here is the latest portfolio status across your workspaces. <span className="mock-label">Illustrative data</span></p></div>
        <div className="page-heading__actions">
          <Button icon={<CalendarDays size={16} />} onClick={() => setDialog('Date range')}>Last 30 Days</Button>
          <Button icon={<Download size={16} />} onClick={() => setDialog('Export Spec')}>Export Spec</Button>
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => setDialog('Add Project')}>Add Project</Button>
        </div>
      </div>

      <section className="metrics" aria-label="Portfolio summary">
        {metrics.map((metric) => <MetricCard key={metric.label} {...metric} />)}
      </section>

      <div className="dashboard-grid">
        <section className="panel updates-panel">
          <div className="panel-heading">
            <div><h2>Recent Showcase Updates</h2><p>Manage live portfolio case studies, architectural photography, and release statuses.</p></div>
            <label className="compact-search"><Search size={15} /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1) }} aria-label="Filter showcase updates" placeholder="Filter showcase..." /></label>
            <button className="link-button" onClick={() => navigate('/projects')}>View All</button>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Project</th><th>Category &amp; Scope</th><th>Last Updated</th><th>Status</th><th aria-label="Actions" /></tr></thead>
              <tbody>
                {visibleUpdates.map((project) => (
                  <tr key={project.id}>
                    <td><div className="project-cell"><SafeImage className="project-thumb" src={project.image} alt="" loading="lazy" /><span><strong>{project.title}</strong><small>{project.scope}</small></span></div></td>
                    <td>{project.room}</td>
                    <td>{project.updated}</td>
                    <td><StatusBadge status={project.status} /></td>
                    <td><button className="table-edit" onClick={() => setDialog(`Edit ${project.title}`)}>Edit</button></td>
                  </tr>
                ))}
                {!visibleUpdates.length && <tr><td colSpan={5}><div className="dashboard-empty">No matching updates</div></td></tr>}
              </tbody>
            </table>
          </div>
          <div className="panel-footer"><span>Showing {visibleUpdates.length} of {filteredUpdates.length} illustrative projects</span><div><button onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1}><ChevronLeft size={14} />Prev</button><span>Page {page} of {pageCount}</span><button onClick={() => setPage((current) => Math.min(pageCount, current + 1))} disabled={page === pageCount}>Next<ChevronRight size={14} /></button></div></div>
        </section>

        <aside className="panel quick-actions">
          <h2>Quick Actions</h2>
          <p>Create new showcase projects or upload architectural media.</p>
          <button className="quick-action quick-action--primary" onClick={() => setDialog('Add Project')}><Plus size={18} /><span>Add Project</span><ChevronRight size={17} /></button>
          <button className="quick-action" onClick={() => setDialog('Add Work')}><Aperture size={18} /><span>Add Work</span><ChevronRight size={17} /></button>
          <button className="quick-action" onClick={() => setDialog('Upload Media')}><Upload size={18} /><span>Upload Media</span><ChevronRight size={17} /></button>
        </aside>
      </div>
      {dialog && <PlaceholderDialog title={dialog} onClose={() => setDialog(null)} />}
    </div>
  )
}
