import { Aperture, Building2, CheckCircle2, ChevronRight, Image, Plus, Upload, Wrench } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button, MetricCard } from '../components/ui'
import { ErrorState, LoadingState } from '../components/CmsDialog'
import { useAsyncData } from '../hooks/useAsyncData'
import { getDashboard } from '../lib/showcase'

export function DashboardPage() {
  const navigate = useNavigate()
  const { data, error, loading, reload } = useAsyncData(getDashboard)
  const counts = data?.counts ?? { projects: 0, works: 0, media: 0, published: 0 }
  const publishedPercent = counts.projects ? Math.round((counts.published / counts.projects) * 100) : 0
  const metrics = [
    { label: 'Total Projects', value: String(counts.projects), note: 'Showcase records', icon: <Building2 size={17} /> },
    { label: 'Total Works', value: String(counts.works), note: 'Linked and standalone', icon: <Wrench size={17} /> },
    { label: 'Media Assets', value: String(counts.media), note: 'Private bucket metadata', icon: <Image size={17} /> },
    { label: 'Published Content', value: `${publishedPercent}%`, note: `${counts.published} of ${counts.projects} projects`, icon: <CheckCircle2 size={17} /> },
  ]

  return <div className="page">
    <div className="page-heading"><div><span className="eyebrow">JP Aluminium Interiors • Operations Hub</span><h1>Overview</h1><p>Live showcase status and recent administrative activity.</p></div><div className="page-heading__actions"><Button variant="primary" icon={<Plus size={16} />} onClick={() => navigate('/projects')}>Add Project</Button></div></div>
    {loading ? <LoadingState /> : error ? <ErrorState message={error} retry={() => void reload()} /> : <>
      <section className="metrics" aria-label="Portfolio summary">{metrics.map((metric) => <MetricCard key={metric.label} {...metric} />)}</section>
      <div className="dashboard-grid"><section className="panel updates-panel"><div className="panel-heading"><div><h2>Recent Showcase Activity</h2><p>Audit events written by protected database triggers.</p></div><button className="link-button" onClick={() => navigate('/settings')}>View Audit</button></div><div className="table-wrap"><table><thead><tr><th>Action</th><th>Entity</th><th>Record</th><th>Occurred</th></tr></thead><tbody>{data?.events.map((event) => <tr key={event.id}><td>{event.action.toUpperCase()}</td><td>{event.table_name}</td><td>{event.record_id ?? '—'}</td><td>{new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(event.occurred_at))}</td></tr>)}{!data?.events.length && <tr><td colSpan={4}><div className="dashboard-empty">No administrative changes recorded yet.</div></td></tr>}</tbody></table></div></section><aside className="panel quick-actions"><h2>Quick Actions</h2><p>Create content or upload private showcase media.</p><button className="quick-action quick-action--primary" onClick={() => navigate('/projects')}><Plus size={18} /><span>Add Project</span><ChevronRight size={17} /></button><button className="quick-action" onClick={() => navigate('/projects')}><Aperture size={18} /><span>Add Work</span><ChevronRight size={17} /></button><button className="quick-action" onClick={() => navigate('/media')}><Upload size={18} /><span>Upload Media</span><ChevronRight size={17} /></button></aside></div>
    </>}
  </div>
}
