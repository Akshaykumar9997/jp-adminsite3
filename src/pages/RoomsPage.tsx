import { Boxes, Grid2X2, Image, Link2, List, Pencil, Plus, Search, Unlink, Wrench } from 'lucide-react'
import { useMemo, useState } from 'react'
import { roomWorks } from '../data/adminMockData'
import { SafeImage } from '../components/SafeImage'
import { Button, MetricCard, PlaceholderDialog, StatusBadge } from '../components/ui'

type WorkTab = 'All Works' | 'Project Linked' | 'Standalone Work'
type View = 'grid' | 'list'

export function RoomsPage() {
  const [tab, setTab] = useState<WorkTab>('All Works')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('All')
  const [view, setView] = useState<View>('grid')
  const [dialog, setDialog] = useState<string | null>(null)

  const visibleWorks = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return roomWorks.filter((work) =>
      (tab === 'All Works' || work.type === tab) &&
      (status === 'All' || work.status === status) &&
      (!normalized || `${work.title} ${work.association} ${work.specification}`.toLowerCase().includes(normalized)),
    )
  }, [query, status, tab])

  return (
    <div className="page cms-page">
      <div className="breadcrumbs">Rooms &amp; Categories <span>/</span> Room Detail <span>/</span> Living &amp; Hall</div>
      <div className="page-heading room-heading">
        <div><span className="eyebrow">Room Zone 01 • Master Category</span><h1>Living &amp; Hall</h1><p>Main entrance, double-height living area and hall. <span className="mock-label">Illustrative data</span></p></div>
        <div className="page-heading__actions">
          <Button icon={<Pencil size={15} />} onClick={() => setDialog('Edit Room')}>Edit Room</Button>
          <Button onClick={() => setDialog('Reorder Works')}>Reorder Works</Button>
          <Button icon={<Link2 size={15} />} onClick={() => setDialog('Link Existing Work')}>Link Existing Work</Button>
          <Button variant="primary" icon={<Plus size={15} />} onClick={() => setDialog('Add New Work')}>Add New Work</Button>
        </div>
      </div>

      <section className="metrics cms-metrics" aria-label="Room summary">
        <MetricCard label="Total Works" value="24" note="Catalogued" icon={<Wrench size={17} />} />
        <MetricCard label="Project-Linked Works" value="18" note="Active" icon={<Boxes size={17} />} />
        <MetricCard label="Standalone Works" value="06" note="Specimens" icon={<Grid2X2 size={17} />} />
        <MetricCard label="Media Assets" value="142" note="CAD & Renders" icon={<Image size={17} />} />
      </section>

      <section className="cms-section">
        <div className="cms-section__heading"><div><h2>Works in Living &amp; Hall</h2><p>Manage architectural works linked to this room and standalone showcase works.</p></div><span className="status status--published"><i />Published to Client Portal</span></div>
        <div className="cms-toolbar cms-toolbar--wrap">
          <div className="tabs tabs--compact" role="tablist" aria-label="Work relationship">
            {(['All Works', 'Project Linked', 'Standalone Work'] as WorkTab[]).map((item) => <button key={item} role="tab" aria-selected={tab === item} className={tab === item ? 'active' : ''} onClick={() => setTab(item)}>{item}</button>)}
          </div>
          <label className="filter-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search works by title..." aria-label="Search room works" /></label>
          <label className="select-control"><select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Portal status"><option value="All">Portal Status: All</option><option>Published</option><option>Draft</option></select></label>
          <div className="view-toggle" aria-label="Room works view"><button className={view === 'grid' ? 'active' : ''} onClick={() => setView('grid')} aria-label="Grid view"><Grid2X2 size={17} /></button><button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')} aria-label="List view"><List size={18} /></button></div>
        </div>

        <div className={`asset-grid asset-grid--${view}`}>
          {visibleWorks.map((work) => (
            <article className="asset-card" key={work.id}>
              <div className="asset-card__media"><SafeImage src={work.image} alt={work.title} /><StatusBadge status={work.status} /></div>
              <div className="asset-card__body"><small>{work.type}</small><h3>{work.title}</h3><p>{work.association}</p><dl><div><dt>Finish</dt><dd>{work.specification}</dd></div></dl><div className="asset-card__footer"><span>{work.assets}</span><div><button onClick={() => setDialog(`Unlink ${work.title}`)} aria-label={`Unlink ${work.title}`}><Unlink size={14} /></button><button onClick={() => setDialog(`Edit ${work.title}`)} aria-label={`Edit ${work.title}`}><Pencil size={14} /></button></div></div></div>
            </article>
          ))}
          {!visibleWorks.length && <div className="empty-state"><h2>No matching works</h2><p>Try changing the search or publication filter.</p></div>}
          <button className="link-another" onClick={() => setDialog('Link Another Work')}><Link2 size={22} /><strong>Link Another Work</strong><span>Add an existing project-linked or standalone work to this room.</span></button>
        </div>
      </section>
      {dialog && <PlaceholderDialog title={dialog} onClose={() => setDialog(null)} />}
    </div>
  )
}
