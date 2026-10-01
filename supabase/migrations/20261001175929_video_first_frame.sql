-- Retain the nullable column for existing media/edge contracts; manual poster
-- selection is retired. Active videos always use their own decoded first frame.
create function showcase.video_first_frame() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if new.kind='video' and new.deleted_at is null then new.poster_asset_id := null; end if;
 return new;
end $$;
revoke all on function showcase.video_first_frame() from public,anon,authenticated;
create trigger video_first_frame before insert or update on showcase.media_assets
for each row execute function showcase.video_first_frame();
update showcase.media_assets set poster_asset_id=null where kind='video' and deleted_at is null and poster_asset_id is not null;
revoke all on function showcase.set_video_poster(uuid,uuid) from public,anon,authenticated;
