-- Jalankan sekali di Supabase → SQL Editor.
-- Setiap baris rejects dihapus (dari aplikasi, Table Editor, atau SQL), foto Drive-nya otomatis masuk Trash.
create extension if not exists pg_net with schema extensions;

create or replace function trash_reject_photos()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if coalesce(array_length(old.photos, 1), 0) > 0 then
    perform net.http_post(
      url := 'https://script.google.com/macros/s/AKfycbwVJaDpX6W0TsIH_VKJV3Aiea0MNPvIWzXUjR0PHBu58llkgpN_Rp_ApNHo5xpyjox42g/exec',
      headers := '{"Content-Type":"application/json"}'::jsonb,
      body := jsonb_build_object('key', 'rj-8f3k29xq', 'action', 'delete', 'ids', to_jsonb(old.photos))
    );
  end if;
  return old;
end;
$$;

drop trigger if exists rejects_photos_cleanup on rejects;
create trigger rejects_photos_cleanup
after delete on rejects
for each row execute function trash_reject_photos();
