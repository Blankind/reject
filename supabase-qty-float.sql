-- Jalankan SEKALI di Supabase → SQL Editor. Qty boleh desimal (contoh 2.5, maks 3 angka di belakang koma).
alter table rejects alter column qty type numeric(14,3) using qty::numeric;
-- constraint check (qty > 0) tetap berlaku.
notify pgrst, 'reload schema';
