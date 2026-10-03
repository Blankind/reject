-- Jalankan di Supabase → SQL Editor
create table rejects (
  id bigint generated always as identity primary key,
  created_at timestamptz default now(),
  tanggal date not null,
  shift text not null,
  line text not null,
  produk text not null,
  jenis text not null,
  qty int not null check (qty > 0),
  keterangan text,
  photos text[] default '{}'
);

alter table rejects enable row level security;
create policy "read"   on rejects for select using (true);
create policy "insert" on rejects for insert with check (true);


