create function showcase.write_audit_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare old_row jsonb; new_row jsonb; row_id uuid;
begin
  old_row := case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end;
  new_row := case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end;
  row_id := coalesce((new_row ->> 'id')::uuid, (old_row ->> 'id')::uuid);
  insert into showcase.audit_events(actor_id, action, table_name, record_id, old_data, new_data)
  values (auth.uid(), lower(tg_op), tg_table_name, row_id, old_row, new_row);
  return case when tg_op = 'DELETE' then old else new end;
end
$function$;
alter function showcase.write_audit_event() owner to postgres;
revoke all on function showcase.write_audit_event() from public, anon, authenticated, service_role;

do $block$
declare t text;
begin
  foreach t in array array[
    'projects','room_categories','project_rooms','works','media_assets','material_collections',
    'materials','partners','partner_private_details','partner_private_documents',
    'landing_page_versions','landing_sections','cms_settings'
  ] loop
    execute format('create trigger audit_%I after insert or update or delete on showcase.%I for each row execute function showcase.write_audit_event()', t, t);
  end loop;
end
$block$;
