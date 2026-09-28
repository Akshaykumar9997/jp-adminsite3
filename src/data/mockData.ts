export type PublicationStatus = 'Published' | 'Draft'

export type Project = {
  id: number
  title: string
  location: string
  spaces: number
  works: number
  status: PublicationStatus
  updated: string
  room: string
  image: string
}

// Illustrative Phase 1 data transcribed only from the two approved Stitch screens.
export const logoUrl = '/assets/jp-mark.png'

const projectImages = [
  '/assets/project-01.jpg',
  '/assets/project-05.jpg',
  '/assets/project-03.jpg',
  '/assets/project-04.jpg',
  '/assets/project-05.jpg',
]

export const projects: Project[] = [
  { id: 1, title: 'The Altius Villa — South Delhi Residence', location: 'South Extension II, New Delhi', spaces: 3, works: 8, status: 'Published', updated: 'Edited 2h ago', room: 'Living & Hall', image: projectImages[0] },
  { id: 2, title: 'Modern Minimalist Penthouse', location: 'Bandra West, Mumbai', spaces: 2, works: 5, status: 'Published', updated: 'Edited yesterday', room: 'Modular Kitchen & Pantry', image: projectImages[1] },
  { id: 3, title: 'Bespoke Media Console & Living Hall', location: 'Jubilee Hills, Hyderabad', spaces: 1, works: 4, status: 'Published', updated: 'Edited 3 days ago', room: 'Living & Hall', image: projectImages[2] },
  { id: 4, title: 'Cybercity Executive Boardroom', location: 'Gurgaon, Haryana', spaces: 2, works: 3, status: 'Draft', updated: 'Created Oct 22', room: 'Commercial Portal & Booths', image: projectImages[3] },
  { id: 5, title: 'Aura Minimalist Residence', location: 'Vasant Vihar, New Delhi', spaces: 4, works: 7, status: 'Published', updated: 'Edited Oct 18', room: 'Dining & Hall, Entryways', image: projectImages[4] },
]

export const recentUpdates = [
  { ...projects[0], scope: 'Private Residence • 6,200 sq.ft', updated: '2 hours ago' },
  { ...projects[1], scope: 'Luxury Highrise • Fluted Dark Profile', updated: 'Yesterday, 18:40' },
  { ...projects[2], scope: 'Private Residence • Bespoke Media Console', updated: '3 days ago' },
  { ...projects[3], scope: 'Corporate Interiors • Acoustic Glazing', updated: '3 days ago' },
  { ...projects[4], scope: 'Villa • Anodized Champagne Gold', updated: 'May 14, 2024' },
]
