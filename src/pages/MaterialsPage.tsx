import { Eye, Grid2X2, Layers, List, Plus, Search, Shapes, Wrench } from 'lucide-react'
import { useMemo, useState } from 'react'
import { materials } from '../data/adminMockData'
import { SafeImage } from '../components/SafeImage'
import { Button, MetricCard, PlaceholderDialog, StatusBadge } from '../components/ui'

type Range = 'All Materials' | 'Cap Range' | 'Mid Cap' | 'Low Cap'
type View = 'grid' | 'list'

export function MaterialsPage() {
  const [range, setRange] = useState<Range>('All Materials')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All')
  const [finish, setFinish] = useState('All')
  const [status, setStatus] = useState('All')
  const [view, setView] = useState<View>('grid')
  const [selectedId, setSelectedId] = useState(1)
  const [portalVisible, setPortalVisible] = useState(true)
  const [dialog, setDialog] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return materials.filter((material) =>
      (range === 'All Materials' || material.range === range) &&
      (category === 'All' || material.category === category) &&
      (finish === 'All' || material.finish === finish) &&
      (status === 'All' || material.status === status) &&
      (!normalized || `${material.code} ${material.name} ${material.category}`.toLowerCase().includes(normalized)),
    )
  }, [category, finish, query, range, status])
  const selected = materials.find((material) => material.id === selectedId) ?? materials[0]

  return (
    <div className="page cms-page">
      <div className="breadcrumbs">CMS Master Index <span>/</span> Materials &amp; Finishes</div>
      <div className="page-heading"><div><h1>Materials &amp; Finishes</h1><p>Manage material ranges, technical specifications, extrusion finishes, and client showcase visibility. <span className="mock-label">Illustrative data</span></p></div><div className="page-heading__actions"><Button icon={<Plus size={15} />} onClick={() => setDialog('Add Material Range')}>Add Material Range</Button><Button variant="primary" icon={<Plus size={15} />} onClick={() => setDialog('Add Material')}>Add Material</Button></div></div>

      <section className="metrics cms-metrics" aria-label="Material summary">
        <MetricCard label="Total Materials" value="42" note="Catalogued" icon={<Shapes size={17} />} />
        <MetricCard label="Material Ranges" value="3" note="Active Ranges" icon={<Layers size={17} />} />
        <MetricCard label="Published Finishes" value="38" note="Active in Portal" icon={<Eye size={17} />} />
        <MetricCard label="Linked Works" value="86" note="In Fit-out Specs" icon={<Wrench size={17} />} />
      </section>

      <div className="tabs" role="tablist" aria-label="Material range">
        {(['All Materials', 'Cap Range', 'Mid Cap', 'Low Cap'] as Range[]).map((item) => <button key={item} role="tab" aria-selected={range === item} className={range === item ? 'active' : ''} onClick={() => setRange(item)}>{item}</button>)}
      </div>
      <div className="cms-toolbar cms-toolbar--wrap">
        <label className="filter-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search material code, finish, profile..." aria-label="Search materials" /></label>
        <label className="select-control"><select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Material type"><option value="All">All Types</option>{[...new Set(materials.map((material) => material.category))].map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className="select-control"><select value={finish} onChange={(event) => setFinish(event.target.value)} aria-label="Material finish"><option value="All">All Finishes</option>{[...new Set(materials.map((material) => material.finish))].map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className="select-control"><select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Material visibility"><option value="All">All Visibility</option><option>Published</option><option>Draft</option></select></label>
        <div className="view-toggle" aria-label="Material view"><button className={view === 'grid' ? 'active' : ''} onClick={() => setView('grid')} aria-label="Grid view"><Grid2X2 size={17} /></button><button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')} aria-label="List view"><List size={18} /></button></div>
      </div>

      <div className="split-workspace">
        <section className={`material-grid material-grid--${view}`}>
          {filtered.map((material) => <button key={material.id} className={`material-card ${selected.id === material.id ? 'selected' : ''}`} onClick={() => setSelectedId(material.id)}>
            <div className="material-card__media"><SafeImage src={material.image} alt={material.name} /><span>{material.range}</span><StatusBadge status={material.status} /></div>
            <div className="material-card__body"><small>{material.code} • {material.category}</small><h3>{material.name}</h3><p>{material.description}</p><footer>{material.works} Works • {material.association}<strong>View →</strong></footer></div>
          </button>)}
          {!filtered.length && <div className="empty-state"><h2>No matching materials</h2><p>Try changing the current search or filters.</p></div>}
        </section>

        <aside className="detail-panel material-detail">
          <div className="detail-panel__head"><div><span className="eyebrow">{selected.code}</span><h2>{selected.name}</h2></div><StatusBadge status={selected.status} /></div>
          <SafeImage className="detail-panel__image" src={selected.image} alt={selected.name} />
          <div className="detail-block"><h3>A • Basic Classification</h3><dl><div><dt>Material Class</dt><dd>{selected.category}</dd></div><div><dt>Material Range</dt><dd>{selected.range}</dd></div><div><dt>Finish / Texture</dt><dd>{selected.finish}</dd></div><div><dt>Internal Reference</dt><dd>{selected.code}</dd></div></dl><p>{selected.description}</p></div>
          <div className="detail-block"><h3>B • Technical Specifications</h3><dl><div><dt>Standard / Grade</dt><dd>DIN EN 12020-2 / 6063-T6</dd></div><div><dt>Linked Works</dt><dd>{selected.works}</dd></div><div><dt>Project Allocation</dt><dd>{selected.association}</dd></div></dl></div>
          <div className="setting-row material-visibility"><span><strong>Client Portal Showcase</strong><small>Display in finish selectors and technical moodboards.</small></span><button type="button" className={`toggle ${portalVisible ? 'toggle--on' : ''}`} role="switch" aria-checked={portalVisible} aria-label="Client Portal Showcase" onClick={() => setPortalVisible((visible) => !visible)}><i /></button></div>
          <Button variant="primary" onClick={() => setDialog(`Save ${selected.name}`)}>Save Changes</Button>
        </aside>
      </div>
      {dialog && <PlaceholderDialog title={dialog} onClose={() => setDialog(null)} />}
    </div>
  )
}
