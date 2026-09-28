import { ChevronLeft, ChevronRight, Grid2X2, List, Plus, Search, SlidersHorizontal } from 'lucide-react'
import { useMemo, useState } from 'react'
import { ProjectCard } from '../components/ProjectCard'
import { Button, PlaceholderDialog } from '../components/ui'
import { projects } from '../data/mockData'

type Tab = 'projects' | 'works' | 'rooms'
type View = 'grid' | 'list'
const pageSize = 3

export function ProjectsPage() {
  const [tab, setTab] = useState<Tab>('projects')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('All')
  const [room, setRoom] = useState('All Rooms')
  const [sort, setSort] = useState('recent')
  const [view, setView] = useState<View>('grid')
  const [page, setPage] = useState(1)
  const [dialog, setDialog] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return projects
      .filter((project) => !normalized || `${project.title} ${project.location}`.toLowerCase().includes(normalized))
      .filter((project) => status === 'All' || project.status === status)
      .filter((project) => room === 'All Rooms' || project.room === room)
      .sort((a, b) => sort === 'title' ? a.title.localeCompare(b.title) : sort === 'status' ? a.status.localeCompare(b.status) : a.id - b.id)
  }, [query, room, sort, status])

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize)
  const resetPage = () => setPage(1)

  return (
    <div className="page">
      <div className="page-heading">
        <div><h1>Projects &amp; Works</h1><p>Curate client showcases, assign rooms, and link bespoke aluminium works. <span className="mock-label">Illustrative data</span></p></div>
        <Button variant="primary" icon={<Plus size={16} />} onClick={() => setDialog('Add Project')}>Add Project</Button>
      </div>

      <div className="tabs" role="tablist" aria-label="Content type">
        <button role="tab" aria-selected={tab === 'projects'} className={tab === 'projects' ? 'active' : ''} onClick={() => setTab('projects')}>Projects <span>24</span></button>
        <button role="tab" aria-selected={tab === 'works'} className={tab === 'works' ? 'active' : ''} onClick={() => setTab('works')}>Standalone Works <span>86</span></button>
        <button role="tab" aria-selected={tab === 'rooms'} className={tab === 'rooms' ? 'active' : ''} onClick={() => setTab('rooms')}>Room Categories <span>4</span></button>
      </div>

      {tab === 'projects' ? (
        <>
          <div className="filters">
            <label className="filter-search"><Search size={16} /><input value={query} onChange={(event) => { setQuery(event.target.value); resetPage() }} placeholder="Search projects by name, location..." aria-label="Search projects" /></label>
            <label><SlidersHorizontal size={15} /><select value={status} onChange={(event) => { setStatus(event.target.value); resetPage() }} aria-label="Filter by status"><option>All</option><option>Published</option><option>Draft</option></select></label>
            <label><select value={room} onChange={(event) => { setRoom(event.target.value); resetPage() }} aria-label="Filter by room"><option>All Rooms</option>{[...new Set(projects.map((project) => project.room))].map((item) => <option key={item}>{item}</option>)}</select></label>
            <label><select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort projects"><option value="recent">Recently Updated</option><option value="title">Title A–Z</option><option value="status">Publication Status</option></select></label>
            <div className="view-toggle" aria-label="View style"><button className={view === 'grid' ? 'active' : ''} onClick={() => setView('grid')} aria-label="Grid view"><Grid2X2 size={17} /></button><button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')} aria-label="List view"><List size={18} /></button></div>
          </div>

          <section className={`project-grid project-grid--${view}`} aria-live="polite">
            {visible.map((project) => <ProjectCard key={project.id} project={project} onEdit={(title) => setDialog(`Edit ${title}`)} />)}
            {!visible.length && <div className="empty-state"><h2>No matching projects</h2><p>Try changing the current search or filters.</p></div>}
          </section>

          <div className="projects-pagination">
            <span>Showing {visible.length} of {filtered.length} illustrative projects</span>
            <nav aria-label="Project pages">
              <button onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1} aria-label="Previous page"><ChevronLeft size={17} /></button>
              {Array.from({ length: pageCount }, (_, index) => index + 1).map((number) => <button key={number} className={number === page ? 'active' : ''} onClick={() => setPage(number)}>{number}</button>)}
              <button onClick={() => setPage((current) => Math.min(pageCount, current + 1))} disabled={page === pageCount} aria-label="Next page"><ChevronRight size={17} /></button>
            </nav>
          </div>
        </>
      ) : (
        <section className="tab-placeholder"><span className="eyebrow">Phase 1</span><h2>{tab === 'works' ? 'Standalone Works' : 'Room Categories'}</h2><p>This approved navigation state is functional, but its management screen is intentionally deferred to a later phase.</p></section>
      )}
      {dialog && <PlaceholderDialog title={dialog} onClose={() => setDialog(null)} />}
    </div>
  )
}
