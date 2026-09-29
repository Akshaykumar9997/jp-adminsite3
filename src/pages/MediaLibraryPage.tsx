import { Box, FileText, Grid2X2, Image, List, MoreVertical, Play, Search, Upload, Video } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { SafeImage } from '../components/SafeImage'
import { Button, MetricCard, StatusBadge } from '../components/ui'
import { AsyncForm, CmsDialog, ErrorState, LoadingState, StatusField } from '../components/CmsDialog'
import { useAsyncData } from '../hooks/useAsyncData'
import { classifyAndAssociateMedia, deleteMedia, getAdminMediaUrl, listMediaAssets, listProjectRooms, listProjects, listWorks, saveMediaMetadata, uploadMedia } from '../lib/showcase'
import type { ContentStatus, MediaAsset } from '../lib/database.types'

type View = 'grid' | 'list'
const mediaIcon = { image: Image, video: Video, model_3d: Box, cad: FileText, document: FileText }
const labelKind = (kind: MediaAsset['kind']) => kind === 'model_3d' ? '3D' : kind[0].toUpperCase() + kind.slice(1)
const value = (form: FormData, key: string) => String(form.get(key) ?? '').trim()

async function loadMedia() {
  const [assets, projects, works, projectRooms] = await Promise.all([listMediaAssets(), listProjects(), listWorks(), listProjectRooms()])
  return { assets, projects, works, projectRooms }
}

export function MediaLibraryPage() {
  const { data, error, loading, reload } = useAsyncData(loadMedia)
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState('All')
  const [status, setStatus] = useState('All')
  const [view, setView] = useState<View>('grid')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string>('/assets/project-01.jpg')
  const [dialog, setDialog] = useState<'upload' | 'edit' | null>(null)
  const assets = data?.assets ?? []
  const selected = assets.find((asset) => asset.id === selectedId) ?? assets[0]

  useEffect(() => {
    let active = true
    if (!selected) return
    void getAdminMediaUrl(selected).then((url) => { if (active) setPreviewUrl(url) }).catch(() => { if (active) setPreviewUrl('/assets/project-01.jpg') })
    return () => { active = false }
  }, [selected])

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return assets.filter((asset) => (kind === 'All' || asset.kind === kind) && (status === 'All' || asset.status === status) && (!normalized || `${asset.title} ${asset.original_filename} ${asset.caption ?? ''}`.toLowerCase().includes(normalized)))
  }, [assets, kind, query, status])
  const close = () => { setDialog(null); void reload() }

  return (
    <div className="page cms-page">
      <div className="breadcrumbs">CMS Master Index <span>/</span> Media Library</div>
      <div className="page-heading"><div><h1>Media Library</h1><p>Manage private showcase photography, videos, 3D models, CAD files, and documents.</p></div><Button variant="primary" icon={<Upload size={16} />} onClick={() => setDialog('upload')}>Upload Media</Button></div>
      <section className="metrics cms-metrics cms-metrics--three" aria-label="Media summary"><MetricCard label="Total Assets" value={String(assets.length)} note="Catalogued" icon={<Image size={17} />} /><MetricCard label="Images & Renders" value={String(assets.filter((item) => item.kind === 'image').length)} note="Private bucket" icon={<Image size={17} />} /><MetricCard label="Videos & 3D" value={String(assets.filter((item) => item.kind === 'video' || item.kind === 'model_3d').length)} note="Rich media" icon={<Video size={17} />} /></section>

      <div className="cms-toolbar cms-toolbar--wrap"><label className="filter-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search assets by title..." aria-label="Search media" /></label><label className="select-control"><select value={kind} onChange={(event) => setKind(event.target.value)} aria-label="Media type"><option value="All">All Media</option><option value="image">Image</option><option value="video">Video</option><option value="model_3d">3D</option><option value="cad">CAD</option><option value="document">Document</option></select></label><label className="select-control"><select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Publication status"><option value="All">All statuses</option><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select></label><div className="view-toggle" aria-label="Media view"><button className={view === 'grid' ? 'active' : ''} onClick={() => setView('grid')} aria-label="Grid view"><Grid2X2 size={17} /></button><button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')} aria-label="List view"><List size={18} /></button></div></div>

      {loading ? <LoadingState /> : error ? <ErrorState message={error} retry={() => void reload()} /> : !selected ? <div className="empty-state"><h2>No media assets yet</h2><p>Upload the first file to the private showcase bucket.</p></div> : <div className="split-workspace">
        <section className={`media-grid media-grid--${view}`} aria-label="Media assets">{filtered.map((asset) => { const Icon = mediaIcon[asset.kind]; return <button key={asset.id} className={`media-card ${selected.id === asset.id ? 'selected' : ''}`} onClick={() => setSelectedId(asset.id)}><div className="media-card__preview"><SafeImage src={asset.id === selected.id ? previewUrl : '/assets/project-01.jpg'} alt={asset.alt_text ?? asset.title} />{asset.kind === 'video' && <span className="media-play"><Play size={18} /></span>}<span className="media-kind"><Icon size={12} />{labelKind(asset.kind)}</span><MoreVertical className="media-more" size={16} /></div><div><strong>{asset.title}</strong><span>{asset.original_filename}</span><small>{new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(asset.updated_at))}</small></div></button> })}</section>
        <aside className="detail-panel"><div className="detail-panel__head"><div><span className="eyebrow">{labelKind(selected.kind)} • {selected.mime_type}</span><h2>{selected.title}</h2></div><StatusBadge status={selected.status} /></div><SafeImage className="detail-panel__image" src={previewUrl} alt={selected.alt_text ?? selected.title} /><div className="detail-block"><h3>File Information</h3><dl><div><dt>Filename</dt><dd>{selected.original_filename}</dd></div><div><dt>Dimensions</dt><dd>{selected.width && selected.height ? `${selected.width} × ${selected.height}` : 'Not recorded'}</dd></div><div><dt>File Size</dt><dd>{(selected.byte_size / 1024 / 1024).toFixed(2)} MB</dd></div><div><dt>Public delivery</dt><dd>{selected.is_publicly_deliverable ? 'Eligible when associated' : 'Disabled'}</dd></div></dl></div><div className="detail-block"><h3>Storage classification</h3><p><span>{selected.storage_path}</span></p></div><div className="detail-actions"><Button onClick={() => navigator.clipboard.writeText(selected.id)}>Copy Asset ID</Button><Button variant="primary" onClick={() => setDialog('edit')}>Edit Metadata</Button></div></aside>
      </div>}

      {dialog === 'upload' && <CmsDialog title="Upload Media Asset" onClose={() => setDialog(null)}><AsyncForm submitLabel="Upload asset" onClose={close} onSubmit={async (form) => { const file = form.get('file'); if (!(file instanceof File) || !file.size) throw new Error('Choose a file to upload.'); const asset = await uploadMedia(file, { title: value(form, 'title') || file.name, alt_text: value(form, 'alt_text') || null, caption: value(form, 'caption') || null, status: value(form, 'status') as ContentStatus, is_publicly_deliverable: form.get('deliverable') === 'on' }); const association = value(form, 'association'); if (association) { const [table, ownerId] = association.split(':') as ['project_media' | 'project_room_media' | 'work_media', string]; await classifyAndAssociateMedia(asset, table, ownerId) } }}><div className="cms-dialog__grid"><label className="field field--wide"><span>File</span><input name="file" type="file" required /></label><label className="field"><span>Title</span><input name="title" placeholder="Defaults to filename" /></label><StatusField /><label className="field field--wide"><span>Association</span><select name="association"><option value="">Unassigned (never publicly deliverable)</option>{data?.projects.map((item) => <option key={item.id} value={`project_media:${item.id}`}>Project — {item.title}</option>)}{data?.works.map((item) => <option key={item.id} value={`work_media:${item.id}`}>Work — {item.title}</option>)}</select></label><label className="field field--wide"><span>Alternative text</span><input name="alt_text" /></label><label className="field field--wide"><span>Caption</span><textarea name="caption" /></label><label className="field field--wide checkbox-field"><input name="deliverable" type="checkbox" /><span>Eligible for public delivery after publication and valid association</span></label></div></AsyncForm></CmsDialog>}
      {dialog === 'edit' && selected && <CmsDialog title={`Edit ${selected.title}`} onClose={() => setDialog(null)}><AsyncForm onClose={close} danger={{ label: 'Delete asset', action: () => deleteMedia(selected) }} onSubmit={async (form) => { await saveMediaMetadata({ title: value(form, 'title'), alt_text: value(form, 'alt_text') || null, caption: value(form, 'caption') || null, status: value(form, 'status') as ContentStatus, is_publicly_deliverable: form.get('deliverable') === 'on' }, selected) }}><div className="cms-dialog__grid"><label className="field"><span>Title</span><input name="title" required defaultValue={selected.title} /></label><StatusField value={selected.status} /><label className="field field--wide"><span>Alternative text</span><input name="alt_text" defaultValue={selected.alt_text ?? ''} /></label><label className="field field--wide"><span>Caption</span><textarea name="caption" defaultValue={selected.caption ?? ''} /></label><label className="field field--wide checkbox-field"><input name="deliverable" type="checkbox" defaultChecked={selected.is_publicly_deliverable} /><span>Eligible for public delivery after database authorization</span></label></div></AsyncForm></CmsDialog>}
    </div>
  )
}
