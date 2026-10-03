-- Supabase → SQL Editor (hapus tabel lama dulu jika sudah ada: drop table rejects;)
create table rejects (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),   -- tanggal & jam otomatis
  warehouse text not null,
  item_code text not null,
  item_name text not null,
  qty int not null check (qty > 0),
  keterangan text,
  photos text[] not null default '{}'              -- array ID file Google Drive
);
create index on rejects (created_at desc);
create index on rejects (item_code);

alter table rejects enable row level security;
create policy "read"   on rejects for select using (true);
create policy "insert" on rejects for insert with check (true);
-- Jalankan di Supabase → SQL Editor. GANTI 'GANTI_PIN_ADMIN' dengan PIN kamu (min 8 karakter).
create or replace function delete_reject(p_id bigint, p_pin text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_pin is distinct from 'GANTI_PIN_ADMIN' then
    raise exception 'PIN salah';
  end if;
  delete from rejects where id = p_id;
end;
$$;

revoke all on function delete_reject(bigint, text) from public;
grant execute on function delete_reject(bigint, text) to anon, authenticated;
-- Ubah PIN nanti: jalankan ulang script ini dengan PIN baru.
