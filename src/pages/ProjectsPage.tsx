import { ChevronLeft, ChevronRight, Grid2X2, List, Plus, Search, SlidersHorizontal } from 'lucide-react'
import { useMemo, useState } from 'react'
import { ProjectCard } from '../components/ProjectCard'
import { Button, StatusBadge } from '../components/ui'
import { AsyncForm, CmsDialog, ErrorState, LoadingState, StatusField } from '../components/CmsDialog'
import { useAsyncData } from '../hooks/useAsyncData'
import { deleteProject, deleteRoomCategory, deleteWork, listProjectRooms, listProjects, listRoomCategories, listWorks, saveProject, saveRoomCategory, saveWork } from '../lib/showcase'
import type { ContentStatus, Project, RoomCategory, Work } from '../lib/database.types'

type Tab = 'projects' | 'works' | 'rooms'
type View = 'grid' | 'list'
type Dialog = { type: 'project'; item?: Project } | { type: 'work'; item?: Work } | { type: 'room'; item?: RoomCategory }
const pageSize = 6
const value = (form: FormData, key: string) => String(form.get(key) ?? '').trim()
const slugify = (text: string) => text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const prettyDate = (date: string) => new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(date))

async function loadContent() {
  const [projects, works, rooms, projectRooms] = await Promise.all([listProjects(), listWorks(), listRoomCategories(), listProjectRooms()])
  return { projects, works, rooms, projectRooms }
}

export function ProjectsPage() {
  const { data, error, loading, reload } = useAsyncData(loadContent)
  const [tab, setTab] = useState<Tab>('projects')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('All')
  const [room, setRoom] = useState('All Rooms')
  const [sort, setSort] = useState('recent')
  const [view, setView] = useState<View>('grid')
  const [page, setPage] = useState(1)
  const [dialog, setDialog] = useState<Dialog | null>(null)

  const projects = data?.projects ?? []
  const works = data?.works ?? []
  const rooms = data?.rooms ?? []
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return projects
      .filter((project) => !normalized || `${project.title} ${project.location ?? ''}`.toLowerCase().includes(normalized))
      .filter((project) => status === 'All' || project.status === status.toLowerCase())
      .filter((project) => room === 'All Rooms' || data?.projectRooms.some((item) => item.project_id === project.id && rooms.find((category) => category.id === item.room_category_id)?.name === room))
      .sort((a, b) => sort === 'title' ? a.title.localeCompare(b.title) : sort === 'status' ? a.status.localeCompare(b.status) : b.updated_at.localeCompare(a.updated_at))
  }, [data?.projectRooms, projects, query, room, rooms, sort, status])
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize)
  const close = () => { setDialog(null); void reload() }

  return (
    <div className="page">
      <div className="page-heading">
        <div><h1>Projects &amp; Works</h1><p>Curate public showcases, assign rooms, and link bespoke aluminium works.</p></div>
        <Button variant="primary" icon={<Plus size={16} />} onClick={() => setDialog({ type: tab === 'rooms' ? 'room' : tab === 'works' ? 'work' : 'project' })}>Add {tab === 'rooms' ? 'Room Category' : tab === 'works' ? 'Work' : 'Project'}</Button>
      </div>

      <div className="tabs" role="tablist" aria-label="Content type">
        <button role="tab" aria-selected={tab === 'projects'} className={tab === 'projects' ? 'active' : ''} onClick={() => setTab('projects')}>Projects <span>{projects.length}</span></button>
        <button role="tab" aria-selected={tab === 'works'} className={tab === 'works' ? 'active' : ''} onClick={() => setTab('works')}>Works <span>{works.length}</span></button>
        <button role="tab" aria-selected={tab === 'rooms'} className={tab === 'rooms' ? 'active' : ''} onClick={() => setTab('rooms')}>Room Categories <span>{rooms.length}</span></button>
      </div>

      {loading ? <LoadingState /> : error ? <ErrorState message={error} retry={() => void reload()} /> : tab === 'projects' ? (
        <>
          <div className="filters">
            <label className="filter-search"><Search size={16} /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1) }} placeholder="Search projects by name, location..." aria-label="Search projects" /></label>
            <label><SlidersHorizontal size={15} /><select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }} aria-label="Filter by status"><option>All</option><option>Published</option><option>Draft</option><option>Archived</option></select></label>
            <label><select value={room} onChange={(event) => { setRoom(event.target.value); setPage(1) }} aria-label="Filter by room"><option>All Rooms</option>{rooms.map((item) => <option key={item.id}>{item.name}</option>)}</select></label>
            <label><select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort projects"><option value="recent">Recently Updated</option><option value="title">Title A–Z</option><option value="status">Publication Status</option></select></label>
            <div className="view-toggle" aria-label="View style"><button className={view === 'grid' ? 'active' : ''} onClick={() => setView('grid')} aria-label="Grid view"><Grid2X2 size={17} /></button><button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')} aria-label="List view"><List size={18} /></button></div>
          </div>
          <section className={`project-grid project-grid--${view}`} aria-live="polite">
            {visible.map((project) => <ProjectCard key={project.id} project={{ id: project.id, title: project.title, location: project.location ?? 'Location not set', spaces: data?.projectRooms.filter((item) => item.project_id === project.id).length ?? 0, works: works.filter((item) => item.project_id === project.id).length, status: project.status, updated: `Updated ${prettyDate(project.updated_at)}`, image: '/assets/project-01.jpg' }} onEdit={(id) => setDialog({ type: 'project', item: projects.find((item) => item.id === id) })} />)}
            {!visible.length && <div className="empty-state"><h2>No projects yet</h2><p>Add a project or change the current filters.</p></div>}
          </section>
          <div className="projects-pagination"><span>Showing {visible.length} of {filtered.length} projects</span><nav aria-label="Project pages"><button onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1} aria-label="Previous page"><ChevronLeft size={17} /></button>{Array.from({ length: pageCount }, (_, index) => index + 1).map((number) => <button key={number} className={number === page ? 'active' : ''} onClick={() => setPage(number)}>{number}</button>)}<button onClick={() => setPage((current) => Math.min(pageCount, current + 1))} disabled={page === pageCount} aria-label="Next page"><ChevronRight size={17} /></button></nav></div>
        </>
      ) : (
        <section className="cms-section">
          <div className="cms-section__heading"><div><h2>{tab === 'works' ? 'Works' : 'Room Categories'}</h2><p>Manage the records used throughout the showcase.</p></div></div>
          <div className="history-list">
            {(tab === 'works' ? works : rooms).map((item) => <button key={item.id} className="cms-record-row" onClick={() => setDialog(tab === 'works' ? { type: 'work', item: item as Work } : { type: 'room', item: item as RoomCategory })}><span><strong>{'title' in item ? item.title : item.name}</strong><small>{'specification' in item ? item.specification || 'No specification' : item.description || 'No description'}</small></span><StatusBadge status={item.status} /></button>)}
            {!(tab === 'works' ? works : rooms).length && <div className="empty-state"><h2>No records yet</h2><p>Use the Add button to create the first one.</p></div>}
          </div>
        </section>
      )}

      {dialog?.type === 'project' && <CmsDialog title={dialog.item ? `Edit ${dialog.item.title}` : 'Add Project'} onClose={() => setDialog(null)}><AsyncForm onClose={close} danger={dialog.item ? { label: 'Delete project', action: () => deleteProject(dialog.item!.id) } : undefined} onSubmit={async (form) => { const title = value(form, 'title'); await saveProject({ slug: value(form, 'slug') || slugify(title), title, summary: value(form, 'summary') || null, description: value(form, 'description') || null, location: value(form, 'location') || null, project_type: value(form, 'project_type') || null, scope: value(form, 'scope') || null, status: value(form, 'status') as ContentStatus, cover_asset_id: null, sort_order: Number(value(form, 'sort_order') || 0) }, dialog.item?.id) }}><div className="cms-dialog__grid"><label className="field"><span>Title</span><input name="title" required defaultValue={dialog.item?.title} /></label><label className="field"><span>Slug</span><input name="slug" defaultValue={dialog.item?.slug} placeholder="Generated from title" /></label><label className="field"><span>Location</span><input name="location" defaultValue={dialog.item?.location ?? ''} /></label><label className="field"><span>Project type</span><input name="project_type" defaultValue={dialog.item?.project_type ?? ''} /></label><label className="field"><span>Scope</span><input name="scope" defaultValue={dialog.item?.scope ?? ''} /></label><label className="field"><span>Sort order</span><input name="sort_order" type="number" defaultValue={dialog.item?.sort_order ?? 0} /></label><StatusField value={dialog.item?.status} /><label className="field field--wide"><span>Summary</span><textarea name="summary" defaultValue={dialog.item?.summary ?? ''} /></label><label className="field field--wide"><span>Description</span><textarea name="description" defaultValue={dialog.item?.description ?? ''} /></label></div></AsyncForm></CmsDialog>}

      {dialog?.type === 'room' && <CmsDialog title={dialog.item ? `Edit ${dialog.item.name}` : 'Add Room Category'} onClose={() => setDialog(null)}><AsyncForm onClose={close} danger={dialog.item ? { label: 'Delete category', action: () => deleteRoomCategory(dialog.item!.id) } : undefined} onSubmit={async (form) => { const name = value(form, 'name'); await saveRoomCategory({ name, slug: value(form, 'slug') || slugify(name), description: value(form, 'description') || null, zone_label: value(form, 'zone_label') || null, status: value(form, 'status') as ContentStatus, sort_order: Number(value(form, 'sort_order') || 0) }, dialog.item?.id) }}><div className="cms-dialog__grid"><label className="field"><span>Name</span><input name="name" required defaultValue={dialog.item?.name} /></label><label className="field"><span>Slug</span><input name="slug" defaultValue={dialog.item?.slug} /></label><label className="field"><span>Zone label</span><input name="zone_label" defaultValue={dialog.item?.zone_label ?? ''} /></label><label className="field"><span>Sort order</span><input name="sort_order" type="number" defaultValue={dialog.item?.sort_order ?? 0} /></label><StatusField value={dialog.item?.status} /><label className="field field--wide"><span>Description</span><textarea name="description" defaultValue={dialog.item?.description ?? ''} /></label></div></AsyncForm></CmsDialog>}

      {dialog?.type === 'work' && <CmsDialog title={dialog.item ? `Edit ${dialog.item.title}` : 'Add Work'} onClose={() => setDialog(null)}><AsyncForm onClose={close} danger={dialog.item ? { label: 'Delete work', action: () => deleteWork(dialog.item!.id) } : undefined} onSubmit={async (form) => { const projectRoomId = value(form, 'project_room_id') || null; const projectRoom = data?.projectRooms.find((item) => item.id === projectRoomId); await saveWork({ title: value(form, 'title'), slug: value(form, 'slug') || null, summary: value(form, 'summary') || null, specification: value(form, 'specification') || null, project_id: projectRoom?.project_id ?? null, project_room_id: projectRoomId, room_category_id: projectRoom?.room_category_id ?? value(form, 'room_category_id'), status: value(form, 'status') as ContentStatus, cover_asset_id: null, sort_order: Number(value(form, 'sort_order') || 0) }, dialog.item?.id) }}><div className="cms-dialog__grid"><label className="field"><span>Title</span><input name="title" required defaultValue={dialog.item?.title} /></label><label className="field"><span>Slug</span><input name="slug" defaultValue={dialog.item?.slug ?? ''} /></label><label className="field"><span>Project room (optional)</span><select name="project_room_id" defaultValue={dialog.item?.project_room_id ?? ''}><option value="">Standalone work</option>{data?.projectRooms.map((item) => <option key={item.id} value={item.id}>{projects.find((project) => project.id === item.project_id)?.title} — {rooms.find((category) => category.id === item.room_category_id)?.name}</option>)}</select></label><label className="field"><span>Room category</span><select name="room_category_id" required defaultValue={dialog.item?.room_category_id}><option value="">Select category</option>{rooms.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="field"><span>Sort order</span><input name="sort_order" type="number" defaultValue={dialog.item?.sort_order ?? 0} /></label><StatusField value={dialog.item?.status} /><label className="field field--wide"><span>Summary</span><textarea name="summary" defaultValue={dialog.item?.summary ?? ''} /></label><label className="field field--wide"><span>Specification</span><textarea name="specification" defaultValue={dialog.item?.specification ?? ''} /></label></div></AsyncForm></CmsDialog>}
    </div>
  )
}
