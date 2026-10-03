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
