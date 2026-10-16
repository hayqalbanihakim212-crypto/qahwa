-- Jalankan sekali di Supabase: SQL Editor -> New query -> paste -> Run.

-- Penyimpanan kunci-nilai (pesanan, stok, meja, sesi admin, pembatas percobaan)
create table if not exists kv (
  k   text primary key,
  v   text not null,
  exp timestamptz            -- null = tidak kedaluwarsa
);

-- Daftar urut (nomor pesanan terbaru)
create table if not exists kv_list (
  id bigserial primary key,
  k  text not null,
  v  text not null
);
create index if not exists kv_list_k_id on kv_list (k, id desc);

-- Tambah angka secara atomik (dipakai pembatas percobaan login/pesan)
create or replace function kv_incr(p_key text) returns bigint
language plpgsql as $$
declare n bigint;
begin
  insert into kv (k, v, exp) values (p_key, '1', null)
  on conflict (k) do update set
    v   = case when kv.exp is not null and kv.exp < now()
               then '1' else (kv.v::bigint + 1)::text end,
    exp = case when kv.exp is not null and kv.exp < now()
               then null else kv.exp end
  returning v::bigint into n;
  return n;
end $$;

-- Hitung + atur kedaluwarsa dalam SATU langkah atomik (pembatas percobaan)
create or replace function kv_incr_ex(p_key text, p_ttl int) returns bigint
language plpgsql as $$
declare n bigint;
begin
  insert into kv (k, v, exp)
  values (p_key, '1', now() + make_interval(secs => p_ttl))
  on conflict (k) do update set
    v   = case when kv.exp is not null and kv.exp < now()
               then '1' else (kv.v::bigint + 1)::text end,
    exp = case when kv.exp is not null and kv.exp < now()
               then now() + make_interval(secs => p_ttl) else kv.exp end
  returning v::bigint into n;
  return n;
end $$;

-- Simpan hanya p_keep entri terbaru dari satu daftar
create or replace function kv_ltrim(p_key text, p_keep int) returns void
language sql as $$
  delete from kv_list
  where k = p_key
    and id not in (select id from kv_list where k = p_key order by id desc limit p_keep);
$$;

-- Keamanan: nyalakan RLS tanpa policy, sehingga kunci anon/publik tidak bisa membaca apa pun.
-- Server memakai service_role key yang melewati RLS.
alter table kv      enable row level security;
alter table kv_list enable row level security;

-- Opsional: bersihkan baris kedaluwarsa (jalankan kapan saja, mis. sebulan sekali)
-- delete from kv where exp is not null and exp < now();
