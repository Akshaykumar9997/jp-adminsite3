create table crm.customer_support (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  phone text not null check (phone ~ '^[+0-9 ()-]{8,20}$' and char_length(regexp_replace(phone, '[^0-9]', '', 'g')) between 8 and 15),
  city text not null check (city in ('Dubai','Abu Dhabi','Sharjah','Ajman','Ras Al Khaimah','Fujairah','Umm Al Quwain','Outside UAE')),
  email text check (email is null or char_length(email) between 3 and 254),
  reference text check (reference is null or char_length(reference) <= 100),
  reason text not null check (reason in ('Project update','Warranty question','Billing question','Feedback','Other')),
  preferred_contact text not null check (preferred_contact in ('Phone call','Email')),
  message text not null check (char_length(btrim(message)) between 10 and 2000),
  consent boolean not null check (consent),
  constraint email_contact_requires_email check (preferred_contact <> 'Email' or email is not null)
);
create index customer_support_created_at_idx on crm.customer_support (created_at desc, id);
alter table crm.customer_support enable row level security;
revoke all on crm.customer_support from public, anon, authenticated, service_role;
grant select on crm.customer_support to authenticated;
grant insert, select on crm.customer_support to service_role;
create policy "Active admins can read customer support"
  on crm.customer_support for select to authenticated
  using ((select public.is_admin()));
