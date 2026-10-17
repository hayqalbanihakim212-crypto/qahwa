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

-- Bersihkan baris kedaluwarsa (pesanan lama, sesi admin, penghitung percobaan).
-- Panggil kapan saja: select kv_cleanup();
create or replace function kv_cleanup() returns bigint
language plpgsql as $$
declare n bigint;
begin
  delete from kv where exp is not null and exp < now();
  get diagnostics n = row_count;
  return n;
end $$;

-- Opsional, otomatis tiap hari jam 03:00 (aktifkan dulu Database -> Extensions -> pg_cron):
-- select cron.schedule('kv-cleanup', '0 3 * * *', 'select kv_cleanup()');

-- ARSIP PESANAN PERMANEN. Jalankan sekali di Supabase: SQL Editor -> New query -> paste -> Run.
-- Aman dijalankan berulang. Tabel kv/kv_list tetap dipakai untuk antrian langsung dan sesi;
-- tabel ini menyimpan SEMUA pesanan selamanya (tidak ikut kedaluwarsa 30 hari).

create table if not exists orders (
  id         text primary key,                 -- nomor pesanan, mis. QHW-XXXX
  ts         bigint not null,                  -- waktu pesanan dibuat (milidetik, sama dengan kode aplikasi)
  status     text not null,                    -- pending | paid | making | ready | done | failed
  tbl        text,                             -- nama meja, atau "Bawa pulang"
  name       text,
  note       text,
  total      integer not null default 0,       -- rupiah
  items      jsonb not null default '[]',      -- [{id, v, n, q, p}, ...]
  updated_at timestamptz not null default now()
);
create index if not exists orders_ts on orders (ts desc);
create index if not exists orders_status_ts on orders (status, ts desc);

-- Keamanan: RLS menyala tanpa policy, kunci publik tidak bisa membaca apa pun.
alter table orders enable row level security;

-- Salin pesanan yang sudah ada di kv (yang belum kedaluwarsa) ke arsip.
insert into orders (id, ts, status, tbl, name, note, total, items)
select (v::jsonb)->>'id',
       ((v::jsonb)->>'ts')::bigint,
       (v::jsonb)->>'status',
       (v::jsonb)->>'table',
       (v::jsonb)->>'name',
       (v::jsonb)->>'note',
       coalesce(((v::jsonb)->>'total')::integer, 0),
       coalesce((v::jsonb)->'items', '[]'::jsonb)
from kv
where k like 'order:%' and (exp is null or exp > now())
on conflict (id) do nothing;