import type { PublicationStatus } from './mockData'

export type RoomWork = {
  id: number
  title: string
  association: string
  type: 'Project Linked' | 'Standalone Work'
  status: PublicationStatus
  specification: string
  assets: string
  image: string
}

export const roomWorks: RoomWork[] = [
  { id: 1, title: 'Fluted Aluminium Pivot Door (3200mm)', association: 'The Altius Villa — South Delhi', type: 'Project Linked', status: 'Published', specification: 'Bronze Anodized • Fluted Oak Core • Concealed Pivot', assets: '6 Assets', image: '/assets/project-01.jpg' },
  { id: 2, title: 'Bespoke Media Console & Living Wall', association: 'Jubilee Hills Private Residence', type: 'Project Linked', status: 'Published', specification: 'Charcoal Anodized • Calacatta Marble Base • Integrated Cove LED', assets: '11 Assets', image: '/assets/project-03.jpg' },
  { id: 3, title: 'Concealed Track Sliding Glass Portal', association: 'Standalone showcase', type: 'Standalone Work', status: 'Published', specification: 'Natural Matte Silver • Flush Threshold • Acoustic Double Glaze', assets: '4K Walkthrough', image: '/assets/project-04.jpg' },
  { id: 4, title: 'Champagne Anodized Wall Panelling', association: 'Aura Minimalist Residence', type: 'Project Linked', status: 'Published', specification: 'Champagne Brushed • Extruded Shadow Gap', assets: '8 Assets', image: '/assets/project-05.jpg' },
  { id: 5, title: 'Double-Height Acoustic Slatted Divider', association: 'Standalone showcase', type: 'Standalone Work', status: 'Draft', specification: 'Smoked European Oak • Matt Black Rails • Acoustic Felt Core', assets: 'CAD Drawings (3)', image: '/assets/project-05.jpg' },
]

export type MediaAsset = {
  id: number
  title: string
  kind: 'Image' | 'Video' | '3D' | 'CAD'
  format: string
  dimensions: string
  association: string
  room: string
  uploaded: string
  image: string
  status: PublicationStatus
}

export const mediaAssets: MediaAsset[] = [
  { id: 1, title: 'Fluted Aluminium TV Console & Living Wall', kind: 'Image', format: 'JPG', dimensions: '3840 × 2160', association: 'Jubilee Hills Residence', room: 'Living & Hall', uploaded: '2 hours ago', image: '/assets/project-03.jpg', status: 'Published' },
  { id: 2, title: 'Concealed Track Sliding Glass Partition', kind: 'Video', format: 'MP4', dimensions: '01:45', association: 'Standalone Showcase', room: 'Living & Hall', uploaded: 'Yesterday', image: '/assets/project-01.jpg', status: 'Published' },
  { id: 3, title: 'Double-Height Pavilion 3D Model', kind: '3D', format: 'GLB', dimensions: '360° View', association: 'The Altius Villa', room: 'Living & Hall', uploaded: '3 days ago', image: '/assets/project-04.jpg', status: 'Published' },
  { id: 4, title: 'Joinery Elevation & Extrusion CAD', kind: 'CAD', format: 'DWG', dimensions: '1:50 Rev 4', association: 'The Altius Villa', room: 'Master Suite', uploaded: 'Oct 14', image: '/assets/project-01.jpg', status: 'Draft' },
  { id: 5, title: 'Monolithic Dining Pavilion & Facade', kind: 'Image', format: 'WEBP', dimensions: '4000 × 2666', association: 'Aura Residence', room: 'Dining Room', uploaded: 'Oct 12', image: '/assets/project-05.jpg', status: 'Published' },
  { id: 6, title: 'Brushed Aluminium Island Counter', kind: 'Image', format: 'PNG', dimensions: '3840 × 2400', association: 'Standalone', room: 'Modular Kitchen', uploaded: 'Oct 10', image: '/assets/project-03.jpg', status: 'Published' },
]

export type Material = {
  id: number
  code: string
  name: string
  category: string
  finish: string
  range: 'Cap Range' | 'Mid Cap' | 'Low Cap'
  status: PublicationStatus
  description: string
  works: number
  association: string
  image: string
}

export const materials: Material[] = [
  { id: 1, code: 'JP-MAT-AL01', name: 'Dark Bronze Anodized Extrusion', category: 'Aluminium Extrusion', finish: 'Satin Anodized', range: 'Cap Range', status: 'Published', description: 'Bespoke hairline micro-brushed texture with subtle satin bronze sheen. Grade 6063-T6.', works: 14, association: 'Jubilee Hills, Altius', image: '/assets/project-01.jpg' },
  { id: 2, code: 'JP-MAT-CP04', name: 'Fluted Charcoal Composite Panel', category: 'Wall Panel', finish: 'Vertical Fluted', range: 'Cap Range', status: 'Published', description: 'Slim architectural vertical ribs with a matte charcoal acoustic treatment.', works: 9, association: 'Master Suites', image: '/assets/project-03.jpg' },
  { id: 3, code: 'JP-MAT-WD02', name: 'Natural American Walnut Slat', category: 'Timber Veneer', finish: 'Micro-Brushed', range: 'Cap Range', status: 'Published', description: 'Warm satin finish with an open-pore natural wood grain for luxury partition accents.', works: 11, association: 'Dining & Hall', image: '/assets/project-05.jpg' },
  { id: 4, code: 'JP-MAT-ST03', name: 'Honed Warm Sand Limestone', category: 'Natural Stone', finish: 'Honed Matte', range: 'Cap Range', status: 'Published', description: 'Subtle mineral texture and monolithic cladding finish with an anti-stain seal.', works: 6, association: 'Villa Facades', image: '/assets/project-04.jpg' },
  { id: 5, code: 'JP-MAT-AL03', name: 'Champagne Brushed Anodized', category: 'Architectural Metal', finish: 'Satin Anodized', range: 'Mid Cap', status: 'Published', description: 'Soft metallic champagne tone with a fine linear brushed grain.', works: 8, association: 'Modular Kitchens', image: '/assets/project-03.jpg' },
  { id: 6, code: 'JP-MAT-AL09', name: 'Natural Matte Silver Anodized', category: 'Core System Profile', finish: 'Honed Matte', range: 'Low Cap', status: 'Published', description: 'Precision architectural-grade profile for minimalist sliding systems.', works: 18, association: 'Sliding Systems', image: '/assets/project-01.jpg' },
]

export type Collaborator = {
  id: number
  initials: string
  name: string
  studio: string
  role: string
  projects: string
  email: string
  phone: string
  status: 'Active' | 'Pending NDA' | 'Inactive'
  updated: string
}

export const collaborators: Collaborator[] = [
  { id: 1, initials: 'SR', name: 'Sonali Rastogi', studio: 'Morphogenesis', role: 'Lead Architect', projects: 'Jubilee Hills Residence • The Altius Villa', email: 'sonali.rastogi@morphogenesis.org', phone: '+91 98110 42819', status: 'Active', updated: '2 hrs ago' },
  { id: 2, initials: 'AA', name: 'Ambrish Arora', studio: 'Studio Lotus', role: 'Interior Designer', projects: 'Aura Penthouse • Lakeview', email: 'ambrish@studiolotus.in', phone: '+91 98200 54190', status: 'Active', updated: 'Yesterday' },
  { id: 3, initials: 'SI', name: 'Schüco India Systems Private Ltd', studio: 'Systems Partner', role: 'Aluminium Supplier', projects: 'The Altius Villa • +3 more', email: 'systems@schueco.in', phone: '+91 22 6123 9900', status: 'Active', updated: 'Oct 24, 2024' },
  { id: 4, initials: 'VD', name: 'Void Design Studio', studio: 'Acoustics & Lighting', role: 'Acoustic Specialist', projects: 'Jubilee Hills Residence', email: 'info@voidstudio.co', phone: '+91 80 4112 0034', status: 'Pending NDA', updated: 'Oct 21, 2024' },
  { id: 5, initials: 'AW', name: 'Alusteel Works', studio: 'Facade & Fabrication', role: 'Façade Contractor', projects: 'Jubilee Hills Residence', email: 'projects@alusteel.com', phone: '+91 40 2341 5567', status: 'Active', updated: 'Oct 19, 2024' },
  { id: 6, initials: 'KN', name: 'KNS Architects', studio: 'Mumbai Studio', role: 'Lead Architect', projects: 'Marine Drive (Completed)', email: 'contact@knsarchitects.com', phone: '+91 22 2490 8812', status: 'Inactive', updated: 'Sep 02, 2024' },
]

export type LandingSection = {
  id: number
  title: string
  description: string
  visible: boolean
}

export const landingSections: LandingSection[] = [
  { id: 1, title: 'Hero Section & Value Proposition', description: 'Dynamic headline, dual CTAs, architectural photography hero', visible: true },
  { id: 2, title: 'Curated Featured Projects', description: 'Dynamic portfolio carousel with four active showcase estates', visible: true },
  { id: 3, title: 'About JP Aluminium & Heritage Craftsmanship', description: 'Legacy, precision engineering narrative and statistics', visible: true },
  { id: 4, title: 'Services & Architectural Joinery', description: 'Glazed portals, partitions, and bespoke extrusions', visible: true },
  { id: 5, title: 'Materials & Finishes Showcase', description: 'Dynamic swatch library linked to technical specifications', visible: true },
  { id: 6, title: 'Contact & Executive Consultation', description: 'Architectural inquiry intake and showroom appointment booking', visible: true },
]
