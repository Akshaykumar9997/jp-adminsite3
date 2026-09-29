create schema showcase;

create type showcase.content_status as enum ('draft', 'published', 'archived');
create type showcase.media_kind as enum ('image', 'video', 'model_3d', 'cad', 'document');
create type showcase.material_range as enum ('cap', 'mid_cap', 'low_cap');
create type showcase.partner_status as enum ('active', 'pending_nda', 'inactive');

create table showcase.schema_migrations (
  version text primary key check (version ~ '^[0-9]+$'),
  name text not null,
  sha256 text not null,
  applied_at timestamptz not null default now(),
  applied_by text not null default current_user
);

create table showcase.media_assets (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null unique,
  title text not null,
  kind showcase.media_kind not null,
  mime_type text not null,
  original_filename text not null,
  byte_size bigint not null check (byte_size > 0),
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  duration_seconds numeric check (duration_seconds is null or duration_seconds >= 0),
  alt_text text,
  caption text,
  status showcase.content_status not null default 'draft',
  is_publicly_deliverable boolean not null default false,
  uploaded_by uuid,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  constraint media_assets_published_at_check check (status <> 'published' or published_at is not null)
);

create table showcase.projects (
  id uuid primary key default gen_random_uuid(), slug text not null unique,
  title text not null, summary text, description text, location text,
  project_type text, scope text, status showcase.content_status not null default 'draft',
  cover_asset_id uuid references showcase.media_assets(id) on delete set null,
  sort_order integer not null default 0, published_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid, updated_by uuid,
  constraint projects_published_at_check check (status <> 'published' or published_at is not null)
);

create table showcase.room_categories (
  id uuid primary key default gen_random_uuid(), slug text not null unique, name text not null unique,
  description text, zone_label text, status showcase.content_status not null default 'draft',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid, updated_by uuid
);

create table showcase.project_rooms (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references showcase.projects(id) on delete cascade,
  room_category_id uuid not null references showcase.room_categories(id) on delete restrict,
  title text, description text, sort_order integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid, updated_by uuid,
  unique (project_id, room_category_id), unique (id, project_id, room_category_id)
);

create table showcase.works (
  id uuid primary key default gen_random_uuid(), slug text unique, title text not null,
  summary text, specification text,
  project_id uuid references showcase.projects(id) on delete cascade,
  project_room_id uuid,
  room_category_id uuid not null references showcase.room_categories(id) on delete restrict,
  status showcase.content_status not null default 'draft',
  cover_asset_id uuid references showcase.media_assets(id) on delete set null,
  sort_order integer not null default 0, published_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid, updated_by uuid,
  constraint works_project_shape_check check (
    (project_id is null and project_room_id is null) or
    (project_id is not null and project_room_id is not null)
  ),
  constraint works_project_room_fkey foreign key (project_room_id, project_id, room_category_id)
    references showcase.project_rooms(id, project_id, room_category_id) on delete cascade,
  constraint works_published_at_check check (status <> 'published' or published_at is not null)
);

create table showcase.project_media (
  project_id uuid not null references showcase.projects(id) on delete cascade,
  media_asset_id uuid not null references showcase.media_assets(id) on delete restrict,
  role text not null default 'gallery', sort_order integer not null default 0,
  primary key (project_id, media_asset_id)
);
create table showcase.project_room_media (
  project_room_id uuid not null references showcase.project_rooms(id) on delete cascade,
  media_asset_id uuid not null references showcase.media_assets(id) on delete restrict,
  role text not null default 'gallery', sort_order integer not null default 0,
  primary key (project_room_id, media_asset_id)
);
create table showcase.work_media (
  work_id uuid not null references showcase.works(id) on delete cascade,
  media_asset_id uuid not null references showcase.media_assets(id) on delete restrict,
  role text not null default 'gallery', sort_order integer not null default 0,
  primary key (work_id, media_asset_id)
);

create table showcase.material_collections (
  id uuid primary key default gen_random_uuid(), slug text not null unique, name text not null,
  range showcase.material_range not null, description text,
  status showcase.content_status not null default 'draft', sort_order integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid, updated_by uuid
);
create table showcase.materials (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references showcase.material_collections(id) on delete restrict,
  code text not null unique, name text not null, category text not null, finish text,
  description text, technical_specifications jsonb not null default '{}'::jsonb,
  status showcase.content_status not null default 'draft',
  cover_asset_id uuid references showcase.media_assets(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid, updated_by uuid,
  constraint materials_published_at_check check (status <> 'published' or published_at is not null)
);
create table showcase.work_materials (
  work_id uuid not null references showcase.works(id) on delete cascade,
  material_id uuid not null references showcase.materials(id) on delete restrict,
  notes text, sort_order integer not null default 0, primary key (work_id, material_id)
);

create table showcase.partners (
  id uuid primary key default gen_random_uuid(), name text not null, studio text, role text,
  public_bio text, location text,
  relationship_status showcase.partner_status not null default 'active',
  status showcase.content_status not null default 'draft',
  logo_asset_id uuid references showcase.media_assets(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid, updated_by uuid,
  constraint partners_published_at_check check (status <> 'published' or published_at is not null)
);
create table showcase.partner_private_details (
  partner_id uuid primary key references showcase.partners(id) on delete cascade,
  email text, phone text, nda_status text, nda_expires_on date, internal_notes text,
  updated_at timestamptz not null default now(), updated_by uuid
);
create table showcase.partner_private_documents (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references showcase.partners(id) on delete cascade,
  media_asset_id uuid not null unique references showcase.media_assets(id) on delete restrict,
  document_kind text not null, title text not null, expires_on date, internal_notes text,
  created_at timestamptz not null default now(), created_by uuid
);
create table showcase.project_partners (
  project_id uuid not null references showcase.projects(id) on delete cascade,
  partner_id uuid not null references showcase.partners(id) on delete restrict,
  assignment_role text, description text, sort_order integer not null default 0,
  primary key (project_id, partner_id)
);

create table showcase.landing_page_versions (
  id uuid primary key default gen_random_uuid(), version_number bigint generated always as identity unique,
  status showcase.content_status not null default 'draft', meta_title text, meta_description text,
  published_at timestamptz, published_by uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid, updated_by uuid
);
create unique index landing_page_one_published_idx on showcase.landing_page_versions ((status)) where status = 'published';
create table showcase.landing_sections (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references showcase.landing_page_versions(id) on delete cascade,
  section_key text not null, title text, description text, content jsonb not null default '{}'::jsonb,
  media_asset_id uuid references showcase.media_assets(id) on delete set null,
  is_visible boolean not null default true, sort_order integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid, updated_by uuid, unique (version_id, section_key), unique (version_id, sort_order)
);
create table showcase.landing_featured_projects (
  version_id uuid not null references showcase.landing_page_versions(id) on delete cascade,
  project_id uuid not null references showcase.projects(id) on delete restrict,
  sort_order integer not null, display_title text, display_description text,
  primary key (version_id, project_id), unique (version_id, sort_order)
);

create table showcase.cms_settings (
  key text primary key, value jsonb not null, updated_at timestamptz not null default now(), updated_by uuid
);
create table showcase.audit_events (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(), actor_id uuid, action text not null,
  table_name text not null, record_id uuid, old_data jsonb, new_data jsonb
);

create index project_rooms_project_id_idx on showcase.project_rooms(project_id);
create index project_rooms_room_category_id_idx on showcase.project_rooms(room_category_id);
create index works_project_id_idx on showcase.works(project_id);
create index works_project_room_id_idx on showcase.works(project_room_id);
create index works_room_category_id_idx on showcase.works(room_category_id);
create index project_media_asset_id_idx on showcase.project_media(media_asset_id);
create index project_room_media_asset_id_idx on showcase.project_room_media(media_asset_id);
create index work_media_asset_id_idx on showcase.work_media(media_asset_id);
create index materials_collection_id_idx on showcase.materials(collection_id);
create index work_materials_material_id_idx on showcase.work_materials(material_id);
create index partner_private_documents_partner_id_idx on showcase.partner_private_documents(partner_id);
create index project_partners_partner_id_idx on showcase.project_partners(partner_id);
create index landing_sections_media_asset_id_idx on showcase.landing_sections(media_asset_id);
create index landing_featured_projects_project_id_idx on showcase.landing_featured_projects(project_id);
create index media_assets_public_idx on showcase.media_assets(id) where status = 'published' and is_publicly_deliverable;
create index audit_events_record_idx on showcase.audit_events(record_id, occurred_at desc);

do $block$
declare t text;
begin
  foreach t in array array[
    'schema_migrations','media_assets','projects','room_categories','project_rooms','works',
    'project_media','project_room_media','work_media','material_collections','materials','work_materials',
    'partners','partner_private_details','partner_private_documents','project_partners',
    'landing_page_versions','landing_sections','landing_featured_projects','cms_settings','audit_events'
  ] loop
    execute format('alter table showcase.%I enable row level security', t);
  end loop;
end
$block$;

revoke all on schema showcase from public, anon, authenticated;
revoke all on all tables in schema showcase from public, anon, authenticated;
revoke all on all sequences in schema showcase from public, anon, authenticated;
alter default privileges for role postgres in schema showcase revoke all on tables from public, anon, authenticated;
alter default privileges for role postgres in schema showcase revoke all on sequences from public, anon, authenticated;
alter default privileges for role postgres in schema showcase revoke execute on functions from public, anon, authenticated;
