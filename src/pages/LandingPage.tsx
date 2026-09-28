import { ArrowDown, ArrowUp, ExternalLink, Eye, GripVertical, History, Image, Plus, Rocket, Save } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { landingSections } from '../data/adminMockData'
import { SafeImage } from '../components/SafeImage'
import { Button, PlaceholderDialog } from '../components/ui'

const featuredProjects = [
  { title: 'Jubilee Hills Residence', place: 'Hyderabad', description: 'Fluted Aluminium Living Pavilion', image: '/assets/project-03.jpg' },
  { title: 'The Altius Villa', place: 'Bengaluru', description: 'Master Suite Architectural Joinery', image: '/assets/project-01.jpg' },
  { title: 'Aura Penthouse', place: 'Mumbai', description: 'Modular Kitchen & Travertine Island', image: '/assets/project-05.jpg' },
  { title: 'Vasant Vihar Estate', place: 'New Delhi', description: 'Minimal Glazed Portal Partition', image: '/assets/project-04.jpg' },
]

export function LandingPage() {
  const [sections, setSections] = useState(landingSections)
  const [activeId, setActiveId] = useState(1)
  const [heading, setHeading] = useState('Crafting Architectural Permanence in Aluminium & Glass')
  const [description, setDescription] = useState("Engineered architectural facades, minimal slimline sliding systems, and bespoke interior metal joinery tailored for India's finest private residences.")
  const [dirty, setDirty] = useState(false)
  const [notice, setNotice] = useState('')
  const [dialog, setDialog] = useState<string | null>(null)

  const updateSection = (id: number, visible: boolean) => {
    setSections((current) => current.map((section) => section.id === id ? { ...section, visible } : section))
    setDirty(true)
    setNotice('')
  }
  const moveSection = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= sections.length) return
    setSections((current) => {
      const next = [...current]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
    setDirty(true)
    setNotice('')
  }
  const saveDraft = (event: FormEvent) => {
    event.preventDefault()
    setDirty(false)
    setNotice('Landing page draft saved for this preview session.')
  }

  return (
    <form className="page cms-page landing-page" onSubmit={saveDraft}>
      <div className="breadcrumbs">CMS Master Index <span>/</span> Landing Page</div>
      <div className="page-heading"><div><h1>Landing Page</h1><p>Manage homepage sections, featured projects, and website publishing. <span className="mock-label">{dirty ? 'Draft changes' : 'Local preview'}</span></p></div><div className="page-heading__actions"><Button type="submit" icon={<Save size={15} />} disabled={!dirty}>Save Draft</Button><Button type="button" icon={<ExternalLink size={15} />} onClick={() => setDialog('Preview Website')}>Preview Website</Button><Button type="button" variant="primary" icon={<Rocket size={15} />} onClick={() => setDialog('Publish Changes')}>Publish Changes</Button></div></div>
      {notice && <div className="settings-notice" role="status">{notice}</div>}

      <section className="publish-strip"><div><span className="status status--published"><i />Published / Live</span><strong>{dirty ? 'Draft Changes Pending' : 'No Pending Changes'}</strong></div><p>Last published: Today, 11:42 AM by Vikram Patel (Admin) • Domain: jpaluminium.com</p><div><button type="button" onClick={() => setDialog('Preview Live Website')}><Eye size={14} />Preview Live Website</button><button type="button" onClick={() => setDialog('Publishing History')}><History size={14} />Publishing History</button></div></section>

      <section className="cms-section landing-sections">
        <div className="cms-section__heading"><div><h2>Homepage Sections</h2><p>Manage the order, visibility, and content of homepage sections.</p></div><Button type="button" icon={<Plus size={15} />} onClick={() => setDialog('Add Homepage Section')}>Add Section</Button></div>
        <div className="section-list">
          {sections.map((section, index) => <article key={section.id} className={activeId === section.id ? 'active' : ''}>
            <GripVertical size={17} /><span className="section-order">{String(index + 1).padStart(2, '0')}</span><button type="button" className="section-copy" onClick={() => setActiveId(section.id)}><strong>{section.title}</strong><small>{section.description}</small></button><span className={`visibility-label ${section.visible ? 'visible' : ''}`}>{section.visible ? 'Visible' : 'Hidden'}</span><button type="button" onClick={() => setActiveId(section.id)}>Edit</button><button type="button" aria-label={`${section.visible ? 'Hide' : 'Show'} ${section.title}`} onClick={() => updateSection(section.id, !section.visible)}><Eye size={15} /></button><button type="button" aria-label={`Move ${section.title} up`} onClick={() => moveSection(index, -1)} disabled={index === 0}><ArrowUp size={14} /></button><button type="button" aria-label={`Move ${section.title} down`} onClick={() => moveSection(index, 1)} disabled={index === sections.length - 1}><ArrowDown size={14} /></button>
          </article>)}
        </div>
      </section>

      <section className="cms-section editor-section">
        <div className="cms-section__heading"><div><span className="eyebrow">Active Section Editor</span><h2>{String(activeId).padStart(2, '0')} — {sections.find((section) => section.id === activeId)?.title}</h2><p>Configure copy, action routes, and high-resolution media for this homepage section.</p></div><span className="mock-label">Draft changes</span></div>
        <div className="landing-editor">
          <div className="landing-form">
            <label className="field"><span>Main Heading (H1 Display)</span><textarea value={heading} onChange={(event) => { setHeading(event.target.value); setDirty(true) }} /></label>
            <label className="field"><span>Supporting Description</span><textarea value={description} onChange={(event) => { setDescription(event.target.value); setDirty(true) }} /></label>
            <div className="settings-fields landing-cta-fields"><label className="field"><span>Primary CTA Label</span><input defaultValue="Explore Portfolio" onChange={() => setDirty(true)} /></label><label className="field"><span>Destination URL</span><input defaultValue="/projects" onChange={() => setDirty(true)} /></label><label className="field"><span>Secondary CTA Label</span><input defaultValue="Schedule Consultation" onChange={() => setDirty(true)} /></label><label className="field"><span>Destination URL</span><input defaultValue="/contact" onChange={() => setDirty(true)} /></label></div>
            <div className="media-choice"><Image size={18} /><span><strong>Hero Media Backdrop</strong><small>IMG_2024_LIVING_HERO.webp • 3840×2160 • 4K HDR WebP</small></span><Button type="button" onClick={() => setDialog('Select Hero Media')}>Select from Library</Button></div>
          </div>
          <aside className="website-preview"><div className="website-preview__bar"><strong>JP ALUMINIUM</strong><span>Portfolio&nbsp;&nbsp; Facades&nbsp;&nbsp; Joinery&nbsp;&nbsp; Contact</span></div><SafeImage src="/assets/project-01.jpg" alt="Hero website preview" /><div className="website-preview__overlay"><small>ARCHITECTURAL FIT-OUTS • INDIA</small><h3>{heading}</h3><p>{description}</p><div><span>Explore Portfolio</span><span>Schedule Consultation</span></div></div><footer>1440 × 900 • Draft preview</footer></aside>
        </div>
      </section>

      <section className="cms-section featured-section"><div className="cms-section__heading"><div><h2>Curated Featured Projects</h2><p>Choose and arrange the projects displayed on the public homepage.</p></div><Button type="button" icon={<Plus size={15} />} onClick={() => setDialog('Select Projects from CMS')}>Select Projects from CMS</Button></div><div className="featured-grid">{featuredProjects.map((project, index) => <article key={project.title}><SafeImage src={project.image} alt={project.title} /><small>Order #{index + 1} • {project.place}</small><strong>{project.title}</strong><span>{project.description}</span></article>)}</div></section>

      <div className="landing-bottom-grid"><section className="cms-section"><div className="cms-section__heading"><div><h2>Homepage SEO &amp; Meta Information</h2><p>Search and social sharing metadata.</p></div></div><div className="settings-fields"><label className="field field--wide"><span>Meta Title</span><input defaultValue="JP Aluminium Interiors | Architectural Joinery" onChange={() => setDirty(true)} /></label><label className="field field--wide"><span>Meta Description</span><textarea defaultValue="Premier Indian architectural aluminium interior execution studio specializing in minimal profiles, custom joinery, and estate living spaces." onChange={() => setDirty(true)} /></label></div></section><section className="cms-section"><div className="cms-section__heading"><div><h2>Publishing History &amp; Audit Trail</h2><p>Recent live versions.</p></div></div><div className="history-list"><p><strong>v2.4 (Live)</strong><span>Updated materials showcase links • Today, 11:42 AM</span></p><p><strong>v2.3</strong><span>Added The Altius Villa showcase • Yesterday, 4:15 PM</span></p><p><strong>v2.2</strong><span>Consultation form update • 18 Feb, 9:30 AM</span></p></div></section></div>
      {dialog && <PlaceholderDialog title={dialog} onClose={() => setDialog(null)} />}
    </form>
  )
}
