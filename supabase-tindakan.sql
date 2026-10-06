-- Jalankan SEKALI di Supabase → SQL Editor. Ganti GANTI_PIN_ADMIN dengan PIN admin kamu.
-- Menambah kolom tindakan lanjut + memusatkan PIN di satu tempat (tabel admin_config).
alter table rejects add column if not exists tindakan text;
alter table rejects add column if not exists tindakan_at timestamptz;

create table if not exists admin_config (key text primary key, value text not null);
alter table admin_config enable row level security;   -- tanpa policy = tidak bisa dibaca dari browser
insert into admin_config (key, value) values ('admin_pin', 'GANTI_PIN_ADMIN')
  on conflict (key) do update set value = excluded.value;

create or replace function check_pin(p_pin text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_pin is distinct from (select value from admin_config where key = 'admin_pin') then
    raise exception 'PIN salah';
  end if;
end $$;

create or replace function delete_reject(p_id bigint, p_pin text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform check_pin(p_pin);
  delete from rejects where id = p_id;
end $$;

create or replace function set_tindakan(p_id bigint, p_tindakan text, p_pin text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform check_pin(p_pin);
  update rejects
     set tindakan = nullif(trim(p_tindakan), ''),
         tindakan_at = case when nullif(trim(p_tindakan), '') is null then null else now() end
   where id = p_id;
end $$;

revoke all on function check_pin(text) from public, anon, authenticated;
revoke all on function delete_reject(bigint, text) from public;
revoke all on function set_tindakan(bigint, text, text) from public;
grant execute on function delete_reject(bigint, text) to anon, authenticated;
grant execute on function set_tindakan(bigint, text, text) to anon, authenticated;

notify pgrst, 'reload schema';
-- Ganti PIN nanti:  update admin_config set value = 'PIN_BARU' where key = 'admin_pin';
