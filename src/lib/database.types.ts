export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type ContentStatus = 'published' | 'archived'
export type MediaKind = 'image' | 'video' | 'model_3d' | 'cad' | 'document'
export type MaterialRange = 'cap' | 'mid_cap' | 'low_cap'
export type PartnerStatus = 'active' | 'pending_nda' | 'inactive'

type Table<Row, Insert = Partial<Row>, Update = Partial<Insert>> = {
  Row: Row
  Insert: Insert
  Update: Update
  Relationships: []
}

type Timestamps = {
  deleted_at?: string | null
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
}

export type MediaAsset = Timestamps & {
  processing_status: 'processing' | 'ready' | 'failed'
  poster_asset_id: string | null
  id: string
  storage_path: string
  title: string
  kind: MediaKind
  mime_type: string
  original_filename: string
  byte_size: number
  width: number | null
  height: number | null
  duration_seconds: number | null
  alt_text: string | null
  caption: string | null
  status: ContentStatus
  is_publicly_deliverable: boolean
  uploaded_by: string | null
  published_at: string | null
}

export type Project = Timestamps & {
  id: string
  slug: string
  title: string
  summary: string | null
  description: string | null
  location: string | null
  project_type: string | null
  scope: string | null
  status: ContentStatus
  cover_asset_id: string | null
  sort_order: number
  published_at: string | null
}

export type RoomCategory = Timestamps & {
  cover_asset_id: string | null
  is_custom: boolean
  id: string
  slug: string
  name: string
  description: string | null
  zone_label: string | null
  status: ContentStatus
  sort_order: number
}

export type ProjectRoom = Timestamps & {
  id: string
  project_id: string
  room_category_id: string
  title: string | null
  description: string | null
  sort_order: number
}

export type Work = Timestamps & {
  location: string | null
  id: string
  slug: string | null
  title: string
  summary: string | null
  specification: string | null
  project_id: string | null
  project_room_id: string | null
  room_category_id: string
  status: ContentStatus
  cover_asset_id: string | null
  sort_order: number
  published_at: string | null
}

export type MaterialCollection = Timestamps & {
  id: string
  slug: string
  name: string
  range: MaterialRange
  description: string | null
  status: ContentStatus
  sort_order: number
}

export type Material = Timestamps & {
  tier: 'low' | 'mid' | 'top'
  id: string
  collection_id: string
  code: string
  name: string
  category: string
  finish: string | null
  description: string | null
  technical_specifications: Json
  status: ContentStatus
  cover_asset_id: string | null
  published_at: string | null
}

export type Partner = Timestamps & {
  id: string
  name: string
  studio: string | null
  role: string | null
  public_bio: string | null
  location: string | null
  relationship_status: PartnerStatus
  status: ContentStatus
  logo_asset_id: string | null
  published_at: string | null
}

export type PartnerPrivateDetails = {
  partner_id: string
  email: string | null
  phone: string | null
  nda_status: string | null
  nda_expires_on: string | null
  internal_notes: string | null
  updated_at: string
  updated_by: string | null
}

export type LandingPageVersion = Timestamps & {
  id: string
  version_number: number
  status: ContentStatus
  meta_title: string | null
  meta_description: string | null
  published_at: string | null
  published_by: string | null
}

export type LandingSection = Timestamps & {
  id: string
  version_id: string
  section_key: string
  title: string | null
  description: string | null
  content: Json
  media_asset_id: string | null
  is_visible: boolean
  sort_order: number
}

export type LandingFeaturedProject = {
  version_id: string
  project_id: string
  sort_order: number
  display_title: string | null
  display_description: string | null
}

export type CmsSetting = {
  key: string
  value: Json
  updated_at: string
  updated_by: string | null
}

export type AuditEvent = {
  id: number
  occurred_at: string
  actor_id: string | null
  action: string
  table_name: string
  record_id: string | null
  old_data: Json | null
  new_data: Json | null
}

type ProjectMedia = {
  project_id: string
  media_asset_id: string
  role: string
  sort_order: number
}
type ProjectRoomMedia = {
  project_room_id: string
  media_asset_id: string
  role: string
  sort_order: number
}
type WorkMedia = {
  work_id: string
  media_asset_id: string
  role: string
  sort_order: number
}
type WorkMaterial = {
  work_id: string
  material_id: string
  notes: string | null
  sort_order: number
}
export type PartnerPrivateDocument = {
  id: string
  partner_id: string
  media_asset_id: string
  document_kind: string
  title: string
  expires_on: string | null
  internal_notes: string | null
  created_at: string
  created_by: string | null
}
type ProjectPartner = {
  project_id: string
  partner_id: string
  assignment_role: string | null
  description: string | null
  sort_order: number
}
type SchemaMigration = {
  version: string
  name: string
  sha256: string
  applied_at: string
  applied_by: string
}

export type Database = {
  public: {
    Tables: Record<string, never>
    Views: Record<string, never>
    Functions: {
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
  showcase: {
    Tables: {
      media_items: Table<{
        owner_kind: string
        owner_id: string
        media_asset_id: string
        sort_order: number
      }>
      media_assets: Table<MediaAsset>
      projects: Table<Project>
      room_categories: Table<RoomCategory>
      project_rooms: Table<ProjectRoom>
      works: Table<Work>
      project_media: Table<ProjectMedia>
      project_room_media: Table<ProjectRoomMedia>
      work_media: Table<WorkMedia>
      material_collections: Table<MaterialCollection>
      materials: Table<Material>
      work_materials: Table<WorkMaterial>
      partners: Table<Partner>
      partner_private_details: Table<PartnerPrivateDetails>
      partner_private_documents: Table<PartnerPrivateDocument>
      project_partners: Table<ProjectPartner>
      landing_page_versions: Table<LandingPageVersion>
      landing_sections: Table<LandingSection>
      landing_featured_projects: Table<LandingFeaturedProject>
      cms_settings: Table<CmsSetting>
      audit_events: Table<AuditEvent>
      schema_migrations: Table<SchemaMigration>
    }
    Views: Record<string, never>
    Functions: {
      publish_homepage: { Args: { p_version_id: string }; Returns: undefined }
      save_content: {
        Args: {
          p_kind: string
          p_id: string | null
          p_data: Json
          p_assets: Json
          p_cover: string | null
        }
        Returns: string
      }
      reorder_media: {
        Args: { p_kind: string; p_owner: string; p_assets: Json }
        Returns: undefined
      }
      reorder_works: {
        Args: { p_room: string; p_ids: string[] }
        Returns: undefined
      }
      reorder_rooms: { Args: { p_ids: string[] }; Returns: undefined }
      is_media_public: { Args: { p_asset_id: string }; Returns: boolean }
      ensure_landing_draft: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      save_landing_draft: {
        Args: {
          p_version_id: string
          p_meta_title: string | null
          p_meta_description: string | null
          p_sections: Json
          p_featured: Json
        }
        Returns: undefined
      }
      publish_landing_version: {
        Args: { p_version_id: string }
        Returns: undefined
      }
    }
    Enums: {
      content_status: ContentStatus
      media_kind: MediaKind
      material_range: MaterialRange
      partner_status: PartnerStatus
    }
    CompositeTypes: Record<string, never>
  }
}
