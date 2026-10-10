create table crm.visitor_activity (
  id uuid primary key,
  created_at timestamptz not null default clock_timestamp(),
  phone text not null check (phone ~ '^[0-9]{8,15}$'),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  district text not null check (char_length(btrim(district)) between 2 and 80),
  attempt integer not null check (attempt > 0),
  unique (phone, attempt)
);
create index visitor_activity_created_at_idx on crm.visitor_activity (created_at desc, id desc);
alter table crm.visitor_activity enable row level security;
revoke all on crm.visitor_activity from public, anon, authenticated, service_role;
grant select on crm.visitor_activity to authenticated;
grant select, insert on crm.visitor_activity to service_role;
create policy "Active admins can read visitor activity"
  on crm.visitor_activity for select to authenticated
  using ((select public.is_admin()));

create function crm.number_visitor_attempt() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  new.phone := regexp_replace(new.phone, '[^0-9]', '', 'g');
  new.phone := regexp_replace(new.phone, '^00', '');
  if new.phone ~ '^91[6-9][0-9]{9}$' then new.phone := substr(new.phone, 3); end if;
  -- Serialize entries for the same phone so simultaneous visits cannot share an attempt.
  perform pg_advisory_xact_lock(hashtextextended(new.phone, 0));
  select coalesce(max(attempt), 0) + 1 into new.attempt
    from crm.visitor_activity where phone = new.phone;
  new.created_at := clock_timestamp();
  return new;
end;
$$;
revoke all on function crm.number_visitor_attempt() from public, anon, authenticated;
grant execute on function crm.number_visitor_attempt() to service_role;
create trigger number_visitor_attempt before insert on crm.visitor_activity
  for each row execute function crm.number_visitor_attempt();
