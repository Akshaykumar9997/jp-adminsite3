import { Building2, Edit3, MapPin, MoreVertical } from 'lucide-react'
import { SafeImage } from './SafeImage'
import { StatusBadge } from './ui'

type ProjectCardData = {
  id: string
  title: string
  location: string
  spaces: number
  works: number
  status: 'draft' | 'published' | 'archived'
  updated: string
  image: string
}

export function ProjectCard({ project, onEdit }: { project: ProjectCardData; onEdit: (id: string) => void }) {
  return (
    <article className="project-card">
      <div className="project-card__media">
        <SafeImage src={project.image} alt="" loading="lazy" />
        <StatusBadge status={project.status} />
        <button className="project-card__more" aria-label={`More options for ${project.title}`} onClick={() => onEdit(project.id)}><MoreVertical size={17} /></button>
      </div>
      <div className="project-card__body">
        <span className="project-card__location"><MapPin size={13} />{project.location}</span>
        <h3>{project.title}</h3>
        <span className="project-card__meta"><Building2 size={14} />{project.spaces} {project.spaces === 1 ? 'Space' : 'Spaces'} • {project.works} Works</span>
        <div className="project-card__footer"><small>{project.updated}</small><button onClick={() => onEdit(project.id)}><Edit3 size={13} />Edit</button></div>
      </div>
    </article>
  )
}
