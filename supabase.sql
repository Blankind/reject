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
