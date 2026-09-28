import { Box, FileText, Grid2X2, Image, List, MoreVertical, Play, Search, Upload, Video } from 'lucide-react'
import { useMemo, useState } from 'react'
import { mediaAssets } from '../data/adminMockData'
import { SafeImage } from '../components/SafeImage'
import { Button, MetricCard, PlaceholderDialog, StatusBadge } from '../components/ui'

type View = 'grid' | 'list'

const mediaIcon = { Image, Video, '3D': Box, CAD: FileText }

export function MediaLibraryPage() {
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState('All')
  const [project, setProject] = useState('All')
  const [room, setRoom] = useState('All')
  const [view, setView] = useState<View>('grid')
  const [selectedId, setSelectedId] = useState(1)
  const [dialog, setDialog] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return mediaAssets.filter((asset) =>
      (kind === 'All' || asset.kind === kind) &&
      (project === 'All' || asset.association === project) &&
      (room === 'All' || asset.room === room) &&
      (!normalized || `${asset.title} ${asset.association} ${asset.room}`.toLowerCase().includes(normalized)),
    )
  }, [kind, project, query, room])
  const selected = mediaAssets.find((asset) => asset.id === selectedId) ?? mediaAssets[0]

  return (
    <div className="page cms-page">
      <div className="breadcrumbs">CMS Master Index <span>/</span> Media Library</div>
      <div className="page-heading"><div><h1>Media Library</h1><p>Manage architectural photography, videos, 3D models and technical assets in one place. <span className="mock-label">Illustrative data</span></p></div><Button variant="primary" icon={<Upload size={16} />} onClick={() => setDialog('Upload New Media Assets')}>Upload Media</Button></div>

      <section className="metrics cms-metrics cms-metrics--three" aria-label="Media summary">
        <MetricCard label="Total Assets" value="342" note="Catalogued" icon={<Image size={17} />} />
        <MetricCard label="Images & Renders" value="248" note="High-Res" icon={<Image size={17} />} />
        <MetricCard label="Videos & 3D" value="94" note="Walkthroughs & BIM" icon={<Video size={17} />} />
      </section>

      <div className="cms-toolbar cms-toolbar--wrap">
        <label className="filter-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search assets by title..." aria-label="Search media" /></label>
        <label className="select-control"><select value={kind} onChange={(event) => setKind(event.target.value)} aria-label="Media type"><option value="All">All Media</option><option>Image</option><option>Video</option><option>3D</option><option>CAD</option></select></label>
        <label className="select-control"><select value={project} onChange={(event) => setProject(event.target.value)} aria-label="Media project"><option value="All">All Projects</option>{[...new Set(mediaAssets.map((asset) => asset.association))].map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className="select-control"><select value={room} onChange={(event) => setRoom(event.target.value)} aria-label="Media room"><option value="All">All Rooms</option>{[...new Set(mediaAssets.map((asset) => asset.room))].map((item) => <option key={item}>{item}</option>)}</select></label>
        <div className="view-toggle" aria-label="Media view"><button className={view === 'grid' ? 'active' : ''} onClick={() => setView('grid')} aria-label="Grid view"><Grid2X2 size={17} /></button><button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')} aria-label="List view"><List size={18} /></button></div>
      </div>

      <div className="split-workspace">
        <section className={`media-grid media-grid--${view}`} aria-label="Media assets">
          {filtered.map((asset) => {
            const Icon = mediaIcon[asset.kind]
            return <button key={asset.id} className={`media-card ${selected.id === asset.id ? 'selected' : ''}`} onClick={() => setSelectedId(asset.id)}>
              <div className="media-card__preview"><SafeImage src={asset.image} alt={asset.title} />{asset.kind === 'Video' && <span className="media-play"><Play size={18} /></span>}<span className="media-kind"><Icon size={12} />{asset.kind} • {asset.format}</span><MoreVertical className="media-more" size={16} /></div>
              <div><strong>{asset.title}</strong><span>{asset.association} • {asset.room}</span><small>{asset.uploaded}</small></div>
            </button>
          })}
          {!filtered.length && <div className="empty-state"><h2>No matching assets</h2><p>Try changing the search or media filters.</p></div>}
        </section>

        <aside className="detail-panel">
          <div className="detail-panel__head"><div><span className="eyebrow">{selected.kind} • {selected.format}</span><h2>{selected.title}</h2></div><StatusBadge status={selected.status} /></div>
          <SafeImage className="detail-panel__image" src={selected.image} alt={selected.title} />
          <div className="detail-block"><h3>File Information</h3><dl><div><dt>Format</dt><dd>{selected.format}</dd></div><div><dt>Dimensions</dt><dd>{selected.dimensions}</dd></div><div><dt>Uploaded</dt><dd>{selected.uploaded}</dd></div><div><dt>File Size</dt><dd>8.4 MB</dd></div></dl></div>
          <div className="detail-block"><h3>Associations</h3><p><strong>Linked Project</strong><span>{selected.association}</span></p><p><strong>Linked Room</strong><span>{selected.room}</span></p></div>
          <div className="detail-block"><h3>Tags &amp; Finishes</h3><div className="tag-list"><span>Fluted Aluminium</span><span>Charcoal Anodized</span><span>Cove LED</span></div></div>
          <div className="detail-actions"><Button onClick={() => setDialog('Copy Media Link')}>Copy Link</Button><Button onClick={() => setDialog('Replace Media File')}>Replace File</Button></div>
        </aside>
      </div>
      <div className="projects-pagination"><span>Showing {filtered.length} of 342 illustrative assets</span><nav aria-label="Media pages"><button disabled>‹</button><button className="active">1</button><button onClick={() => setDialog('Media page 2')}>2</button><button onClick={() => setDialog('Next media page')}>›</button></nav></div>
      {dialog && <PlaceholderDialog title={dialog} onClose={() => setDialog(null)} />}
    </div>
  )
}
