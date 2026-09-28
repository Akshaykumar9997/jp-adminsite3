import { Download, Edit3, Eye, Grid2X2, List, Mail, MapPin, MoreVertical, Phone, Search, UserPlus, UsersRound } from 'lucide-react'
import { useMemo, useState } from 'react'
import { collaborators } from '../data/adminMockData'
import { Button, MetricCard, PlaceholderDialog } from '../components/ui'

type View = 'list' | 'grid'

export function CollaborationsPage() {
  const [query, setQuery] = useState('')
  const [role, setRole] = useState('All')
  const [status, setStatus] = useState('All')
  const [sort, setSort] = useState('recent')
  const [view, setView] = useState<View>('list')
  const [selectedId, setSelectedId] = useState(1)
  const [dialog, setDialog] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return collaborators
      .filter((person) => role === 'All' || person.role === role)
      .filter((person) => status === 'All' || person.status === status)
      .filter((person) => !normalized || `${person.name} ${person.studio} ${person.role} ${person.projects}`.toLowerCase().includes(normalized))
      .sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name) : sort === 'active' ? a.status.localeCompare(b.status) : a.id - b.id)
  }, [query, role, sort, status])
  const selected = collaborators.find((person) => person.id === selectedId) ?? collaborators[0]

  return (
    <div className="page cms-page">
      <div className="breadcrumbs">CMS Master Index <span>/</span> Collaborations</div>
      <div className="page-heading"><div><h1>Collaborations</h1><p>Manage project partners, consultants, vendors, and collaboration assignments. <span className="mock-label">Illustrative data</span></p></div><div className="page-heading__actions"><Button icon={<Download size={15} />} onClick={() => setDialog('Export Collaborator Directory')}>Export Directory</Button><Button variant="primary" icon={<UserPlus size={15} />} onClick={() => setDialog('Add Collaborator')}>Add Collaborator</Button></div></div>

      <section className="metrics cms-metrics cms-metrics--three" aria-label="Collaboration summary">
        <MetricCard label="Total Collaborators" value="48" note="Registered Partners" icon={<UsersRound size={17} />} />
        <MetricCard label="Active Collaborations" value="34" note="Assigned to Live Works" icon={<UsersRound size={17} />} />
        <MetricCard label="Pending Review" value="5" note="Agreement & NDA" icon={<UsersRound size={17} />} />
      </section>

      <div className="cms-toolbar cms-toolbar--wrap">
        <label className="filter-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search collaborators..." aria-label="Search collaborators" /></label>
        <label className="select-control"><select value={role} onChange={(event) => setRole(event.target.value)} aria-label="Collaborator role"><option value="All">All Roles</option>{[...new Set(collaborators.map((person) => person.role))].map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className="select-control"><select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Collaborator status"><option value="All">All Statuses</option><option>Active</option><option>Pending NDA</option><option>Inactive</option></select></label>
        <label className="select-control"><select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort collaborators"><option value="recent">Recently Updated</option><option value="name">Name A–Z</option><option value="active">Most Active</option></select></label>
        <div className="view-toggle" aria-label="Collaborator view"><button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')} aria-label="List view"><List size={18} /></button><button className={view === 'grid' ? 'active' : ''} onClick={() => setView('grid')} aria-label="Grid view"><Grid2X2 size={17} /></button></div>
      </div>

      <div className="split-workspace collaboration-workspace">
        <section className={`collaborator-list collaborator-list--${view}`}>
          {view === 'list' && <div className="collaborator-list__head"><span>Collaborator</span><span>Role</span><span>Assigned Projects</span><span>Contact</span><span>Status</span><span>Updated</span><span>Actions</span></div>}
          {filtered.map((person) => <article key={person.id} className={`collaborator-row ${selected.id === person.id ? 'selected' : ''}`}>
            <button className="collaborator-person" onClick={() => setSelectedId(person.id)}><span className="collaborator-avatar">{person.initials}</span><span><strong>{person.name}</strong><small>{person.studio}</small></span></button>
            <span data-label="Role">{person.role}</span><span data-label="Projects">{person.projects}</span><span className="collaborator-contact" data-label="Contact"><a href={`mailto:${person.email}`}>{person.email}</a><small>{person.phone}</small></span><span data-label="Status"><i className={`collaborator-status collaborator-status--${person.status.toLowerCase().replace(' ', '-')}`}>{person.status}</i></span><span data-label="Updated">{person.updated}</span>
            <div className="row-actions"><button aria-label={`View ${person.name}`} onClick={() => setSelectedId(person.id)}><Eye size={14} /></button><button aria-label={`Edit ${person.name}`} onClick={() => setDialog(`Edit ${person.name}`)}><Edit3 size={14} /></button><button aria-label={`More options for ${person.name}`} onClick={() => setDialog(`Manage ${person.name}`)}><MoreVertical size={14} /></button></div>
          </article>)}
          {!filtered.length && <div className="empty-state"><h2>No matching collaborators</h2><p>Try changing the search or directory filters.</p></div>}
        </section>

        <aside className="detail-panel collaborator-detail">
          <div className="detail-panel__head"><div><span className="eyebrow">Collaborator Dossier</span><h2>{selected.name}</h2><p>{selected.role} • {selected.studio}</p></div><span className={`collaborator-status collaborator-status--${selected.status.toLowerCase().replace(' ', '-')}`}>{selected.status}</span></div>
          <div className="dossier-contact"><p><Mail size={14} /><span>{selected.email}</span></p><p><Phone size={14} /><span>{selected.phone}</span></p><p><MapPin size={14} /><span>New Delhi &amp; Bangalore, India</span></p></div>
          <div className="detail-block"><h3>Assigned Projects</h3><p><strong>Jubilee Hills Residence</strong><span>14 Works • Architectural Director</span></p><p><strong>The Altius Villa</strong><span>6 Works • Joinery Consultant</span></p><Button icon={<UserPlus size={14} />} onClick={() => setDialog('Assign Project')}>Assign Project</Button></div>
          <div className="detail-block"><h3>Access &amp; Governance</h3><dl><div><dt>Partner Portal Access</dt><dd>Enabled</dd></div><div><dt>NDA / Specification Agreement</dt><dd>Valid until Dec 2026</dd></div></dl></div>
          <Button variant="primary" onClick={() => setDialog(`Edit ${selected.name}`)}>Edit Dossier</Button>
        </aside>
      </div>
      <div className="projects-pagination"><span>Showing {filtered.length} of 48 illustrative collaborators</span><nav aria-label="Collaborator pages"><button disabled>‹</button><button className="active">1</button><button onClick={() => setDialog('Collaborator page 2')}>2</button><button onClick={() => setDialog('Next collaborator page')}>›</button></nav></div>
      {dialog && <PlaceholderDialog title={dialog} onClose={() => setDialog(null)} />}
    </div>
  )
}
